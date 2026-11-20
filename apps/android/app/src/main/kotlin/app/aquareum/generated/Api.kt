// Generated from docs/mobile/openapi.json by packages/mobile-codegen.
// Do not edit: change apps/web/lib/public-api/operations.ts or the API client's types and run `pnpm mobile:generate`.

package app.aquareum.generated

import app.aquareum.api.ApiTransport
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.nullable
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

/** One function per operation in the instance's API. The same list serves REST, MCP and the web interface. */
@Suppress("unused")
class Api(private val transport: ApiTransport) {
    /** Describe this instance: its name, logo and theme, what it serves, how to sign in and its content settings. Open to guests. */
    suspend fun getInstance(): InstanceDescription =
        transport.send(InstanceDescription.serializer(), "GET", "/instance", query = emptyMap(), body = null)

    /** Native apps: collect a finished sign-in with the one-time code from the sign-in callback and the PKCE verifier. Answers with a device session token, shown once. Open to guests. */
    suspend fun createDeviceSession(code: String, verifier: String, platform: String, deviceName: String? = null): DeviceToken =
        transport.send(DeviceToken.serializer(), "POST", "/auth/device", query = emptyMap(), body = mapOf("code" to JsonPrimitive(code), "verifier" to JsonPrimitive(verifier), "platform" to JsonPrimitive(platform), "device_name" to deviceName?.let { JsonPrimitive(it) }))

    /** Native apps: sign this device out by ending the device session making the request. */
    suspend fun endDeviceSession(): Deleted =
        transport.send(Deleted.serializer(), "DELETE", "/auth/device", query = emptyMap(), body = null)

    /** The signed-in person: their name, email and credit balance. */
    suspend fun getMe(): Me =
        transport.send(Me.serializer(), "GET", "/me", query = emptyMap(), body = null)

    /** List the phones and tablets signed in to the person's account, most recently used first. */
    suspend fun listDevices(): List<DeviceSession> =
        transport.send(ListSerializer(DeviceSession.serializer()), "GET", "/devices", query = emptyMap(), body = null)

    /** Sign one of the person's devices out. The app on it returns to signed out on its next request. */
    suspend fun revokeDevice(id: String): Deleted =
        transport.send(Deleted.serializer(), "DELETE", "/devices/${ApiTransport.escape(id)}", query = emptyMap(), body = null)

    /** List the starting points shown on Home, each with example requests. Open to guests. */
    suspend fun listPromptStarters(): List<PromptStarter> =
        transport.send(ListSerializer(PromptStarter.serializer()), "GET", "/starters", query = emptyMap(), body = null)

    /** List the examples in the instance's gallery, each with the request that made it. Open to guests. */
    suspend fun listShowcase(): List<ShowcaseItem> =
        transport.send(ListSerializer(ShowcaseItem.serializer()), "GET", "/showcase", query = emptyMap(), body = null)

    /** List the language models the agent can run on, for the model menu. Open to guests. */
    suspend fun listAgentModels(): List<AgentModel> =
        transport.send(ListSerializer(AgentModel.serializer()), "GET", "/agent-models", query = emptyMap(), body = null)

    /** List the agent's model menu as the interface shows it: one row per language model, named and described, with the app to send as agent_model. Hidden when there are fewer than two rows. Open to guests. */
    suspend fun listAgentModelMenu(): List<AgentModelEntry> =
        transport.send(ListSerializer(AgentModelEntry.serializer()), "GET", "/agent-models/menu", query = emptyMap(), body = null)

    /** List the readable name of each capability on offer and each model the agent can run on, as the interface shows it, with the model that does the work when known. Open to guests. */
    suspend fun listCapabilityLabels(): List<CapabilityLabel> =
        transport.send(ListSerializer(CapabilityLabel.serializer()), "GET", "/offerings/labels", query = emptyMap(), body = null)

