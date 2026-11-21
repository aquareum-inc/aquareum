package org.livepeer.app

import android.app.Application
import android.content.Context
import org.livepeer.app.account.Account
import org.livepeer.app.api.ApiTransport
import org.livepeer.app.api.Refusal
import org.livepeer.app.api.TokenVault
import org.livepeer.app.design.VectorMark
import org.livepeer.app.generated.Api
import org.livepeer.app.generated.Conversation
import org.livepeer.app.generated.InstanceDescription
import coil3.ImageLoader
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

class LivepeerApplication : Application(), SingletonImageLoader.Factory {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }

    override fun newImageLoader(context: Context): ImageLoader =
        ImageLoader.Builder(context).components { add(OkHttpNetworkFetcherFactory(callFactory = { container.http })) }.build()
}

/** What the screens share: the API client, who is signed in and what is known about the instance. */
class AppContainer(context: Context) {
    val http = OkHttpClient()
    private val vault = TokenVault(context)
    private lateinit var refusals: (Refusal) -> Unit

    val api = Api(ApiTransport(BuildConfig.INSTANCE_URL, token = { vault.token }, client = http, refused = { refusals(it) }))
    val instance = InstanceStore(api, http, context)
    val account = Account(api, vault, instance, MainScope(), deviceName(context)).also { account -> refusals = account::refused }
    val theme = ThemePreference(context)
    val composer = org.livepeer.app.composer.ComposerSupport(api)
    val studio = org.livepeer.app.studio.StudioModel(api)
    val characters = org.livepeer.app.characters.CharactersModel(api)
    val settings = org.livepeer.app.settings.SettingsModel(api)

    /** Conversations as last seen, so opening one shows it at once and then refreshes. */
    val conversations = mutableMapOf<String, Conversation>()
}

/**
 * The instance this build belongs to, as it describes itself: name, marks, theme, what it serves.
 * Shown from the last copy at once, then refreshed, so the theme never flashes.
 */
class InstanceStore(private val api: Api, private val http: OkHttpClient, context: Context) {
    private val cache = context.getSharedPreferences("instance", Context.MODE_PRIVATE)
    private val _description = MutableStateFlow(cache.getString(DESCRIPTION, null)?.let { runCatching { ApiTransport.json.decodeFromString(InstanceDescription.serializer(), it) }.getOrNull() })
    private val _symbol = MutableStateFlow(cache.getString(SYMBOL, null)?.let(VectorMark::parse))

    val description: StateFlow<InstanceDescription?> = _description
    val symbol: StateFlow<VectorMark?> = _symbol

    /** Whether this build can be used with the instance right now. */
    enum class Availability {
        Available,
        /** The instance doesn't serve phones, or doesn't list this app. */
        NotOffered,
        /** The instance needs a newer build than this one. */
        UpdateRequired,
    }

    /** Reads the description again. A failure keeps the last copy: the app stays usable offline. */
    suspend fun refresh() {
        val fresh = runCatching { api.getInstance() }.getOrNull() ?: return
        _description.value = fresh
        cache.edit().putString(DESCRIPTION, ApiTransport.json.encodeToString(InstanceDescription.serializer(), fresh)).apply()

        val svg = fresh.logo.symbol?.takeIf { it.substringBefore('?').endsWith(".svg", ignoreCase = true) }?.let { address ->
            withContext(Dispatchers.IO) { runCatching { http.newCall(Request.Builder().url(address).build()).execute().use { it.body.string() } }.getOrNull() }
        }
        val mark = svg?.let(VectorMark::parse)
        _symbol.value = mark
        cache.edit().apply { if (mark != null) putString(SYMBOL, svg) else remove(SYMBOL) }.apply()
    }

    companion object {
        private const val DESCRIPTION = "description"
        private const val SYMBOL = "symbol.svg"

        /** Before the first answer the app is usable: it can't know otherwise, and the first request will tell. */
        fun availability(description: InstanceDescription?, applicationId: String = BuildConfig.APPLICATION_ID, version: String = BuildConfig.VERSION_NAME): Availability {
            if (description == null) return Availability.Available
            val app = description.mobile.android
            if (!description.surfaces.mobile || app == null || !app.applicationId.equals(applicationId, ignoreCase = true)) return Availability.NotOffered
            val minimum = app.minimumVersion ?: return Availability.Available
            return if (compareVersions(version, minimum) < 0) Availability.UpdateRequired else Availability.Available
        }

        /** "0.9.3" < "0.10.0": compared number by number. */
        fun compareVersions(a: String, b: String): Int {
            val left = a.split('.').map { it.toIntOrNull() ?: 0 }
            val right = b.split('.').map { it.toIntOrNull() ?: 0 }
            for (index in 0 until maxOf(left.size, right.size)) {
                val difference = left.getOrElse(index) { 0 }.compareTo(right.getOrElse(index) { 0 })
                if (difference != 0) return difference
            }
            return 0
        }
    }
}

/** The name the person gave this device ("Adam's Pixel"), or its maker and model. */
private fun deviceName(context: Context): String =
    android.provider.Settings.Global.getString(context.contentResolver, android.provider.Settings.Global.DEVICE_NAME)?.takeIf { it.isNotBlank() }
        ?: android.os.Build.MODEL.let { model -> if (model.startsWith(android.os.Build.MANUFACTURER, ignoreCase = true)) model else "${android.os.Build.MANUFACTURER.replaceFirstChar(Char::uppercase)} $model" }

/** The person's choice of theme: follow the system, or always dark or light. Kept on this device. */
class ThemePreference(context: Context) {
    enum class Choice { System, Dark, Light }

    private val store = context.getSharedPreferences("preferences", Context.MODE_PRIVATE)
    private val _choice = MutableStateFlow(runCatching { Choice.valueOf(store.getString(KEY, null) ?: "") }.getOrDefault(Choice.System))
    val choice: StateFlow<Choice> = _choice

    fun set(choice: Choice) {
        _choice.value = choice
        store.edit().putString(KEY, choice.name).apply()
    }

    private companion object {
        const val KEY = "theme"
    }
}
