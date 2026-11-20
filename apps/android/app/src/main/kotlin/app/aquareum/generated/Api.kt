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

    /** List the starting points shown on Home, each with example requests. Open to guests. */
    suspend fun listPromptStarters(): List<PromptStarter> =
        transport.send(ListSerializer(PromptStarter.serializer()), "GET", "/starters", query = emptyMap(), body = null)

    /** List the examples in the instance's gallery, each with the request that made it. Open to guests. */
    suspend fun listShowcase(): List<ShowcaseItem> =
        transport.send(ListSerializer(ShowcaseItem.serializer()), "GET", "/showcase", query = emptyMap(), body = null)

    /** List the language models the agent can run on, for the model menu. Open to guests. */
    suspend fun listAgentModels(): List<AgentModel> =
        transport.send(ListSerializer(AgentModel.serializer()), "GET", "/agent-models", query = emptyMap(), body = null)

    /** List the readable name of each capability on offer, as the interface shows it, with the model that does the work when known. Open to guests. */
    suspend fun listCapabilityLabels(): List<CapabilityLabel> =
        transport.send(ListSerializer(CapabilityLabel.serializer()), "GET", "/offerings/labels", query = emptyMap(), body = null)

    /** List the capabilities discovered on the network that this instance offers. Open to guests. */
    suspend fun listCapabilities(): List<Offering> =
        transport.send(ListSerializer(Offering.serializer()), "GET", "/offerings", query = emptyMap(), body = null)

    /** Run any discovered capability with a request body of your own. */
    suspend fun runCapability(app: String, request: JsonElement? = null): CapabilityRun =
        transport.send(CapabilityRun.serializer(), "POST", "/run", query = emptyMap(), body = mapOf("app" to JsonPrimitive(app), "request" to request?.let { it }))

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

    /** Send a follow-up message in a conversation. */
    suspend fun sendMessage(id: String, text: String, attachmentIds: List<String>? = null, agentModel: String? = null, characterSlug: String? = null): Conversation =
        transport.send(Conversation.serializer(), "POST", "/conversations/${ApiTransport.escape(id)}/messages", query = emptyMap(), body = mapOf("text" to JsonPrimitive(text), "attachment_ids" to attachmentIds?.let { JsonArray(it.map(::JsonPrimitive)) }, "agent_model" to agentModel?.let { JsonPrimitive(it) }, "character_slug" to characterSlug?.let { JsonPrimitive(it) }))

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
