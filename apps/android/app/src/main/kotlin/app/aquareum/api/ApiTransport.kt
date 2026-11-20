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
class ApiError(val status: Int, override val message: String) : Exception(message) {
    /** The session is missing, expired or revoked. */
    val isSignedOut: Boolean get() = status == 401
}

/** Sends requests to one instance's `/api/v1`. The generated `Api` calls this; nothing else does. */
class ApiTransport(
    baseUrl: String,
    /** The bearer token to send, if the caller has one. Guests send none. */
    private val token: () -> String?,
    private val client: OkHttpClient,
) {
    private val root = baseUrl.trimEnd('/') + "/api/v1"

    @Serializable
    private data class Envelope(val error: Body) {
        @Serializable
        data class Body(val status: Int, val message: String)
    }

    suspend fun <T> send(output: DeserializationStrategy<T>, method: String, path: String, query: Map<String, JsonElement?>, body: Map<String, JsonElement?>?): T {
        val url = (root + path).toHttpUrl().newBuilder().apply {
            for ((key, value) in query.toSortedMap()) (value as? JsonPrimitive)?.let { addQueryParameter(key, it.content) }
        }.build()
        val payload = body?.let { fields -> json.encodeToString(JsonObject.serializer(), JsonObject(fields.filterValues { it != null }.mapValues { it.value!! })).toRequestBody(JSON) }
        val request = Request.Builder().url(url).header("Accept", "application/json").method(method, payload).apply {
            token()?.let { header("Authorization", "Bearer $it") }
        }.build()

        client.newCall(request).await().use { response ->
            val text = response.body.string()
            if (!response.isSuccessful) {
                val message = runCatching { json.decodeFromString(Envelope.serializer(), text).error.message }.getOrNull()
                throw ApiError(response.code, message ?: "The request failed.")
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
