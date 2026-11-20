package app.aquareum

import android.app.Application
import android.content.Context
import app.aquareum.api.ApiTransport
import app.aquareum.design.VectorMark
import app.aquareum.generated.Api
import app.aquareum.generated.Conversation
import app.aquareum.generated.InstanceDescription
import coil3.ImageLoader
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

class AquareumApplication : Application(), SingletonImageLoader.Factory {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }

    override fun newImageLoader(context: Context): ImageLoader =
        ImageLoader.Builder(context).components { add(OkHttpNetworkFetcherFactory(callFactory = { container.http })) }.build()
}

/** What the screens share: the API client and what is known about the instance. */
class AppContainer(context: Context) {
    val http = OkHttpClient()

    /** Development builds send a mock-only instance's demo key until sign-in is built; release builds have none. */
    val api = Api(ApiTransport(BuildConfig.INSTANCE_URL, token = { BuildConfig.MOCK_ONLY_DEMO_KEY.ifEmpty { null } }, client = http))
    val instance = InstanceStore(api, http, context)

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

    private companion object {
        const val DESCRIPTION = "description"
        const val SYMBOL = "symbol.svg"
    }
}
