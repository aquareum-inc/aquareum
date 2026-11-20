// Generated from docs/mobile/openapi.json by packages/mobile-codegen.
// Do not edit: change apps/web/lib/public-api/operations.ts or the API client's types and run `pnpm mobile:generate`.

import Foundation

/// One function per operation in the instance's API. The same list serves REST, MCP and the web interface.
struct API: Sendable {
    let transport: APITransport

    /// Describe this instance: its name, logo and theme, what it serves, how to sign in and its content settings.
    /// Open to guests.
    func getInstance() async throws -> InstanceDescription {
        try await transport.send("GET", "/instance", query: [:], body: nil)
    }

    /// List the starting points shown on Home, each with example requests.
    /// Open to guests.
    func listPromptStarters() async throws -> [PromptStarter] {
        try await transport.send("GET", "/starters", query: [:], body: nil)
    }

    /// List the examples in the instance's gallery, each with the request that made it.
    /// Open to guests.
    func listShowcase() async throws -> [ShowcaseItem] {
        try await transport.send("GET", "/showcase", query: [:], body: nil)
    }

    /// List the language models the agent can run on, for the model menu.
    /// Open to guests.
    func listAgentModels() async throws -> [AgentModel] {
        try await transport.send("GET", "/agent-models", query: [:], body: nil)
    }

    /// List the readable name of each capability on offer, as the interface shows it, with the model that does the work when known.
    /// Open to guests.
    func listCapabilityLabels() async throws -> [CapabilityLabel] {
        try await transport.send("GET", "/offerings/labels", query: [:], body: nil)
    }

    /// List the capabilities discovered on the network that this instance offers.
    /// Open to guests.
    func listCapabilities() async throws -> [Offering] {
        try await transport.send("GET", "/offerings", query: [:], body: nil)
    }

    /// Run any discovered capability with a request body of your own.
    func runCapability(app: String, request: JSONValue? = nil) async throws -> CapabilityRun {
        try await transport.send("POST", "/run", query: [:], body: ["app": .string(app), "request": request.map { $0 }])
    }

    /// Generate a video, image or audio clip. Returns a job to poll with get_generation.
    func createGeneration(kind: String, app: String, prompt: String, aspect: String? = nil, durationSeconds: Double? = nil, resolution: String? = nil, negativePrompt: String? = nil) async throws -> Generation {
        try await transport.send("POST", "/generations", query: [:], body: ["kind": .string(kind), "app": .string(app), "prompt": .string(prompt), "aspect": aspect.map { .string($0) }, "duration_seconds": durationSeconds.map { .number($0) }, "resolution": resolution.map { .string($0) }, "negative_prompt": negativePrompt.map { .string($0) }])
    }

    /// Check a generation's state and progress.
    func getGeneration(id: String) async throws -> Generation {
        try await transport.send("GET", "/generations/\(APITransport.escape(id))", query: [:], body: nil)
    }

    /// List the user's conversations with the agent, newest first.
    func listConversations() async throws -> [ConversationSummary] {
        try await transport.send("GET", "/conversations", query: [:], body: nil)
    }

    /// Start a conversation with the agent. It plans the job, calls capabilities and reports each step.
    func createConversation(text: String, app: String? = nil, aspect: String? = nil, durationSeconds: Double? = nil, attachmentIds: [String]? = nil, agentModel: String? = nil, characterSlug: String? = nil) async throws -> Conversation {
        try await transport.send("POST", "/conversations", query: [:], body: ["text": .string(text), "app": app.map { .string($0) }, "aspect": aspect.map { .string($0) }, "duration_seconds": durationSeconds.map { .number($0) }, "attachment_ids": attachmentIds.map { .array($0.map { .string($0) }) }, "agent_model": agentModel.map { .string($0) }, "character_slug": characterSlug.map { .string($0) }])
    }

    /// Read a conversation, including the agent's steps, results and any video analysis.
    func getConversation(id: String) async throws -> Conversation {
        try await transport.send("GET", "/conversations/\(APITransport.escape(id))", query: [:], body: nil)
    }

    /// Send a follow-up message in a conversation.
    func sendMessage(id: String, text: String, attachmentIds: [String]? = nil, agentModel: String? = nil, characterSlug: String? = nil) async throws -> Conversation {
        try await transport.send("POST", "/conversations/\(APITransport.escape(id))/messages", query: [:], body: ["text": .string(text), "attachment_ids": attachmentIds.map { .array($0.map { .string($0) }) }, "agent_model": agentModel.map { .string($0) }, "character_slug": characterSlug.map { .string($0) }])
    }

    /// Search the user's media by what is in it: subjects, places, actions, tags.
    func searchLibrary(query: String? = nil, kind: String? = nil) async throws -> [MediaItem] {
        try await transport.send("GET", "/library", query: ["query": query.map { .string($0) }, "kind": kind.map { .string($0) }], body: nil)
    }

    /// Delete an item from the library. This can't be undone.
    func deleteMedia(id: String) async throws -> Deleted {
        try await transport.send("DELETE", "/library/\(APITransport.escape(id))", query: [:], body: nil)
    }

    /// Ask about a video: summarise it, find moments, answer a question.
    func understandVideo(source: String, question: String) async throws -> VideoAnalysis {
        try await transport.send("POST", "/understand", query: [:], body: ["source": .string(source), "question": .string(question)])
    }

    /// List characters the user can chat with or call.
    func listCharacters(query: String? = nil) async throws -> [Character] {
        try await transport.send("GET", "/characters", query: ["query": query.map { .string($0) }], body: nil)
    }

    /// The user's credit balance and budget.
    func getBalance() async throws -> CreditBalance {
        try await transport.send("GET", "/balance", query: [:], body: nil)
    }

    /// What the user has spent, by capability, and recent jobs.
    func getUsage() async throws -> Usage {
        try await transport.send("GET", "/usage", query: [:], body: nil)
    }

    /// Open a real-time session, such as a live restyle of a camera. It stays open and is billed by the second until closed.
    func openSession(app: String, prompt: String, destinationIds: [String]? = nil, record: Bool? = nil) async throws -> LiveSession {
        try await transport.send("POST", "/sessions", query: [:], body: ["app": .string(app), "prompt": .string(prompt), "destination_ids": destinationIds.map { .array($0.map { .string($0) }) }, "record": record.map { .bool($0) }])
    }

    /// Change a running session's prompt without closing it.
    func updateSession(id: String, prompt: String) async throws -> LiveSession {
        try await transport.send("PATCH", "/sessions/\(APITransport.escape(id))", query: [:], body: ["prompt": .string(prompt)])
    }

    /// Close a real-time session.
    func closeSession(id: String) async throws -> LiveSession {
        try await transport.send("DELETE", "/sessions/\(APITransport.escape(id))", query: [:], body: nil)
    }
}
