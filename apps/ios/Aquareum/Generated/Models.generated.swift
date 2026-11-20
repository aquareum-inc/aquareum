// Generated from docs/mobile/openapi.json by packages/mobile-codegen.
// Do not edit: change apps/web/lib/public-api/operations.ts or the API client's types and run `pnpm mobile:generate`.

import Foundation

/// A language model the agent can run on: one app serving it, with what the menu needs to show.
struct AgentModel: Codable, Sendable, Hashable {
    var app: String
    /// The model's id, e.g. `qwen3.8-27b`.
    var model: String
    var contextTokens: Double?
    /// No runner is free right now, so a job would queue.
    var busy: Bool

    enum CodingKeys: String, CodingKey {
        case app
        case model
        case contextTokens = "context_tokens"
        case busy
    }
}

/// How a discovered app reads in the interface, so every client names it the same way.
struct CapabilityLabel: Codable, Sendable, Hashable {
    var app: String
    /// What it is: "Text to video", or a language model's name.
    var name: String
    /// How it reads where it did a piece of work, with its model when known: "Text to image · FLUX.2 klein 4B".
    var work: String
}

struct CapabilityRun: Codable, Sendable, Hashable {
    var app: String
    var request: JSONValue
    var response: JSONValue
    var status: Double
    var elapsedMs: Double
    var creditsCharged: Double

    enum CodingKeys: String, CodingKey {
        case app
        case request
        case response
        case status
        case elapsedMs = "elapsed_ms"
        case creditsCharged = "credits_charged"
    }
}

enum CharacterVisibility: String, Codable, Sendable, Hashable, CaseIterable {
    case `private` = "private"
    case `public` = "public"
    /// A value this build doesn't know, from a newer instance.
    case unknown = "\u{0}unknown"

    init(from decoder: Decoder) throws {
        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

struct Character: Codable, Sendable, Hashable {
    var slug: String
    var name: String
    var tagline: String
    var description: String
    /// How the character opens a conversation.
    var greeting: String
    var author: String
    var visibility: CharacterVisibility
    var mature: Bool
    /// Can take a live voice or video call.
    var calls: Bool
    var tags: [String]
    var rating: Double
    var chats: Double
    var mine: Bool
    /// A portrait, when there is one. Without one, `artwork` stands in with the name's initial.
    var image: String?
    var artwork: MockArtwork
}

/// Stand-in artwork for mocked media, until real outputs exist.
struct MockArtwork: Codable, Sendable, Hashable {
    var hues: [Double]
    var seed: Double
}

struct Conversation: Codable, Sendable, Hashable {
    var id: String
    var title: String
    var updatedAt: String
    var messages: [Message]

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case updatedAt = "updated_at"
        case messages
    }
}

enum Message: Codable, Sendable, Hashable {
    case user(UserMessage)
    case agent(AgentMessage)

    private enum Discriminator: String, CodingKey { case role = "role" }

    init(from decoder: Decoder) throws {
        let kind = try decoder.container(keyedBy: Discriminator.self).decode(String.self, forKey: .role)
        switch kind {
        case "user": self = .user(try UserMessage(from: decoder))
        case "agent": self = .agent(try AgentMessage(from: decoder))
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown Message role: \(kind)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        switch self {
        case .user(let value): try value.encode(to: encoder)
        case .agent(let value): try value.encode(to: encoder)
        }
    }
}

struct UserMessage: Codable, Sendable, Hashable {
    var id: String
    var role: String
    var text: String
    /// The character the message asked to put on screen, if any.
    var cast: CharacterCast?
    /// The language model the user picked to run the agent; `null` was Auto.
    var agentModel: String?
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case role
        case text
        case cast
        case agentModel = "agent_model"
        case createdAt = "created_at"
    }
}

/// Who a request puts on screen: just enough of a character to show and to start a shot from.
struct CharacterCast: Codable, Sendable, Hashable {
    var slug: String
    var name: String
    /// A portrait, when there is one. Without one, `artwork` stands in with the name's initial.
    var image: String?
}

enum AgentMessageState: String, Codable, Sendable, Hashable, CaseIterable {
    case working = "working"
    case done = "done"
    /// A value this build doesn't know, from a newer instance.
    case unknown = "\u{0}unknown"

    init(from decoder: Decoder) throws {
        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

struct AgentMessage: Codable, Sendable, Hashable {
    var id: String
    var role: String
    var state: AgentMessageState
    var steps: [AgentStep]
    /// The reply, once the agent has finished.
    var text: String?
    /// Generations produced in this turn; each can be opened in the studio.
    var generationIds: [String]
    /// Set when the turn analysed a video.
    var analysis: VideoAnalysis?
    var elapsedMs: Double
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case role
        case state
        case steps
        case text
        case generationIds = "generation_ids"
        case analysis
        case elapsedMs = "elapsed_ms"
        case createdAt = "created_at"
    }
}

enum AgentStepKind: String, Codable, Sendable, Hashable, CaseIterable {
    case plan = "plan"
    case tool = "tool"
    case review = "review"
    /// A value this build doesn't know, from a newer instance.
    case unknown = "\u{0}unknown"

