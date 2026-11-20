import Foundation

/// The person's library: what matches the search and the type, newest first.
@Observable
final class LibraryModel {
    enum Phase { case loading, loaded, failed }

    private(set) var phase = Phase.loading
    private(set) var items: [MediaItem] = []
    /// What is on screen, in words: "a runner at night", "harbour".
    var query = ""
    /// One type, or every type with nil.
    var kind: MediaKind?
    /// Set while a new search is under way, so the grid can dim instead of emptying.
    private(set) var searching = false
    /// Why the last change didn't go through, in words for the person.
    var actionError: String?
    private let api: API

    init(api: API) { self.api = api }

    var filtered: Bool { !query.trimmingCharacters(in: .whitespaces).isEmpty || kind != nil }

    /// Searches by what is in the media. Called a moment after typing stops.
    func search() async {
        searching = true
        defer { searching = false }
        let words = query.trimmingCharacters(in: .whitespaces)
        do {
            items = try await api.searchLibrary(query: words.isEmpty ? nil : words, kind: kind?.rawValue)
            phase = .loaded
        } catch {
            if phase != .loaded { phase = .failed }
        }
    }

    /// Deletes an item. It leaves the grid at once and comes back if the instance refuses.
    func delete(_ item: MediaItem) async {
        let before = items
        items.removeAll { $0.id == item.id }
        actionError = nil
        do {
            _ = try await api.deleteMedia(id: item.id)
        } catch {
            items = before
            actionError = "“\(item.title)” wasn't deleted. Try again."
        }
    }

    /// Starts a conversation about an item: the agent watches it, summarises it and lists its moments.
    func ask(about item: MediaItem) async -> Conversation? {
        actionError = nil
        do {
            return try await api.createConversation(
                text: "Summarise “\(item.title)” from my library and list the key moments with timestamps.",
                aspect: item.aspect.rawValue,
                durationSeconds: item.durationSeconds ?? 5,
                attachmentIds: [item.id]
            )
        } catch {
            actionError = "That didn't start. Check your connection and try again."
            return nil
        }
    }

    /// The words to start from in the studio: the prompt that made it, or what is in it.
    static func studioPrompt(for item: MediaItem) -> String { item.prompt ?? item.description }
}

/// A library item is identified by its id, so a tray can show one.
extension MediaItem: Identifiable {}
