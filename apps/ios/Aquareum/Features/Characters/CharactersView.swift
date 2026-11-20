import SwiftUI

/// The characters the person can chat with: their own and the public ones.
struct CharactersView: View {
    let api: API
    let openAccount: () -> Void
    @Environment(Account.self) private var account
    @Environment(\.palette) private var palette
    @State private var phase = Phase.loading

    enum Phase { case loading, loaded([Character]), failed }

    var body: some View {
        Group {
            if !account.signedIn {
                SignedOutState(symbol: "person.2", title: "Characters", message: "Chat with characters people have made, or make your own. Sign in to meet them.")
            } else {
                switch phase {
                case .loading:
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity).accessibilityLabel("Loading characters")
                case .failed:
                    LoadFailure(message: "Characters didn't load. Check your connection and try again.") { Task { await load() } }
                case .loaded(let characters) where characters.isEmpty:
                    EmptyState(symbol: "person.2", title: "No characters yet", message: "Characters made here show up in this list.")
                case .loaded(let characters):
                    List(characters, id: \.slug) { character in CharacterRow(character: character) }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                        .refreshable { await load() }
                }
            }
        }
        .background(palette.background)
        .navigationTitle("Characters")
        .toolbar { AccountToolbarItem(open: openAccount) }
        .task(id: account.signedIn) { if account.signedIn { await load() } }
    }

    private func load() async {
        do {
            phase = .loaded(try await api.listCharacters())
        } catch {
            if case .loaded = phase { return }
            phase = .failed
        }
    }
}

private struct CharacterRow: View {
    let character: Character
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 12) {
            MediaStill(image: character.image, artwork: character.artwork)
                .frame(width: 48, height: 48)
                .clipShape(Circle())
                .overlay(Circle().strokeBorder(palette.hairline, lineWidth: 1))
            VStack(alignment: .leading, spacing: 2) {
                Text(character.name).text(.body, weight: .semibold).foregroundStyle(palette.foreground)
                Text(character.tagline).text(.body).foregroundStyle(palette.mutedForeground).lineLimit(2)
            }
        }
        .padding(.vertical, 4)
        .listRowBackground(Color.clear)
        .listRowSeparatorTint(palette.hairline)
        .accessibilityElement(children: .combine)
    }
}