    /** List the capabilities discovered on the network that this instance offers. Open to guests. */
    suspend fun listCapabilities(): List<Offering> =
        transport.send(ListSerializer(Offering.serializer()), "GET", "/offerings", query = emptyMap(), body = null)

    /** Run any discovered capability with a request body of your own. */
    suspend fun runCapability(app: String, request: JsonElement? = null): CapabilityRun =
        transport.send(CapabilityRun.serializer(), "POST", "/run", query = emptyMap(), body = mapOf("app" to JsonPrimitive(app), "request" to request?.let { it }))

    /** List the studio's mediums (video, image, audio) as the interface shows them: each one's modes, with the capability each mode runs and whether it is on offer, and its shapes, lengths and resolutions. Open to guests. */
    suspend fun listStudioMediums(): List<StudioMedium> =
        transport.send(ListSerializer(StudioMedium.serializer()), "GET", "/studio", query = emptyMap(), body = null)

    /** What one result of a generation would cost in credits, before starting it. Open to guests. */
    suspend fun quoteGeneration(kind: String, app: String, durationSeconds: Double? = null, resolution: String? = null): Quote =
        transport.send(Quote.serializer(), "GET", "/generations/quote", query = mapOf("kind" to JsonPrimitive(kind), "app" to JsonPrimitive(app), "duration_seconds" to durationSeconds?.let { JsonPrimitive(it) }, "resolution" to resolution?.let { JsonPrimitive(it) }), body = null)

    /** Generate a video, image or audio clip. Returns a job to poll with get_generation. */
    suspend fun createGeneration(kind: String, app: String, prompt: String, aspect: String? = null, durationSeconds: Double? = null, resolution: String? = null, negativePrompt: String? = null): Generation =
        transport.send(Generation.serializer(), "POST", "/generations", query = emptyMap(), body = mapOf("kind" to JsonPrimitive(kind), "app" to JsonPrimitive(app), "prompt" to JsonPrimitive(prompt), "aspect" to aspect?.let { JsonPrimitive(it) }, "duration_seconds" to durationSeconds?.let { JsonPrimitive(it) }, "resolution" to resolution?.let { JsonPrimitive(it) }, "negative_prompt" to negativePrompt?.let { JsonPrimitive(it) }))

    /** Check a generation's state and progress. */
    suspend fun getGeneration(id: String): Generation =
        transport.send(Generation.serializer(), "GET", "/generations/${ApiTransport.escape(id)}", query = emptyMap(), body = null)

    /** List the user's conversations with the agent, newest first. */
    suspend fun listConversations(): List<ConversationSummary> =
        transport.send(ListSerializer(ConversationSummary.serializer()), "GET", "/conversations", query = emptyMap(), body = null)

    /** Start a conversation with the agent. It plans the job, calls capabilities and reports each step. */
    suspend fun createConversation(text: String, app: String? = null, aspect: String? = null, durationSeconds: Double? = null, attachmentIds: List<String>? = null, agentModel: String? = null, characterSlug: String? = null): Conversation =
        transport.send(Conversation.serializer(), "POST", "/conversations", query = emptyMap(), body = mapOf("text" to JsonPrimitive(text), "app" to app?.let { JsonPrimitive(it) }, "aspect" to aspect?.let { JsonPrimitive(it) }, "duration_seconds" to durationSeconds?.let { JsonPrimitive(it) }, "attachment_ids" to attachmentIds?.let { JsonArray(it.map(::JsonPrimitive)) }, "agent_model" to agentModel?.let { JsonPrimitive(it) }, "character_slug" to characterSlug?.let { JsonPrimitive(it) }))

    /** Read a conversation, including the agent's steps, results and any video analysis. */
    suspend fun getConversation(id: String): Conversation =
        transport.send(Conversation.serializer(), "GET", "/conversations/${ApiTransport.escape(id)}", query = emptyMap(), body = null)

