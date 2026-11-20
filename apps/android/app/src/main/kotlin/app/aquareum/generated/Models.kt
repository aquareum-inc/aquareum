// Generated from docs/mobile/openapi.json by packages/mobile-codegen.
// Do not edit: change apps/web/lib/public-api/operations.ts or the API client's types and run `pnpm mobile:generate`.

package app.aquareum.generated

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** A language model the agent can run on: one app serving it, with what the menu needs to show. */
@Serializable
data class AgentModel(
    @SerialName("app") val app: String,
    /** The model's id, e.g. `qwen3.8-27b`. */
    @SerialName("model") val model: String,
    @SerialName("context_tokens") val contextTokens: Double? = null,
    /** No runner is free right now, so a job would queue. */
    @SerialName("busy") val busy: Boolean,
)

/** How a discovered app reads in the interface, so every client names it the same way. */
@Serializable
data class CapabilityLabel(
    @SerialName("app") val app: String,
    /** What it is: "Text to video", or a language model's name. */
    @SerialName("name") val name: String,
    /** How it reads where it did a piece of work, with its model when known: "Text to image · FLUX.2 klein 4B". */
    @SerialName("work") val work: String,
)

@Serializable
data class CapabilityRun(
    @SerialName("app") val app: String,
    @SerialName("request") val request: JsonElement,
    @SerialName("response") val response: JsonElement,
    @SerialName("status") val status: Double,
    @SerialName("elapsed_ms") val elapsedMs: Double,
    @SerialName("credits_charged") val creditsCharged: Double,
)

@Serializable(with = CharacterVisibility.Serializer::class)
enum class CharacterVisibility(val value: String) {
    Private("private"),
    Public("public"),

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<CharacterVisibility> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("CharacterVisibility", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): CharacterVisibility = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: CharacterVisibility) = encoder.encodeString(value.value)
    }
}

@Serializable
data class Character(
    @SerialName("slug") val slug: String,
    @SerialName("name") val name: String,
    @SerialName("tagline") val tagline: String,
    @SerialName("description") val description: String,
    /** How the character opens a conversation. */
    @SerialName("greeting") val greeting: String,
    @SerialName("author") val author: String,
    @SerialName("visibility") val visibility: CharacterVisibility,
    @SerialName("mature") val mature: Boolean,
    /** Can take a live voice or video call. */
    @SerialName("calls") val calls: Boolean,
    @SerialName("tags") val tags: List<String>,
    @SerialName("rating") val rating: Double,
    @SerialName("chats") val chats: Double,
    @SerialName("mine") val mine: Boolean,
    /** A portrait, when there is one. Without one, `artwork` stands in with the name's initial. */
    @SerialName("image") val image: String? = null,
    @SerialName("artwork") val artwork: MockArtwork,
)

/** Stand-in artwork for mocked media, until real outputs exist. */
@Serializable
data class MockArtwork(
    @SerialName("hues") val hues: List<Double>,
    @SerialName("seed") val seed: Double,
)

@Serializable
data class Conversation(
    @SerialName("id") val id: String,
    @SerialName("title") val title: String,
    @SerialName("updated_at") val updatedAt: String,
    @SerialName("messages") val messages: List<Message>,
)

@Serializable(with = Message.Serializer::class)
sealed interface Message {
    data class User(val value: UserMessage) : Message
    data class Agent(val value: AgentMessage) : Message

    object Serializer : KSerializer<Message> {
        override val descriptor: SerialDescriptor = buildClassSerialDescriptor("Message")

        override fun deserialize(decoder: Decoder): Message {
            val input = decoder as? JsonDecoder ?: throw SerializationException("Message is read from JSON only")
            val element = input.decodeJsonElement()
            return when (val kind = element.jsonObject["role"]?.jsonPrimitive?.content) {
                "user" -> User(input.json.decodeFromJsonElement(UserMessage.serializer(), element))
                "agent" -> Agent(input.json.decodeFromJsonElement(AgentMessage.serializer(), element))
                else -> throw SerializationException("Unknown Message role: $kind")
            }
        }

