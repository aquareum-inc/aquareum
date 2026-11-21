import SwiftUI

/// The person's own characters and those shared on the instance, and what can be done with them.
@Observable
final class CharactersModel {
    enum Phase: Equatable { case loading, loaded, failed }

    private(set) var phase = Phase.loading
    private(set) var all: [Character] = []
    /// Narrows the shared characters by name, role or subject.
    var query = ""
    private let api: API

    init(api: API) { self.api = api }

    /// The person's own, newest first. A guest has none.
    func mine(signedIn: Bool) -> [Character] { signedIn ? all.filter(\.mine) : [] }

    /// Everyone else's, as the search narrows them.
    var shared: [Character] {
        let others = all.filter { !$0.mine }
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return others }
        return others.filter { ([$0.name, $0.tagline] + $0.tags).contains { $0.lowercased().contains(needle) } }
    }

    func load() async {
        do {
            all = try await api.listCharacters()
            phase = .loaded
        } catch {
            if all.isEmpty { phase = .failed }
        }
    }

    /// Makes a character and puts it first among the person's own.
    func create(_ draft: CharacterDraft) async throws -> Character {
        let made = try await api.createCharacter(
            name: draft.name.trimmed,
            description: draft.description.trimmed,
            greeting: draft.greeting.trimmed,
            tagline: draft.tagline.trimmed,
            visibility: draft.shared ? "public" : "private"
        )
        all.insert(made, at: 0)
        return made
    }

    /// Sends a report to the instance's operator. True once it's received.
    func report(_ character: Character, reason: ReportReason, note: String) async -> Bool {
        let note = note.trimmed
        return (try? await api.reportCharacter(slug: character.slug, reason: reason.rawValue, note: note.isEmpty ? nil : note)) != nil
    }

    /// Blocks a character. It, and everything else by its author, leaves the list at once.
    func block(_ character: Character) async -> Bool {
        guard (try? await api.blockCharacter(slug: character.slug)) != nil else { return false }
        all.removeAll { !$0.mine && ($0.slug == character.slug || $0.author == character.author) }
        return true
    }

    /// Forgets the person's own characters once they sign out.
    func signedOut() { all.removeAll(where: \.mine) }
}

/// A new character, as the form holds it.
struct CharacterDraft: Equatable {
    var name = ""
    var tagline = ""
    var description = ""
    var greeting = ""
    var shared = false

    static let limits = (name: 40, tagline: 80, description: 2000, greeting: 300)

    var canCreate: Bool { !name.trimmed.isEmpty && !description.trimmed.isEmpty && !greeting.trimmed.isEmpty }
}

extension ReportReason {
    /// The reasons a person can choose, in the order the report tray lists them.
    static let offered: [ReportReason] = [.sexual, .hateful, .violent, .impersonation, .spam, .other]

    var label: String {
        switch self {
        case .sexual: "Sexual content"
        case .hateful: "Hateful or harassing"
        case .violent: "Violent or dangerous"
        case .impersonation: "Pretends to be a real person"
        case .spam: "Spam or a scam"
        case .other, .unknown: "Something else"
        }
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
