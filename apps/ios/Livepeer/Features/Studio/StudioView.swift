import SwiftUI

/// The studio: pick a medium, write one draft, Generate. Results land on the stage below and render in
/// place; each is saved to the library.
struct StudioView: View {
    let openAccount: () -> Void
    @Environment(StudioModel.self) private var studio
    @Environment(Account.self) private var account
    @Environment(\.palette) private var palette
    @Environment(\.motion) private var motion
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        @Bindable var studio = studio
        ScrollView {
            switch studio.phase {
            case .loading:
                ProgressView().padding(.top, 120).frame(maxWidth: .infinity).accessibilityLabel("Loading the studio")
            case .failed:
                LoadFailure(message: "The studio didn't load. Check your connection and try again.") { Task { await studio.load() } }
                    .padding(.top, 80)
            case .loaded where studio.mediums.isEmpty:
                EmptyState(symbol: "film.stack", title: "The studio isn't offered here", message: "This service doesn't offer making video, images or audio in the studio right now. You can still ask for them on Home.")
                    .padding(.top, 80)
            case .loaded:
                VStack(alignment: .leading, spacing: 16) {
                    Picker("Medium", selection: $studio.kind) {
                        ForEach(studio.mediums, id: \.kind) { Text($0.label).tag($0.kind) }
                    }
                    .pickerStyle(.segmented)

                    DraftCard()
                    generate
                    stage
                }
                .padding(16)
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .background(palette.background)
        .navigationTitle("Studio")
        .toolbar { AccountToolbarItem(open: openAccount) }
        .task { if studio.phase != .loaded { await studio.load() } }
        // Requote when anything that sets the price changes.
        .task(id: QuoteKey(kind: studio.kind, draft: studio.draft)) { await studio.requote() }
        .task(id: FollowKey(active: scenePhase == .active, count: studio.results.count, rendering: studio.rendering)) {
            guard scenePhase == .active else { return }
            await studio.follow()
        }
        .animation(motion(.morph), value: studio.kind)
    }

    private struct QuoteKey: Equatable {
        let kind: MediaKind
        let mode: String
        let duration: Double?
        let resolution: String?
        init(kind: MediaKind, draft: StudioDraft) {
            self.kind = kind
            mode = draft.mode
            duration = draft.durationSeconds
            resolution = draft.resolution
        }
    }

    private struct FollowKey: Equatable {
        let active: Bool
        let count: Int
        let rendering: Bool
    }

    private var short: Bool {
        guard account.signedIn, let cost = studio.cost, let credits = account.me?.balance.credits else { return false }
        return Double(cost) > credits
    }

    /// The view's one ink action, with what it costs.
    private var generate: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                Task {
                    // A guest signs in here and carries on: the draft stays as it is.
                    guard await account.requireSignIn("Sign in to generate. Your draft stays here.") else { return }
                    if await studio.generate() { await account.refresh() }
                }
            } label: {
                HStack(spacing: 8) {
                    Text(short ? "Not enough credits" : studio.generating ? "Starting…" : "Generate")
                    if !short, let cost = studio.cost {
                        Text("\(cost)").font(.custom(Typeface.monoMedium, size: TypeSize.body.size, relativeTo: .body)).opacity(0.7)
                            .contentTransition(.numericText(value: Double(cost)))
                            .accessibilityLabel("\(cost) credits")
                    }
                }
                .text(.lead, weight: .semibold)
                .foregroundStyle(palette.primaryForeground)
                .frame(maxWidth: .infinity, minHeight: 50)
                .background(palette.primary.opacity(ready ? 1 : 0.4), in: RoundedRectangle(cornerRadius: Radius.field, style: .continuous))
                .contentShape(RoundedRectangle(cornerRadius: Radius.field, style: .continuous))
            }
            .buttonStyle(PressStyle())
            .disabled(!ready)
            .sensoryFeedback(.impact(weight: .light), trigger: studio.results.count)

            if studio.mode?.available == false {
                Text("No compute operator on the network is offering \(studio.mode?.app.replacingOccurrences(of: "-", with: " ") ?? "this") right now. You can still write your draft; Generate turns on when one comes online.")
                    .text(.caption)
                    .foregroundStyle(palette.mutedForeground)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(palette.muted, in: RoundedRectangle(cornerRadius: Radius.field, style: .continuous))
            }
            if let error = studio.error {
                Text(error).text(.caption).foregroundStyle(palette.destructive)
            }
        }
    }

    private var ready: Bool { studio.mode?.available == true && studio.draft.canGenerate && !studio.generating && !short }

    /// Results, newest first. Each renders in place; a long press reuses its words.
    @ViewBuilder private var stage: some View {
        if studio.results.isEmpty, let empty = studio.medium?.empty {
            VStack(spacing: 8) {
                HStack(alignment: .bottom, spacing: 6) {
                    RoundedRectangle(cornerRadius: 10).fill(palette.secondary).frame(width: 60, height: 34)
                    RoundedRectangle(cornerRadius: 12).fill(palette.accent).frame(width: 84, height: 48).overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(palette.hairline))
                    RoundedRectangle(cornerRadius: 10).fill(palette.secondary).frame(width: 60, height: 34)
                }
                .padding(.bottom, 10)
                .accessibilityHidden(true)
                Text(empty.title).text(.lead, weight: .semibold).foregroundStyle(palette.foreground)
                Text(empty.body).text(.body).foregroundStyle(palette.mutedForeground).multilineTextAlignment(.center)
            }
            .padding(24)
            .frame(maxWidth: .infinity, minHeight: 240)
            .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(palette.input, style: StrokeStyle(lineWidth: 1, dash: [5, 4])))
        } else {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: studio.kind == .image ? 2 : 1), spacing: 12) {
                ForEach(studio.results, id: \.id) { generation in
                    GenerationTile(generation: generation, aspect: generation.request.aspect.rawValue)
                        .contextMenu {
                            Button("Use these words again", systemImage: "arrow.uturn.backward") { studio.reuse(generation) }
                        }
                        .transition(.scale(scale: 0.96).combined(with: .opacity))
                }
            }
            .animation(motion(.layout), value: studio.results.map(\.id))
        }
    }
}