        override fun serialize(encoder: Encoder, value: Message) = when (value) {
            is User -> encoder.encodeSerializableValue(UserMessage.serializer(), value.value)
            is Agent -> encoder.encodeSerializableValue(AgentMessage.serializer(), value.value)
        }
    }
}

@Serializable
data class UserMessage(
    @SerialName("id") val id: String,
    @SerialName("role") val role: String,
    @SerialName("text") val text: String,
    /** The character the message asked to put on screen, if any. */
    @SerialName("cast") val cast: CharacterCast? = null,
    /** The language model the user picked to run the agent; `null` was Auto. */
    @SerialName("agent_model") val agentModel: String? = null,
    @SerialName("created_at") val createdAt: String,
)

/** Who a request puts on screen: just enough of a character to show and to start a shot from. */
@Serializable
data class CharacterCast(
    @SerialName("slug") val slug: String,
    @SerialName("name") val name: String,
    /** A portrait, when there is one. Without one, `artwork` stands in with the name's initial. */
    @SerialName("image") val image: String? = null,
)

@Serializable(with = AgentMessageState.Serializer::class)
enum class AgentMessageState(val value: String) {
    Working("working"),
    Done("done"),

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<AgentMessageState> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("AgentMessageState", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): AgentMessageState = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: AgentMessageState) = encoder.encodeString(value.value)
    }
}

@Serializable
data class AgentMessage(
    @SerialName("id") val id: String,
    @SerialName("role") val role: String,
    @SerialName("state") val state: AgentMessageState,
    @SerialName("steps") val steps: List<AgentStep>,
    /** The reply, once the agent has finished. */
    @SerialName("text") val text: String? = null,
    /** Generations produced in this turn; each can be opened in the studio. */
    @SerialName("generation_ids") val generationIds: List<String>,
    /** Set when the turn analysed a video. */
    @SerialName("analysis") val analysis: VideoAnalysis? = null,
    @SerialName("elapsed_ms") val elapsedMs: Double,
    @SerialName("created_at") val createdAt: String,
)

@Serializable(with = AgentStepKind.Serializer::class)
enum class AgentStepKind(val value: String) {
    Plan("plan"),
    Tool("tool"),
    Review("review"),

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<AgentStepKind> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("AgentStepKind", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): AgentStepKind = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: AgentStepKind) = encoder.encodeString(value.value)
    }
}

/** One thing the agent did: a decision, a tool call against a capability, or a review of its own output. */
@Serializable
data class AgentStep(
    @SerialName("id") val id: String,
    @SerialName("kind") val kind: AgentStepKind,
    @SerialName("title") val title: String,
    @SerialName("detail") val detail: String,
    /** The capability called, for tool and review steps. */
    @SerialName("app") val app: String? = null,
    @SerialName("state") val state: AgentStepState,
)

@Serializable(with = AgentStepState.Serializer::class)
enum class AgentStepState(val value: String) {
    Pending("pending"),
    Running("running"),
    Done("done"),

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<AgentStepState> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("AgentStepState", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): AgentStepState = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: AgentStepState) = encoder.encodeString(value.value)
    }
}

@Serializable
data class VideoAnalysis(
    @SerialName("summary") val summary: String,
    @SerialName("moments") val moments: List<VideoMoment>,
    @SerialName("tags") val tags: List<String>,
)

/** A moment an understanding capability found in a video. */
@Serializable
data class VideoMoment(
    @SerialName("at_seconds") val atSeconds: Double,
    @SerialName("label") val label: String,
)

@Serializable
data class ConversationSummary(
    @SerialName("id") val id: String,
    @SerialName("title") val title: String,
    @SerialName("updated_at") val updatedAt: String,
)

/** A user's balance in credits: their allocation's available amount after the instance's markup rule. */
@Serializable
data class CreditBalance(
    @SerialName("credits") val credits: Double,
    @SerialName("allowance") val allowance: BudgetSummary,
)

