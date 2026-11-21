import Foundation

/// The person's conversations, newest first.
@Observable
final class HistoryModel {
    enum Phase { case loading, loaded, failed }

    private(set) var phase = Phase.loading
    private(set) var conversations: [ConversationSummary] = []
    /// Why the last delete didn't go through.
    var deleteError: String?
    private let api: API

    init(api: API) { self.api = api }

    func load() async {
        do {
            conversations = try await api.listConversations()
            phase = .loaded
        } catch {
            if conversations.isEmpty { phase = .failed }
        }
    }

    /// Conversations whose title holds every word of the search.
    func matching(_ search: String) -> [ConversationSummary] {
        let words = search.lowercased().split(separator: " ")
        guard !words.isEmpty else { return conversations }
        return conversations.filter { summary in words.allSatisfy { summary.title.lowercased().contains($0) } }
    }

    /// Deletes a conversation. It leaves the list at once and comes back if the instance refuses.
    func delete(_ summary: ConversationSummary) async {
        let before = conversations
        conversations.removeAll { $0.id == summary.id }
        deleteError = nil
        do {
            _ = try await api.deleteConversation(id: summary.id)
        } catch {
            conversations = before
            deleteError = "“\(summary.title)” wasn't deleted. Try again."
        }
    }
}