/// One draft. Changing mode reshapes this card; it never swaps to another panel.
private struct DraftCard: View {
    @FocusState private var writing: Bool
    @Environment(StudioModel.self) private var studio
    @Environment(\.palette) private var palette
    @Environment(\.motion) private var motion

    var body: some View {
        @Bindable var studio = studio
        let medium = studio.medium
        VStack(alignment: .leading, spacing: 12) {
            if studio.modes.count > 1 {
                Picker("Mode", selection: Binding(get: { studio.draft.mode }, set: { studio.choose(mode: $0) })) {
                    ForEach(studio.modes, id: \.value) { Text($0.label).tag($0.value) }
                }
                .pickerStyle(.segmented)
            }

            ZStack(alignment: .topLeading) {
                if studio.draft.prompt.isEmpty {
                    Text(studio.mode?.wordsPlaceholder ?? "").text(.lead).foregroundStyle(palette.subtleForeground).accessibilityHidden(true)
                }
                TextField("", text: $studio.draft.prompt, axis: .vertical)
                    .lineLimit(4...10)
                    .text(.lead)
                    .foregroundStyle(palette.foreground)
                    .focused($writing)
                    .accessibilityLabel("Prompt")
                    .onChange(of: studio.draft.prompt) { _, words in
                        let limit = Int(medium?.promptLimit ?? 0)
                        if limit > 0, words.count > limit { studio.draft.prompt = String(words.prefix(limit)) }
                    }
            }
            .padding(12)
            .frame(maxWidth: .infinity, minHeight: 120, alignment: .topLeading)
            .background(palette.muted, in: RoundedRectangle(cornerRadius: Radius.media, style: .continuous))
            // The box is taller than the words in it; a tap anywhere on it starts typing.
            .contentShape(Rectangle())
            .onTapGesture { writing = true }

            settings
        }
        .padding(12)
        .background(palette.card, in: RoundedRectangle(cornerRadius: Radius.sheet, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.sheet, style: .continuous).strokeBorder(palette.hairline, lineWidth: 1))
        .animation(motion(.morph), value: studio.draft.mode)
    }

    /// Shape, length, resolution and how many: only what this medium and mode have.
    private var settings: some View {
        let medium = studio.medium
        return ScrollView(.horizontal) {
            HStack(spacing: 8) {
                if let aspects = medium?.aspects, aspects.count > 1 {
                    setting("aspectratio", studio.draft.aspect ?? "", label: "Shape", options: aspects.map { ($0.rawValue, $0.rawValue) }) { studio.draft.aspect = $0 }
                }
                if let durations = studio.mode?.durations, durations.count > 1 {
                    setting("timer", "\(Int(studio.draft.durationSeconds ?? 0))s", label: "Length", options: durations.map { ("\(Int($0)) seconds", "\($0)") }) { studio.draft.durationSeconds = Double($0) }
                }
                if let resolutions = medium?.resolutions, resolutions.count > 1 {
                    setting("sparkles.tv", studio.draft.resolution ?? "", label: "Resolution", options: resolutions.map { ($0.rawValue, $0.rawValue) }) { studio.draft.resolution = $0 }
                }
                if let most = medium?.maxVariants, most > 1 {
                    setting("square.grid.2x2", "×\(studio.draft.variants)", label: "How many", options: (1...Int(most)).map { ("\($0) at once", "\($0)") }) { studio.draft.variants = Int($0) ?? 1 }
                }
            }
        }
        .scrollIndicators(.hidden)
        .scrollClipDisabled()
    }

    private func setting(_ symbol: String, _ value: String, label: String, options: [(String, String)], pick: @escaping (String) -> Void) -> some View {
        Menu {
            ForEach(options, id: \.1) { option in Button(option.0) { pick(option.1) } }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: symbol).imageScale(.small)
                Text(value).text(.caption, mono: true)
            }
            .foregroundStyle(palette.mutedForeground)
            .padding(.horizontal, 10)
            .frame(minHeight: 32)
            .background(palette.hover, in: Capsule())
            .overlay(Capsule().strokeBorder(palette.hairline, lineWidth: 1))
        }
        .accessibilityLabel("\(label), \(value)")
    }
}