/** A user's budget in the provider's currency: what was granted, spent and is left. */
@Serializable
data class BudgetSummary(
    @SerialName("granted") val granted: String,
    @SerialName("spent") val spent: String,
    @SerialName("available") val available: String,
    @SerialName("currency") val currency: String,
)

/** The answer to a delete. */
@Serializable
data class Deleted(
    @SerialName("deleted") val deleted: Boolean,
)

@Serializable(with = DeviceSessionPlatform.Serializer::class)
enum class DeviceSessionPlatform(val value: String) {
    Ios("ios"),
    Android("android"),

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<DeviceSessionPlatform> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("DeviceSessionPlatform", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): DeviceSessionPlatform = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: DeviceSessionPlatform) = encoder.encodeString(value.value)
    }
}

/** A phone or tablet signed in to the instance with its own revocable session. */
@Serializable
data class DeviceSession(
    @SerialName("id") val id: String,
    /** The device's own name, as it reported it ("Adam's iPhone"). */
    @SerialName("name") val name: String,
    @SerialName("platform") val platform: DeviceSessionPlatform,
    @SerialName("created_at") val createdAt: String,
    @SerialName("last_used_at") val lastUsedAt: String,
    /** The session making this request. */
    @SerialName("current") val current: Boolean,
)

/** A new device session. The token is shown once; the instance keeps only a keyed hash of it. */
@Serializable
data class DeviceToken(
    @SerialName("token") val token: String,
    @SerialName("device") val device: DeviceSession,
)

/** An async generation job. Mocked: the engine's async jobs return 501 today. */
@Serializable
data class Generation(
    @SerialName("id") val id: String,
    @SerialName("state") val state: GenerationState,
    @SerialName("progress") val progress: Double,
    @SerialName("request") val request: GenerationRequest,
    @SerialName("credits_charged") val creditsCharged: Double,
    @SerialName("created_at") val createdAt: String,
    @SerialName("artwork") val artwork: MockArtwork,
)

@Serializable(with = GenerationState.Serializer::class)
enum class GenerationState(val value: String) {
    Queued("queued"),
    Running("running"),
    Succeeded("succeeded"),
    Failed("failed"),

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<GenerationState> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("GenerationState", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): GenerationState = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: GenerationState) = encoder.encodeString(value.value)
    }
}

@Serializable(with = GenerationRequestAspect.Serializer::class)
enum class GenerationRequestAspect(val value: String) {
    V16x9("16:9"),
    V9x16("9:16"),
    V1x1("1:1"),

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<GenerationRequestAspect> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("GenerationRequestAspect", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): GenerationRequestAspect = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: GenerationRequestAspect) = encoder.encodeString(value.value)
    }
}

/** Video only. */
@Serializable(with = GenerationRequestResolution.Serializer::class)
enum class GenerationRequestResolution(val value: String) {
    V720p("720p"),
    V1080p("1080p"),

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<GenerationRequestResolution> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("GenerationRequestResolution", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): GenerationRequestResolution = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: GenerationRequestResolution) = encoder.encodeString(value.value)
    }
}

@Serializable
data class GenerationRequest(
    @SerialName("kind") val kind: MediaKind,
    @SerialName("app") val app: String,
    @SerialName("prompt") val prompt: String,
    @SerialName("aspect") val aspect: GenerationRequestAspect,
    /** Video and audio only. */
    @SerialName("duration_seconds") val durationSeconds: Double? = null,
    /** Video only. */
    @SerialName("resolution") val resolution: GenerationRequestResolution? = null,
    @SerialName("negative_prompt") val negativePrompt: String? = null,
    /** Image-to-video only: the image the shot starts from, such as a character's portrait. */
    @SerialName("first_frame") val firstFrame: String? = null,
)

