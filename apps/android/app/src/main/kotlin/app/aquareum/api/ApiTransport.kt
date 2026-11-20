package app.aquareum.api

import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.net.URLEncoder
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** What the instance said when it refused or failed a request. */
class ApiError(val status: Int, override val message: String, val code: String? = null) : Exception(message) {
    /** The session is missing, expired or revoked. */
    val isSignedOut: Boolean get() = status == 401
    /** The instance has stopped serving its apps. */
    val isMobileOff: Boolean get() = code == "mobile_off"
}

/**
 * A refusal that changes the whole app, not just one screen: a token that stopped working, or an instance
 * that stopped serving phones. [token] is the one the request carried, so a late answer to an old session
 * can't sign out a newer one.
 */
class Refusal(val error: ApiError, val token: String)

/** Sends requests to one instance's `/api/v1`. The generated `Api` calls this; nothing else does. */
class ApiTransport(
    baseUrl: String,
    /** The bearer token to send, if the caller has one. Guests send none. */
    private val token: () -> String?,
    private val client: OkHttpClient,
    /** Told about refusals that end the session or close the app; see [Refusal]. */
    private val refused: (Refusal) -> Unit = {},
) {
    private val root = baseUrl.trimEnd('/') + "/api/v1"

    @Serializable
    private data class Envelope(val error: Body) {
        @Serializable
        data class Body(val status: Int, val message: String, val code: String? = null)
    }

    suspend fun <T> send(output: DeserializationStrategy<T>, method: String, path: String, query: Map<String, JsonElement?>, body: Map<String, JsonElement?>?): T {
        val url = (root + path).toHttpUrl().newBuilder().apply {
            for ((key, value) in query.toSortedMap()) (value as? JsonPrimitive)?.let { addQueryParameter(key, it.content) }
        }.build()
        val payload = body?.let { fields -> json.encodeToString(JsonObject.serializer(), JsonObject(fields.filterValues { it != null }.mapValues { it.value!! })).toRequestBody(JSON) }
        val sent = token()
        val request = Request.Builder().url(url).header("Accept", "application/json").method(method, payload).apply {
            sent?.let { header("Authorization", "Bearer $it") }
        }.build()

        client.newCall(request).await().use { response ->
            val text = response.body.string()
            if (!response.isSuccessful) {
                val body = runCatching { json.decodeFromString(Envelope.serializer(), text).error }.getOrNull()
                val error = ApiError(response.code, body?.message ?: "The request failed.", body?.code)
                if (sent != null && (error.isSignedOut || error.isMobileOff)) refused(Refusal(error, sent))
                throw error
            }
            return json.decodeFromString(output, text)
        }
    }

    companion object {
        private val JSON = "application/json".toMediaType()

        /** Reads what the instance sends, and ignores fields a newer instance adds. */
        val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

        /** A value as one path segment. */
        fun escape(segment: String): String = URLEncoder.encode(segment, "UTF-8").replace("+", "%20")
    }
}

/** Runs a call without blocking, and cancels it when the caller is cancelled. */
private suspend fun Call.await(): Response = suspendCancellableCoroutine { continuation ->
    continuation.invokeOnCancellation { cancel() }
    enqueue(object : Callback {
        override fun onResponse(call: Call, response: Response) = continuation.resume(response)
        override fun onFailure(call: Call, e: IOException) {
            if (!continuation.isCancelled) continuation.resumeWithException(e)
        }
    })
}
