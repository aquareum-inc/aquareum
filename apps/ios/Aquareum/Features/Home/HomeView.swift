import SwiftUI

struct HomeView: View {
    let travel: Namespace.ID
    let openAccount: () -> Void
    let openHistory: () -> Void
    let open: (Conversation) -> Void
    @State private var model: HomeModel
    @State private var tray: ComposerTray?
    @FocusState private var composing: Bool
    @Environment(Account.self) private var account
    @Environment(ComposerSupport.self) private var support
    @Environment(InstanceStore.self) private var instance
    @Environment(\.palette) private var palette
    @Environment(\.motion) private var motion

    init(api: API, travel: Namespace.ID, openAccount: @escaping () -> Void, openHistory: @escaping () -> Void, open: @escaping (Conversation) -> Void) {
        self.travel = travel
        self.openAccount = openAccount
        self.openHistory = openHistory
        self.open = open
        _model = State(initialValue: HomeModel(api: api))
    }

    private static let starterSymbols = ["make-video": "film", "animate-image": "photo.on.rectangle.angled", "understand-video": "text.viewfinder", "restyle-live": "dot.radiowaves.left.and.right"]

    var body: some View {
        ScrollViewReader { scroll in
            ScrollView {
                VStack(spacing: 0) {
                    hero.id("top")
                    switch model.phase {
                    case .loading: GallerySkeleton().padding(.top, 28)
                    case .failed: LoadFailure(message: "Home didn't load. Check your connection and try again.") { Task { await model.load() } }
                    case .loaded: gallery { item in
                        model.fill(item.prompt, app: item.app)
                        withAnimation(motion(.enter)) { scroll.scrollTo("top", anchor: .top) }
                        composing = true
                    }
                    }
                }
                .padding(.bottom, 32)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .overlay(alignment: .top) {
            HStack {
                if account.signedIn {
                    Button(action: openHistory) {
                        Image(systemName: "clock.arrow.trianglehead.counterclockwise.rotate.90")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(palette.foreground)
                            .frame(width: 34, height: 34)
                            .glass(in: Circle())
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(PressStyle(round: true))
                    .accessibilityLabel("Your conversations")
                }
                Spacer()
                AccountButton(open: openAccount)
            }
            .padding(.horizontal, 8)
        }
        .composerTrays(draft: $model.draft, open: $tray)
        .background(alignment: .top) { HomeBackdrop() }
        .background(palette.background)
        .toolbar(.hidden, for: .navigationBar)
        // Again on signing in or out: what loaded with an old session may have been refused.
        .task(id: account.signedIn) { await model.load() }
        .refreshable { await model.load() }
    }

    /// Attaching and casting need an account, so a guest signs in first and then the tray opens.
    private var choices: ComposerChoices {
        ComposerChoices(
            models: support.models,
            casting: instance.description?.content.characters == true,
            attach: { openTray(.attach) },
            castCharacter: { openTray(.cast) }
        )
    }

    private func openTray(_ which: ComposerTray) {
        Task {
            guard await account.requireSignIn(which == .attach ? "Sign in to attach from your library." : "Sign in to put a character in it.") else { return }
            tray = which
        }
    }

    private var hero: some View {
        VStack(spacing: 0) {
            Text("Direct anything.")
                .font(.system(.largeTitle, weight: .semibold))
                .tracking(-0.68)
                .foregroundStyle(palette.foreground)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
            Text("Describe a scene and watch it play out. Then edit it, restyle it, or take it live.")
                .text(.lead)
                .foregroundStyle(palette.mutedForeground)
                .multilineTextAlignment(.center)
                .padding(.top, 10)
                .padding(.horizontal, 12)

            Composer(draft: $model.draft, choices: choices, sending: model.sending, focused: $composing) {
                Task {
                    // A guest signs in here and carries on: the request is still in the composer.
                    guard await account.requireSignIn("Sign in to send this. What you wrote stays here.") else { return }
                    if let conversation = await model.send() { open(conversation) }
                }
            }
            .matchedTransitionSource(id: "composer", in: travel)
            .padding(.top, 28)

            if let error = model.sendError {
                Text(error)
                    .text(.caption)
                    .foregroundStyle(palette.destructive)
                    .padding(.top, 8)
                    .transition(.opacity)
            }

            // One row to swipe through: on a phone, wrapping would push the gallery off the first screen.
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(model.starters, id: \.id) { starter in
                        Chip(label: starter.label, symbol: Self.starterSymbols[starter.id] ?? "film", selected: model.openStarter == starter.id) {
                            withAnimation(motion(.morph)) { model.toggle(starter) }
                        }
                        .accessibilityHint("Shows example requests")
                    }
                }
                .padding(.horizontal, 16)
            }
            .scrollIndicators(.hidden)
            .scrollClipDisabled() // The chips' shadows fall outside the row.
            .padding(.horizontal, -16)
            .padding(.top, 14)

            if let starter = model.starters.first(where: { $0.id == model.openStarter }) {
                VStack(spacing: 0) {
                    ForEach(starter.examples, id: \.self) { example in
                        Button {
                            withAnimation(motion(.morph)) { model.fill(example, app: starter.app) }
                            composing = true
                        } label: {
                            Text(example)
                                .text(.body)
                                .foregroundStyle(palette.mutedForeground)
                                .multilineTextAlignment(.leading)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 12)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(PressStyle())
                        .accessibilityHint("Puts this in the composer")
                    }
                }
                .padding(.top, 8)
                .transition(.opacity.combined(with: .offset(y: 6)))
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 72)
    }

    private func gallery(use: @escaping (ShowcaseItem) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            if !model.showcase.isEmpty {
                HStack(alignment: .firstTextBaseline) {
                    Text("Made here").text(.body, weight: .semibold).foregroundStyle(palette.foreground).accessibilityAddTraits(.isHeader)
                    Spacer()
                    Text("Pick one to start from its prompt").text(.caption).foregroundStyle(palette.subtleForeground)
                }
                ShowcaseGrid(items: model.showcase, use: use)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 36)
    }
}

/// The instance's own picture behind the composer, fading into the page before the gallery.
private struct HomeBackdrop: View {
    @Environment(InstanceStore.self) private var instance
    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let home = instance.description?.home
        ZStack {
            // A night sky belongs to the dark theme; on the light theme the page stays pale, as on the web.
            if !(home?.aurora == true && scheme == .light), let address = home?.backgroundPoster ?? home?.backgroundImage, let url = URL(string: address) {
                AsyncImage(url: url, transaction: Transaction(animation: .easeOut(duration: 0.6))) { phase in
                    if let picture = phase.image { picture.resizable().scaledToFill() }
                }
                // A light scrim on the dark theme, a heavier one on the light, as on the web.
                palette.panel.opacity(scheme == .dark ? 0.22 : 0.66)
            }
            LinearGradient(colors: [.clear, palette.background], startPoint: UnitPoint(x: 0.5, y: 0.55), endPoint: .bottom)
        }
        .frame(height: 560)
        .frame(maxWidth: .infinity)
        .clipped()
        .ignoresSafeArea(edges: .top)
        .accessibilityHidden(true)
    }
}

/// Examples in two columns, each tile at its own shape. A tile hands its prompt to the composer; it never sends.
private struct ShowcaseGrid: View {
    let items: [ShowcaseItem]
    let use: (ShowcaseItem) -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        // Fill the shorter column first, so the two stay level whatever the shapes.
        let columns = items.reduce(into: (left: [ShowcaseItem](), right: [ShowcaseItem](), leftHeight: 0.0, rightHeight: 0.0)) { result, item in
            let height = 1 / item.aspect.rawValue.aspectRatio
            if result.leftHeight <= result.rightHeight {
                result.left.append(item)
                result.leftHeight += height
            } else {
                result.right.append(item)
                result.rightHeight += height
            }
        }
        HStack(alignment: .top, spacing: 12) {
            column(columns.left)
            column(columns.right)
        }
    }