@Serializable(with = MediaKind.Serializer::class)
enum class MediaKind(val value: String) {
    Video("video"),
    Image("image"),
    Audio("audio"),

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<MediaKind> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("MediaKind", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): MediaKind = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: MediaKind) = encoder.encodeString(value.value)
    }
}

@Serializable
data class InstanceDescriptionLogo(
    /** A square mark, or null to set the name's first letter in type. */
    @SerialName("symbol") val symbol: String? = null,
    /** The full logo, or null to set the name in type. */
    @SerialName("wordmark") val wordmark: String? = null,
    /** Draw the marks in the text colour, using only their shape. */
    @SerialName("tint") val tint: Boolean,
)

/** Overrides for colour tokens, per theme, keyed by token name ("primary"). Tokens not listed keep their default. */
@Serializable
data class InstanceDescriptionTheme(
    @SerialName("dark") val dark: Map<String, String>,
    @SerialName("light") val light: Map<String, String>,
)

@Serializable
data class InstanceDescriptionSurfaces(
    @SerialName("app") val app: Boolean,
    @SerialName("api") val api: Boolean,
    @SerialName("mcp") val mcp: Boolean,
    @SerialName("mobile") val mobile: Boolean,
)

@Serializable
data class InstanceDescriptionMobileIos(
    @SerialName("bundle_id") val bundleId: String,
    @SerialName("minimum_version") val minimumVersion: String? = null,
)

@Serializable
data class InstanceDescriptionMobileAndroid(
    @SerialName("application_id") val applicationId: String,
    @SerialName("minimum_version") val minimumVersion: String? = null,
)

/** The native apps built for this instance. Sign-in returns only to these; an app not listed can't sign in. */
@Serializable
data class InstanceDescriptionMobile(
    @SerialName("ios") val ios: InstanceDescriptionMobileIos? = null,
    @SerialName("android") val android: InstanceDescriptionMobileAndroid? = null,
)

@Serializable(with = InstanceDescriptionSignInSignUp.Serializer::class)
enum class InstanceDescriptionSignInSignUp(val value: String) {
    Open("open"),
    Invite("invite"),
    Closed("closed"),

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<InstanceDescriptionSignInSignUp> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("InstanceDescriptionSignInSignUp", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): InstanceDescriptionSignInSignUp = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: InstanceDescriptionSignInSignUp) = encoder.encodeString(value.value)
    }
}

@Serializable
data class InstanceDescriptionSignIn(
    @SerialName("methods") val methods: List<SignInMethodName>,
    @SerialName("sign_up") val signUp: InstanceDescriptionSignInSignUp,
)

@Serializable
data class InstanceDescriptionContent(
    @SerialName("characters") val characters: Boolean,
    @SerialName("adult_content") val adultContent: Boolean,
)

@Serializable
data class InstanceDescriptionHome(
    @SerialName("background_image") val backgroundImage: String? = null,
    @SerialName("background_poster") val backgroundPoster: String? = null,
    @SerialName("background_video") val backgroundVideo: String? = null,
    /** Draw a live aurora over the background image. */
    @SerialName("aurora") val aurora: Boolean,
)

/** What a client needs to know about an instance before anyone signs in: how it looks, what it serves and how to sign in. Read from the instance config, so there is no engine call behind it. URLs are absolute and theme colours are sRGB hex, so a client that can't read CSS can use them as they are. */
@Serializable
data class InstanceDescription(
    @SerialName("api_version") val apiVersion: String,
    @SerialName("name") val name: String,
    @SerialName("logo") val logo: InstanceDescriptionLogo,
    /** Overrides for colour tokens, per theme, keyed by token name ("primary"). Tokens not listed keep their default. */
    @SerialName("theme") val theme: InstanceDescriptionTheme,
    @SerialName("surfaces") val surfaces: InstanceDescriptionSurfaces,
    /** The native apps built for this instance. Sign-in returns only to these; an app not listed can't sign in. */
    @SerialName("mobile") val mobile: InstanceDescriptionMobile,
    @SerialName("sign_in") val signIn: InstanceDescriptionSignIn,
    @SerialName("content") val content: InstanceDescriptionContent,
    @SerialName("home") val home: InstanceDescriptionHome,
)

