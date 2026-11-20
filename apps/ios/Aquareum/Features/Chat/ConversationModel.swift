import SwiftUI

/// One conversation, kept current while the agent works.
@Observable
final class ConversationModel {
    private(set) var conversation: Conversation
    private(set) var generations: [String: Generation] = [:]
    /// How each capability reads where it did a piece of work, keyed by app.
    private(set) var labels: [String: String] = [:]
    private(set) var sending = false
    var sendError: String?
    /// Set when the conversation can't be read at all.
    private(set) var loadFailed = false
    var draft = Draft()
    private let api: API

    init(api: API, conversation: Conversation) {
        self.api = api
        self.conversation = conversation
    }

    /// True while there is something to wait for: a turn in progress or a shot still rendering.
    var working: Bool {
        conversation.messages.contains { if case .agent(let turn) = $0 { turn.state == .working } else { false } } || !pendingGenerations.isEmpty
    }

    private var generationIds: [String] {
        conversation.messages.flatMap { if case .agent(let turn) = $0 { turn.generationIds } else { [String]() } }
    }

    private var pendingGenerations: [String] {
        generationIds.filter { id in
            guard let state = generations[id]?.state else { return true }
            return state == .queued || state == .running
        }
    }

    /// Follows the conversation until nothing is in progress: quick at first, then backing off, as a
    /// long render doesn't need watching closely. Ends when the task is cancelled, which the view does
    /// when it disappears or the app leaves the foreground.
    func follow() async {
        if labels.isEmpty, let all = try? await api.listCapabilityLabels() {
            labels = Dictionary(all.map { ($0.app, $0.work) }, uniquingKeysWith: { first, _ in first })
        }
        let started = ContinuousClock.now
        while !Task.isCancelled {
            await refresh()
            guard working, !loadFailed else { return }
            let elapsed = ContinuousClock.now - started
            let pause: Duration = elapsed < .seconds(10) ? .milliseconds(700) : elapsed < .seconds(30) ? .milliseconds(1500) : elapsed < .seconds(90) ? .seconds(3) : .seconds(5)
            try? await Task.sleep(for: pause)
        }
    }

    private func refresh() async {
        do {
            conversation = try await api.getConversation(id: conversation.id)
            loadFailed = false
        } catch let error as APIError where error.status == 404 || error.isSignedOut {
            loadFailed = true
            return
        } catch {
            return // A dropped poll is retried on the next turn of the loop.
        }
        await withTaskGroup(of: Generation?.self) { group in
            for id in pendingGenerations { group.addTask { [api] in try? await api.getGeneration(id: id) } }
            for await generation in group { if let generation { generations[generation.id] = generation } }
        }
    }

    func send() async {
        guard draft.canSend, !sending else { return }
        sending = true
        sendError = nil
        defer { sending = false }
        do {
            conversation = try await api.sendMessage(id: conversation.id, text: draft.prompt.trimmingCharacters(in: .whitespacesAndNewlines))
            draft = Draft()
        } catch {
            sendError = "That message didn’t send. Try again."
        }
    }
}