    /** Delete a conversation. Its shots stay in the library. This can't be undone. */
    suspend fun deleteConversation(id: String): Deleted =
        transport.send(Deleted.serializer(), "DELETE", "/conversations/${ApiTransport.escape(id)}", query = emptyMap(), body = null)

    /** Send a follow-up message in a conversation. */
    suspend fun sendMessage(id: String, text: String, app: String? = null, aspect: String? = null, durationSeconds: Double? = null, attachmentIds: List<String>? = null, agentModel: String? = null, characterSlug: String? = null): Conversation =
        transport.send(Conversation.serializer(), "POST", "/conversations/${ApiTransport.escape(id)}/messages", query = emptyMap(), body = mapOf("text" to JsonPrimitive(text), "app" to app?.let { JsonPrimitive(it) }, "aspect" to aspect?.let { JsonPrimitive(it) }, "duration_seconds" to durationSeconds?.let { JsonPrimitive(it) }, "attachment_ids" to attachmentIds?.let { JsonArray(it.map(::JsonPrimitive)) }, "agent_model" to agentModel?.let { JsonPrimitive(it) }, "character_slug" to characterSlug?.let { JsonPrimitive(it) }))

    /** Search the user's media by what is in it: subjects, places, actions, tags. */
    suspend fun searchLibrary(query: String? = null, kind: String? = null): List<MediaItem> =
        transport.send(ListSerializer(MediaItem.serializer()), "GET", "/library", query = mapOf("query" to query?.let { JsonPrimitive(it) }, "kind" to kind?.let { JsonPrimitive(it) }), body = null)

    /** Delete an item from the library. This can't be undone. */
    suspend fun deleteMedia(id: String): Deleted =
        transport.send(Deleted.serializer(), "DELETE", "/library/${ApiTransport.escape(id)}", query = emptyMap(), body = null)

    /** Ask about a video: summarise it, find moments, answer a question. */
    suspend fun understandVideo(source: String, question: String): VideoAnalysis =
        transport.send(VideoAnalysis.serializer(), "POST", "/understand", query = emptyMap(), body = mapOf("source" to JsonPrimitive(source), "question" to JsonPrimitive(question)))

    /** List characters the user can chat with or call. */
    suspend fun listCharacters(query: String? = null): List<Character> =
        transport.send(ListSerializer(Character.serializer()), "GET", "/characters", query = mapOf("query" to query?.let { JsonPrimitive(it) }), body = null)

    /** The user's credit balance and budget. */
    suspend fun getBalance(): CreditBalance =
        transport.send(CreditBalance.serializer(), "GET", "/balance", query = emptyMap(), body = null)

    /** What the user has spent, by capability, and recent jobs. */
    suspend fun getUsage(): Usage =
        transport.send(Usage.serializer(), "GET", "/usage", query = emptyMap(), body = null)

    /** Open a real-time session, such as a live restyle of a camera. It stays open and is billed by the second until closed. */
    suspend fun openSession(app: String, prompt: String, destinationIds: List<String>? = null, record: Boolean? = null): LiveSession =
        transport.send(LiveSession.serializer(), "POST", "/sessions", query = emptyMap(), body = mapOf("app" to JsonPrimitive(app), "prompt" to JsonPrimitive(prompt), "destination_ids" to destinationIds?.let { JsonArray(it.map(::JsonPrimitive)) }, "record" to record?.let { JsonPrimitive(it) }))

    /** Change a running session's prompt without closing it. */
    suspend fun updateSession(id: String, prompt: String): LiveSession =
        transport.send(LiveSession.serializer(), "PATCH", "/sessions/${ApiTransport.escape(id)}", query = emptyMap(), body = mapOf("prompt" to JsonPrimitive(prompt)))

    /** Close a real-time session. */
    suspend fun closeSession(id: String): LiveSession =
        transport.send(LiveSession.serializer(), "DELETE", "/sessions/${ApiTransport.escape(id)}", query = emptyMap(), body = null)
}
