import SwiftUI

/// A cast for the person's scenes: their own characters, then those shared on the instance. A guest sees the
/// shared ones and signs in to make their own.
struct CharactersView: View {
    let openAccount: () -> Void
    @State private var model: CharactersModel
    @State private var path: [Character] = []
    @State private var creating = false
    @Environment(Account.self) private var account
    @Environment(\.palette) private var palette

    init(api: API, openAccount: @escaping () -> Void) {
        self.openAccount = openAccount
        _model = State(initialValue: CharactersModel(api: api))
    }

    var body: some View {
        @Bindable var model = model
        NavigationStack(path: $path) {
            ScrollView {
                switch model.phase {
                case .loading:
                    ProgressView().padding(.top, 120).frame(maxWidth: .infinity).accessibilityLabel("Loading characters")
                case .failed:
                    LoadFailure(message: "Characters didn't load. Check your connection and try again.") { Task { await model.load() } }
                        .padding(.top, 80)
                case .loaded:
                    VStack(alignment: .leading, spacing: 28) {
                        if model.query.isEmpty { yours }
                        shared
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 24)
                }
            }
            .refreshable { await model.load() }
            .searchable(text: $model.query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search characters")
            .background(palette.background)
            .navigationTitle("Characters")
            .toolbar { AccountToolbarItem(open: openAccount) }
            .navigationDestination(for: Character.self) { character in
                CharacterView(character: character, model: model) { path.removeAll() }
            }
            .sheet(isPresented: $creating) {
                NewCharacterView(model: model) { made in
                    creating = false
                    path = [made]
                }
            }
        }
        .task(id: account.signedIn) {
            if !account.signedIn { model.signedOut() }
            await model.load()
        }
    }

    @ViewBuilder private var yours: some View {
        let mine = model.mine(signedIn: account.signedIn)
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Yours").text(.body, weight: .semibold).foregroundStyle(palette.foreground)
                Spacer()
                if !mine.isEmpty {
                    Button("New", systemImage: "plus", action: create).text(.body, weight: .medium).foregroundStyle(palette.foreground)
                }
            }
            if mine.isEmpty {
                Button(action: create) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Make your first character").text(.body, weight: .semibold).foregroundStyle(palette.foreground)
                        Text("Describe who they are and how they look, move and speak, then cast them in any scene. They stay private until you share them.")
                            .text(.caption).foregroundStyle(palette.mutedForeground).multilineTextAlignment(.leading)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(palette.input, style: StrokeStyle(lineWidth: 1, dash: [5, 4])))
                    .contentShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                }
                .buttonStyle(PressStyle())
            } else {
                ForEach(mine, id: \.slug) { character in NavigationLink(value: character) { CharacterCard(character: character) }.buttonStyle(PressStyle()) }
            }
        }
    }

    /// A guest signs in first, and the form opens once they have.
    private func create() {
        Task { if await account.requireSignIn("Sign in to make a character of your own.") { creating = true } }
    }

    @ViewBuilder private var shared: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(account.signedIn ? "Shared by others" : "Shared here").text(.body, weight: .semibold).foregroundStyle(palette.foreground)
            if model.shared.isEmpty {
                EmptyState(symbol: "magnifyingglass", title: model.query.isEmpty ? "No one shared yet" : "No one by that description", message: model.query.isEmpty ? "Characters people share on this service appear here." : "Try a role or a subject, like “editor” or “lighting”.")
                    .padding(.top, 24)
            } else {
                ForEach(model.shared, id: \.slug) { character in NavigationLink(value: character) { CharacterCard(character: character) }.buttonStyle(PressStyle()) }
            }
        }
    }
}

/// One character in a list: portrait, name, one line and how well liked they are.
private struct CharacterCard: View {
    let character: Character
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            CharacterPortrait(character: character)
                .frame(width: 72, height: 72)
                .clipShape(RoundedRectangle(cornerRadius: Radius.media, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Radius.media, style: .continuous).strokeBorder(palette.hairline, lineWidth: 1))
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(character.name).text(.body, weight: .semibold).foregroundStyle(palette.foreground).lineLimit(1)
                    if character.visibility == .private {
                        Text("Private").text(.caption, weight: .medium).foregroundStyle(palette.mutedForeground)
                            .padding(.horizontal, 7).padding(.vertical, 2).background(palette.secondary, in: Capsule())
                    }
                }
                Text(character.tagline).text(.caption).foregroundStyle(palette.mutedForeground).lineLimit(2).multilineTextAlignment(.leading)
                if character.chats > 0 { CharacterStats(character: character).padding(.top, 3) }
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(palette.hairline, lineWidth: 1))
        .accessibilityElement(children: .combine)
    }
}

/// A character's portrait, or their initial over their artwork when they have none.
struct CharacterPortrait: View {
    let character: Character
    @Environment(\.palette) private var palette

    var body: some View {
        GeometryReader { size in
            ZStack {
                MediaStill(image: character.image, artwork: character.artwork)
                if character.image == nil {
                    Text(character.name.prefix(1).uppercased())
                        .font(.system(size: size.size.width * 0.42, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.92))
                }
            }
            .frame(width: size.size.width, height: size.size.height)
            .clipped()
        }
        .accessibilityHidden(true)
    }
}

/// Rating and how many conversations, in mono.
struct CharacterStats: View {
    let character: Character
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 10) {
            Label(character.rating.formatted(.number.precision(.fractionLength(1))), systemImage: "star.fill")
            Text("\(Int(character.chats).formatted(.number.notation(.compactName))) chats")
        }
        .labelStyle(CompactLabel())
        .text(.caption, mono: true)
        .foregroundStyle(palette.subtleForeground)
        .accessibilityElement(children: .combine)
    }

    private struct CompactLabel: LabelStyle {
        func makeBody(configuration: Configuration) -> some View {
            HStack(spacing: 3) { configuration.icon.imageScale(.small); configuration.title }
        }
    }
}