    init(from decoder: Decoder) throws {
        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

/// One thing the agent did: a decision, a tool call against a capability, or a review of its own output.
struct AgentStep: Codable, Sendable, Hashable {
    var id: String
    var kind: AgentStepKind
    var title: String
    var detail: String
    /// The capability called, for tool and review steps.
    var app: String?
    var state: AgentStepState
}

enum AgentStepState: String, Codable, Sendable, Hashable, CaseIterable {
    case pending = "pending"
    case running = "running"
    case done = "done"
    /// A value this build doesn't know, from a newer instance.
    case unknown = "\u{0}unknown"

    init(from decoder: Decoder) throws {
        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

struct VideoAnalysis: Codable, Sendable, Hashable {
    var summary: String
    var moments: [VideoMoment]
    var tags: [String]
}

/// A moment an understanding capability found in a video.
struct VideoMoment: Codable, Sendable, Hashable {
    var atSeconds: Double
    var label: String

    enum CodingKeys: String, CodingKey {
        case atSeconds = "at_seconds"
        case label
    }
}

struct ConversationSummary: Codable, Sendable, Hashable {
    var id: String
    var title: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case updatedAt = "updated_at"
    }
}

/// A user's balance in credits: their allocation's available amount after the instance's markup rule.
struct CreditBalance: Codable, Sendable, Hashable {
    var credits: Double
    var allowance: BudgetSummary
}

/// A user's budget in the provider's currency: what was granted, spent and is left.
struct BudgetSummary: Codable, Sendable, Hashable {
    var granted: String
    var spent: String
    var available: String
    var currency: String
}

/// The answer to a delete.
struct Deleted: Codable, Sendable, Hashable {
    var deleted: Bool
}

/// An async generation job. Mocked: the engine's async jobs return 501 today.
struct Generation: Codable, Sendable, Hashable {
    var id: String
    var state: GenerationState
    var progress: Double
    var request: GenerationRequest
    var creditsCharged: Double
    var createdAt: String
    var artwork: MockArtwork

    enum CodingKeys: String, CodingKey {
        case id
        case state
        case progress
        case request
        case creditsCharged = "credits_charged"
        case createdAt = "created_at"
        case artwork
    }
}

enum GenerationState: String, Codable, Sendable, Hashable, CaseIterable {
    case queued = "queued"
    case running = "running"
    case succeeded = "succeeded"
    case failed = "failed"
    /// A value this build doesn't know, from a newer instance.
    case unknown = "\u{0}unknown"

    init(from decoder: Decoder) throws {
        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

enum GenerationRequestAspect: String, Codable, Sendable, Hashable, CaseIterable {
    case v16x9 = "16:9"
    case v9x16 = "9:16"
    case v1x1 = "1:1"
    /// A value this build doesn't know, from a newer instance.
    case unknown = "\u{0}unknown"

    init(from decoder: Decoder) throws {
        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

/// Video only.
enum GenerationRequestResolution: String, Codable, Sendable, Hashable, CaseIterable {
    case v720p = "720p"
    case v1080p = "1080p"
    /// A value this build doesn't know, from a newer instance.
    case unknown = "\u{0}unknown"

    init(from decoder: Decoder) throws {
        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

struct GenerationRequest: Codable, Sendable, Hashable {
    var kind: MediaKind
    var app: String
    var prompt: String
    var aspect: GenerationRequestAspect
    /// Video and audio only.
    var durationSeconds: Double?
    /// Video only.
    var resolution: GenerationRequestResolution??
    var negativePrompt: String?
    /// Image-to-video only: the image the shot starts from, such as a character's portrait.
    var firstFrame: String?

    enum CodingKeys: String, CodingKey {
        case kind
        case app
        case prompt
        case aspect
        case durationSeconds = "duration_seconds"
        case resolution
        case negativePrompt = "negative_prompt"
        case firstFrame = "first_frame"
    }
}

enum MediaKind: String, Codable, Sendable, Hashable, CaseIterable {
    case video = "video"
    case image = "image"
    case audio = "audio"
    /// A value this build doesn't know, from a newer instance.
    case unknown = "\u{0}unknown"

    init(from decoder: Decoder) throws {
        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

struct InstanceDescriptionLogo: Codable, Sendable, Hashable {
    /// A square mark, or null to set the name's first letter in type.
    var symbol: String?
    /// The full logo, or null to set the name in type.
    var wordmark: String?
    /// Draw the marks in the text colour, using only their shape.
    var tint: Bool
}

/// Overrides for colour tokens, per theme, keyed by token name ("primary"). Tokens not listed keep their default.
struct InstanceDescriptionTheme: Codable, Sendable, Hashable {
    var dark: [String: String]
    var light: [String: String]
}

struct InstanceDescriptionSurfaces: Codable, Sendable, Hashable {
    var app: Bool
    var api: Bool
    var mcp: Bool
}

enum InstanceDescriptionSignInSignUp: String, Codable, Sendable, Hashable, CaseIterable {
    case open = "open"
    case invite = "invite"
    case closed = "closed"
    /// A value this build doesn't know, from a newer instance.
    case unknown = "\u{0}unknown"

    init(from decoder: Decoder) throws {
        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

struct InstanceDescriptionSignIn: Codable, Sendable, Hashable {
    var methods: [SignInMethodName]
    var signUp: InstanceDescriptionSignInSignUp

    enum CodingKeys: String, CodingKey {
        case methods
        case signUp = "sign_up"
    }
}

struct InstanceDescriptionContent: Codable, Sendable, Hashable {
    var characters: Bool
    var adultContent: Bool

    enum CodingKeys: String, CodingKey {
        case characters
        case adultContent = "adult_content"
    }
}

struct InstanceDescriptionHome: Codable, Sendable, Hashable {
    var backgroundImage: String?
    var backgroundPoster: String?
    var backgroundVideo: String?
    /// Draw a live aurora over the background image.
    var aurora: Bool

    enum CodingKeys: String, CodingKey {
        case backgroundImage = "background_image"
        case backgroundPoster = "background_poster"
        case backgroundVideo = "background_video"
        case aurora
    }
}

/// What a client needs to know about an instance before anyone signs in: how it looks, what it serves and how to sign in. Read from the instance config, so there is no engine call behind it. URLs are absolute and theme colours are sRGB hex, so a client that can't read CSS can use them as they are.
struct InstanceDescription: Codable, Sendable, Hashable {
    var apiVersion: String
    var name: String
    var logo: InstanceDescriptionLogo
    /// Overrides for colour tokens, per theme, keyed by token name ("primary"). Tokens not listed keep their default.
    var theme: InstanceDescriptionTheme
    var surfaces: InstanceDescriptionSurfaces
    var signIn: InstanceDescriptionSignIn
    var content: InstanceDescriptionContent
    var home: InstanceDescriptionHome

    enum CodingKeys: String, CodingKey {
        case apiVersion = "api_version"
        case name
        case logo
        case theme
        case surfaces
        case signIn = "sign_in"
        case content
        case home
    }
}

/// A way to sign in that an instance can offer.
enum SignInMethodName: String, Codable, Sendable, Hashable, CaseIterable {
    case email = "email"
    case passkey = "passkey"
    case google = "google"
    case apple = "apple"
    case discord = "discord"
    case coinbase = "coinbase"
    case wallet = "wallet"
    /// A value this build doesn't know, from a newer instance.
    case unknown = "\u{0}unknown"

    init(from decoder: Decoder) throws {
        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

enum LiveSessionState: String, Codable, Sendable, Hashable, CaseIterable {
    case live = "live"
    case ended = "ended"
    /// A value this build doesn't know, from a newer instance.
    case unknown = "\u{0}unknown"

    init(from decoder: Decoder) throws {
        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

struct LiveSession: Codable, Sendable, Hashable {
    var id: String
    var app: String
    var state: LiveSessionState
    var prompt: String
    var destinationIds: [String]
    var recording: Bool
    var startedAt: String
    /// Set when the session ended and was recorded.
    var recordingMediaId: String?

    enum CodingKeys: String, CodingKey {
        case id
        case app
        case state
        case prompt
        case destinationIds = "destination_ids"
        case recording
        case startedAt = "started_at"
        case recordingMediaId = "recording_media_id"
    }
}

enum MediaItemSource: String, Codable, Sendable, Hashable, CaseIterable {
    case generation = "generation"
    case upload = "upload"
    case recording = "recording"
    /// A value this build doesn't know, from a newer instance.
    case unknown = "\u{0}unknown"

    init(from decoder: Decoder) throws {
        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

enum MediaItemAspect: String, Codable, Sendable, Hashable, CaseIterable {
    case v16x9 = "16:9"
    case v9x16 = "9:16"
    case v1x1 = "1:1"
    /// A value this build doesn't know, from a newer instance.
    case unknown = "\u{0}unknown"

    init(from decoder: Decoder) throws {
        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

/// Something in the user's library: an upload or a generation, with what the product understood about it.
struct MediaItem: Codable, Sendable, Hashable {
    var id: String
    var kind: MediaKind
    var source: MediaItemSource
    var title: String
    /// Automatic description, from a video understanding capability.
    var description: String
    var tags: [String]
    var app: String?
    var prompt: String?
    var aspect: MediaItemAspect
    var durationSeconds: Double?
    var createdAt: String
    /// A still of the media, when there is one. Tiles without one show `artwork`.
    var image: String?
    var artwork: MockArtwork

    enum CodingKeys: String, CodingKey {
        case id
        case kind
        case source
        case title
        case description
        case tags
        case app
        case prompt
        case aspect
        case durationSeconds = "duration_seconds"
        case createdAt = "created_at"
        case image
        case artwork
    }
}

/// One row of `GET /v1/offerings`. Identity is (app, currency, unit).
struct Offering: Codable, Sendable, Hashable {
    var app: String
    var modes: [InteractionMode]
    var rateLow: RatePoint?
    var rateHigh: RatePoint?
    var rateStatus: String
    var stale: Bool
    var runnerCount: Double
    var readyCount: Double
    var observedAt: String

    enum CodingKeys: String, CodingKey {
        case app
        case modes
        case rateLow = "rate_low"
        case rateHigh = "rate_high"
        case rateStatus = "rate_status"
        case stale
        case runnerCount = "runner_count"
        case readyCount = "ready_count"
        case observedAt = "observed_at"
    }
}

/// Types shaped on the engine's real responses (livepeer-builder `GET /v1/offerings`, `GET /v1/allowance`). See docs/research/engine.md. Amounts are decimal strings.
enum InteractionMode: String, Codable, Sendable, Hashable, CaseIterable {
    case singleShot = "single-shot"
    case persistent = "persistent"
    /// A value this build doesn't know, from a newer instance.
    case unknown = "\u{0}unknown"

    init(from decoder: Decoder) throws {
        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

struct RatePoint: Codable, Sendable, Hashable {
    var amount: String
    var currency: String
    var unit: String
    var priceUsd: String?
    var source: String
    var observedAt: String
    var observedBy: String

    enum CodingKeys: String, CodingKey {
        case amount
        case currency
        case unit
        case priceUsd = "price_usd"
        case source
        case observedAt = "observed_at"
        case observedBy = "observed_by"
    }
}

struct PromptStarter: Codable, Sendable, Hashable {
    var id: String
    var label: String
    var app: String
    var examples: [String]
}

enum ShowcaseItemAspect: String, Codable, Sendable, Hashable, CaseIterable {
    case v16x9 = "16:9"
    case v9x16 = "9:16"
    case v1x1 = "1:1"
    /// A value this build doesn't know, from a newer instance.
    case unknown = "\u{0}unknown"

    init(from decoder: Decoder) throws {
        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

/// An example in the instance's gallery. Instance content; no engine endpoint.
struct ShowcaseItem: Codable, Sendable, Hashable {
    var id: String
    var kind: MediaKind
    var app: String
    var title: String
    var prompt: String
    var aspect: ShowcaseItemAspect
    var durationSeconds: Double?
    /// A still of the result, when there is one. Tiles without one show `artwork`.
    var image: String?
    var artwork: MockArtwork

    enum CodingKeys: String, CodingKey {
        case id
        case kind
        case app
        case title
        case prompt
        case aspect
        case durationSeconds = "duration_seconds"
        case image
        case artwork
    }
}

/// What a user has spent: totals by capability, and their recent jobs.
struct Usage: Codable, Sendable, Hashable {
    var summary: UsageSummary
    var entries: [UsageEntry]
}

struct UsageSummaryByApp: Codable, Sendable, Hashable {
    var app: String
    var credits: Double
    var jobs: Double
}

struct UsageSummary: Codable, Sendable, Hashable {
    var credits: Double
    var wholesale: Money
    var jobs: Double
    var byApp: [UsageSummaryByApp]

    enum CodingKeys: String, CodingKey {
        case credits
        case wholesale
        case jobs
        case byApp = "by_app"
    }
}

/// The payment and identity provider behind the engine, in the engine's terms: grants fund allocations, an allocation is a user's budget, usage is what was spent, a plan is the provider's plan. Nothing here is a second ledger: every amount is read from the provider.
struct Money: Codable, Sendable, Hashable {
    /// Decimal string, as the engine and providers report amounts.
    var amount: String
    var currency: String
}

enum UsageEntryStatus: String, Codable, Sendable, Hashable, CaseIterable {
    case delivered = "delivered"
    case failedAfterPayment = "failed_after_payment"
    case pending = "pending"
    /// A value this build doesn't know, from a newer instance.
    case unknown = "\u{0}unknown"

    init(from decoder: Decoder) throws {
        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}

struct UsageEntry: Codable, Sendable, Hashable {
    var id: String
    var userId: String
    var app: String
    /// What the network charged.
    var wholesale: Money
    /// What the user was charged, in credits.
    var credits: Double
    var status: UsageEntryStatus
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case app
        case wholesale
        case credits
        case status
        case createdAt = "created_at"
    }
}