/** A way to sign in that an instance can offer. */
@Serializable(with = SignInMethodName.Serializer::class)
enum class SignInMethodName(val value: String) {
    Email("email"),
    Passkey("passkey"),
    Google("google"),
    Apple("apple"),
    Discord("discord"),
    Coinbase("coinbase"),
    Wallet("wallet"),

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<SignInMethodName> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("SignInMethodName", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): SignInMethodName = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: SignInMethodName) = encoder.encodeString(value.value)
    }
}

@Serializable(with = LiveSessionState.Serializer::class)
enum class LiveSessionState(val value: String) {
    Live("live"),
    Ended("ended"),

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<LiveSessionState> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("LiveSessionState", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): LiveSessionState = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: LiveSessionState) = encoder.encodeString(value.value)
    }
}

@Serializable
data class LiveSession(
    @SerialName("id") val id: String,
    @SerialName("app") val app: String,
    @SerialName("state") val state: LiveSessionState,
    @SerialName("prompt") val prompt: String,
    @SerialName("destination_ids") val destinationIds: List<String>,
    @SerialName("recording") val recording: Boolean,
    @SerialName("started_at") val startedAt: String,
    /** Set when the session ended and was recorded. */
    @SerialName("recording_media_id") val recordingMediaId: String? = null,
)

/** The signed-in user, as the account menu shows them. */
@Serializable
data class Me(
    @SerialName("id") val id: String,
    @SerialName("name") val name: String,
    @SerialName("email") val email: String? = null,
    @SerialName("balance") val balance: CreditBalance,
)

@Serializable(with = MediaItemSource.Serializer::class)
enum class MediaItemSource(val value: String) {
    Generation("generation"),
    Upload("upload"),
    Recording("recording"),

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<MediaItemSource> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("MediaItemSource", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): MediaItemSource = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: MediaItemSource) = encoder.encodeString(value.value)
    }
}

@Serializable(with = MediaItemAspect.Serializer::class)
enum class MediaItemAspect(val value: String) {
    V16x9("16:9"),
    V9x16("9:16"),
    V1x1("1:1"),

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<MediaItemAspect> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("MediaItemAspect", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): MediaItemAspect = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: MediaItemAspect) = encoder.encodeString(value.value)
    }
}

/** Something in the user's library: an upload or a generation, with what the product understood about it. */
@Serializable
data class MediaItem(
    @SerialName("id") val id: String,
    @SerialName("kind") val kind: MediaKind,
    @SerialName("source") val source: MediaItemSource,
    @SerialName("title") val title: String,
    /** Automatic description, from a video understanding capability. */
    @SerialName("description") val description: String,
    @SerialName("tags") val tags: List<String>,
    @SerialName("app") val app: String? = null,
    @SerialName("prompt") val prompt: String? = null,
    @SerialName("aspect") val aspect: MediaItemAspect,
    @SerialName("duration_seconds") val durationSeconds: Double? = null,
    @SerialName("created_at") val createdAt: String,
    /** A still of the media, when there is one. Tiles without one show `artwork`. */
    @SerialName("image") val image: String? = null,
    @SerialName("artwork") val artwork: MockArtwork,
)

/** One row of `GET /v1/offerings`. Identity is (app, currency, unit). */
@Serializable
data class Offering(
    @SerialName("app") val app: String,
    @SerialName("modes") val modes: List<InteractionMode>,
    @SerialName("rate_low") val rateLow: RatePoint? = null,
    @SerialName("rate_high") val rateHigh: RatePoint? = null,
    @SerialName("rate_status") val rateStatus: String,
    @SerialName("stale") val stale: Boolean,
    @SerialName("runner_count") val runnerCount: Double,
    @SerialName("ready_count") val readyCount: Double,
    @SerialName("observed_at") val observedAt: String,
)