    private func column(_ items: [ShowcaseItem]) -> some View {
        VStack(spacing: 12) {
            ForEach(items, id: \.id) { item in
                Button { use(item) } label: { tile(item) }
                    .buttonStyle(PressStyle())
                    .accessibilityLabel("Use the prompt for “\(item.title)”")
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func tile(_ item: ShowcaseItem) -> some View {
        Color.clear
            .aspectRatio(item.aspect.rawValue.aspectRatio, contentMode: .fit)
            .overlay { MediaStill(image: item.image, artwork: item.artwork) }
            .overlay { LinearGradient(colors: [.clear, .black.opacity(0.7)], startPoint: UnitPoint(x: 0.5, y: 0.4), endPoint: .bottom) }
            .overlay(alignment: .topLeading) {
                let meta = Self.meta(item)
                HStack(spacing: 4) {
                    Image(systemName: meta.symbol).font(.system(size: 9, weight: .semibold))
                    Text(meta.label).text(.caption, mono: true)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 8)
                .frame(height: 24)
                .background(.black.opacity(0.45), in: Capsule())
                .padding(10)
            }
            .overlay(alignment: .bottomLeading) {
                Text(item.title)
                    .text(.body, weight: .medium)
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.leading)
                    .padding(12)
            }
            .clipShape(RoundedRectangle(cornerRadius: Radius.media, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.media, style: .continuous).strokeBorder(palette.hairline, lineWidth: 1))
    }

    private static func meta(_ item: ShowcaseItem) -> (symbol: String, label: String) {
        if item.app.hasPrefix("live") { return ("dot.radiowaves.left.and.right", "Live") }
        switch item.kind {
        case .image: return ("photo", "Image")
        case .audio: return ("waveform", "Audio")
        default: return ("play.fill", item.durationSeconds.map { "\(Int($0))s" } ?? "Video")
        }
    }
}

/// The gallery's shape while it loads, so nothing shifts when it arrives.
private struct GallerySkeleton: View {
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ForEach(0..<2, id: \.self) { column in
                VStack(spacing: 12) {
                    ForEach(0..<3, id: \.self) { row in
                        RoundedRectangle(cornerRadius: Radius.media, style: .continuous)
                            .fill(palette.card)
                            .aspectRatio((row + column).isMultiple(of: 2) ? 16 / 9 : 1, contentMode: .fit)
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .breathing()
        .accessibilityLabel("Loading examples")
    }
}
