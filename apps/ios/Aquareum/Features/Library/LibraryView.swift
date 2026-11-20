import SwiftUI

/// Everything the person has made or added, newest first. A guest sees what the library is for.
struct LibraryView: View {
    let api: API
    let openAccount: () -> Void
    @Environment(Account.self) private var account
    @Environment(\.palette) private var palette
    @State private var phase = Phase.loading

    enum Phase { case loading, loaded([MediaItem]), failed }

    var body: some View {
        Group {
            if !account.signedIn {
                SignedOutState(symbol: "square.grid.2x2", title: "Your library", message: "Everything you make is kept here, searchable by what's in it. Sign in to see yours.")
            } else {
                switch phase {
                case .loading: LibrarySkeleton()
                case .failed: LoadFailure(message: "Your library didn't load. Check your connection and try again.") { Task { await load() } }
                case .loaded(let items) where items.isEmpty:
                    EmptyState(symbol: "sparkles.rectangle.stack", title: "Nothing here yet", message: "What you make on Home shows up here.")
                case .loaded(let items):
                    ScrollView { LibraryGrid(items: items).padding(16) }
                        .refreshable { await load() }
                }
            }
        }
        .background(palette.background)
        .navigationTitle("Library")
        .toolbar { AccountToolbarItem(open: openAccount) }
        .task(id: account.signedIn) { if account.signedIn { await load() } }
    }

    private func load() async {
        do {
            phase = .loaded(try await api.searchLibrary())
        } catch {
            if case .loaded = phase { return }
            phase = .failed
        }
    }
}

private struct LibraryGrid: View {
    let items: [MediaItem]
    @Environment(\.palette) private var palette

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            ForEach(items, id: \.id) { item in
                Color.clear
                    .aspectRatio(1, contentMode: .fit)
                    .overlay { MediaStill(image: item.image, artwork: item.artwork) }
                    .overlay(alignment: .bottomLeading) {
                        Text(item.title)
                            .text(.caption, weight: .medium)
                            .foregroundStyle(.white)
                            .lineLimit(2)
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(LinearGradient(colors: [.clear, .black.opacity(0.65)], startPoint: .top, endPoint: .bottom))
                    }
                    .clipShape(RoundedRectangle(cornerRadius: Radius.media, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: Radius.media, style: .continuous).strokeBorder(palette.hairline, lineWidth: 1))
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(item.title)
            }
        }
    }
}

/// The grid's shape while it loads.
private struct LibrarySkeleton: View {
    @Environment(\.palette) private var palette

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            ForEach(0..<6, id: \.self) { _ in
                RoundedRectangle(cornerRadius: Radius.media, style: .continuous).fill(palette.card).aspectRatio(1, contentMode: .fit)
            }
        }
        .padding(16)
        .frame(maxHeight: .infinity, alignment: .top)
        .breathing()
        .accessibilityLabel("Loading your library")
    }
}