/** Types shaped on the engine's real responses (livepeer-builder `GET /v1/offerings`, `GET /v1/allowance`). See docs/research/engine.md. Amounts are decimal strings. */
@Serializable(with = InteractionMode.Serializer::class)
enum class InteractionMode(val value: String) {
    SingleShot("single-shot"),
    Persistent("persistent"),

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<InteractionMode> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("InteractionMode", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): InteractionMode = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: InteractionMode) = encoder.encodeString(value.value)
    }
}

@Serializable
data class RatePoint(
    @SerialName("amount") val amount: String,
    @SerialName("currency") val currency: String,
    @SerialName("unit") val unit: String,
    @SerialName("price_usd") val priceUsd: String? = null,
    @SerialName("source") val source: String,
    @SerialName("observed_at") val observedAt: String,
    @SerialName("observed_by") val observedBy: String,
)

@Serializable
data class PromptStarter(
    @SerialName("id") val id: String,
    @SerialName("label") val label: String,
    @SerialName("app") val app: String,
    @SerialName("examples") val examples: List<String>,
)

@Serializable(with = ShowcaseItemAspect.Serializer::class)
enum class ShowcaseItemAspect(val value: String) {
    V16x9("16:9"),
    V9x16("9:16"),
    V1x1("1:1"),

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<ShowcaseItemAspect> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("ShowcaseItemAspect", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): ShowcaseItemAspect = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: ShowcaseItemAspect) = encoder.encodeString(value.value)
    }
}

/** An example in the instance's gallery. Instance content; no engine endpoint. */
@Serializable
data class ShowcaseItem(
    @SerialName("id") val id: String,
    @SerialName("kind") val kind: MediaKind,
    @SerialName("app") val app: String,
    @SerialName("title") val title: String,
    @SerialName("prompt") val prompt: String,
    @SerialName("aspect") val aspect: ShowcaseItemAspect,
    @SerialName("duration_seconds") val durationSeconds: Double? = null,
    /** A still of the result, when there is one. Tiles without one show `artwork`. */
    @SerialName("image") val image: String? = null,
    @SerialName("artwork") val artwork: MockArtwork,
)

/** What a user has spent: totals by capability, and their recent jobs. */
@Serializable
data class Usage(
    @SerialName("summary") val summary: UsageSummary,
    @SerialName("entries") val entries: List<UsageEntry>,
)

@Serializable
data class UsageSummaryByApp(
    @SerialName("app") val app: String,
    @SerialName("credits") val credits: Double,
    @SerialName("jobs") val jobs: Double,
)

@Serializable
data class UsageSummary(
    @SerialName("credits") val credits: Double,
    @SerialName("wholesale") val wholesale: Money,
    @SerialName("jobs") val jobs: Double,
    @SerialName("by_app") val byApp: List<UsageSummaryByApp>,
)

/** The payment and identity provider behind the engine, in the engine's terms: grants fund allocations, an allocation is a user's budget, usage is what was spent, a plan is the provider's plan. Nothing here is a second ledger: every amount is read from the provider. */
@Serializable
data class Money(
    /** Decimal string, as the engine and providers report amounts. */
    @SerialName("amount") val amount: String,
    @SerialName("currency") val currency: String,
)

@Serializable(with = UsageEntryStatus.Serializer::class)
enum class UsageEntryStatus(val value: String) {
    Delivered("delivered"),
    FailedAfterPayment("failed_after_payment"),
    Pending("pending"),

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<UsageEntryStatus> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("UsageEntryStatus", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): UsageEntryStatus = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: UsageEntryStatus) = encoder.encodeString(value.value)
    }
}

@Serializable
data class UsageEntry(
    @SerialName("id") val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("app") val app: String,
    /** What the network charged. */
    @SerialName("wholesale") val wholesale: Money,
    /** What the user was charged, in credits. */
    @SerialName("credits") val credits: Double,
    @SerialName("status") val status: UsageEntryStatus,
    @SerialName("created_at") val createdAt: String,
)
