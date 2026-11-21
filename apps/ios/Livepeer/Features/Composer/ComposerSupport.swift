import SwiftUI

/// What every composer can offer besides words: the agent's models, the capabilities on offer, and the
/// library and characters to pick from. Read once and shared by Home and every conversation.
@Observable
final class ComposerSupport {
    enum Load<Value> { case idle, loading, loaded(Value), failed }

    private(set) var models: [AgentModelEntry] = []
    /// The capabilities on offer, so casting a character can start the shot from their portrait.
    private(set) var apps: Set<String> = []
    private(set) var library: Load<[MediaItem]> = .idle
    private(set) var characters: Load<[Character]> = .idle
    private let api: API

    init(api: API) { self.api = api }

    func load() async {
        async let menu = try? api.listAgentModelMenu()
        async let labels = try? api.listCapabilityLabels()
        if let menu = await menu { models = menu }
        if let labels = await labels { apps = Set(labels.map(\.app)) }
    }

    /// The person's videos, for the agent to watch or work from.
    func loadLibrary() async {
        if case .loaded = library {} else { library = .loading }
        do { library = .loaded(try await api.searchLibrary(kind: "video")) } catch { if case .loaded = library {} else { library = .failed } }
    }

    /// Characters the person can put on screen: their own first, then the public ones.
    func loadCharacters() async {
        if case .loaded = characters {} else { characters = .loading }
        do {
            let all = try await api.listCharacters()
            characters = .loaded(all.filter(\.mine) + all.filter { !$0.mine })
        } catch {
            if case .loaded = characters {} else { characters = .failed }
        }
    }

    /// Forgets what belonged to the person who was signed in.
    func signedOut() {
        library = .idle
        characters = .idle
    }

    /// Puts a character on screen. The shot starts from their portrait, so it becomes image to video
    /// when the network offers it.
    func cast(_ character: Character, into draft: inout Draft) {
        draft.cast = CharacterCast(slug: character.slug, name: character.name, image: character.image)
        if apps.contains("image-to-video") { draft.app = "image-to-video" }
    }
}

/// Which composer tray is open.
enum ComposerTray: Int, Identifiable {
    case attach, cast
    var id: Int { rawValue }
}

extension View {
    /// The attach and cast trays for a composer's draft. A guest is asked to sign in first.
    func composerTrays(draft: Binding<Draft>, open: Binding<ComposerTray?>) -> some View {
        tray(item: open, title: { $0 == .attach ? "Attach from your library" : "Put a character in it" }) { which in
            switch which {
            case .attach: AttachTray(draft: draft)
            case .cast: CastTray(draft: draft) { open.wrappedValue = nil }
            }
        }
    }
}

/// Library videos to attach. Each tap adds or removes one; the tray stays open to pick several.
private struct AttachTray: View {
    @Binding var draft: Draft
    @Environment(ComposerSupport.self) private var support
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("The agent can watch a video, summarise it, find moments and work from it.").text(.body).foregroundStyle(palette.mutedForeground)
            switch support.library {
            case .idle, .loading: PickerSkeleton(aspect: 16 / 9)
            case .failed: LoadFailure(message: "Your library didn't load.") { Task { await support.loadLibrary() } }
            case .loaded(let items) where items.isEmpty:
                Text("Nothing in your library yet. Shots you generate are saved there.").text(.body).foregroundStyle(palette.mutedForeground)
            case .loaded(let items):
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                    ForEach(items, id: \.id) { item in
                        let attached = draft.attachments.contains { $0.id == item.id }
                        Button {
                            if attached { draft.attachments.removeAll { $0.id == item.id } } else { draft.attachments.append(item) }
                        } label: {
                            Color.clear
                                .aspectRatio(16 / 9, contentMode: .fit)
                                .overlay { MediaStill(image: item.image, artwork: item.artwork) }
                                .overlay(alignment: .topTrailing) {
                                    if attached {
                                        Image(systemName: "checkmark").font(.system(size: 10, weight: .bold)).foregroundStyle(palette.primaryForeground)
                                            .frame(width: 20, height: 20).background(palette.primary, in: Circle()).padding(5)
                                    }
                                }
                                .clipShape(RoundedRectangle(cornerRadius: Radius.field, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: Radius.field, style: .continuous).strokeBorder(attached ? palette.foreground : palette.hairline, lineWidth: attached ? 2 : 1))
                        }
                        .buttonStyle(PressStyle())
                        .accessibilityLabel(item.title)
                        .accessibilityAddTraits(attached ? .isSelected : [])
                    }
                }
                .sensoryFeedback(.selection, trigger: draft.attachments.count)
            }
        }
        .task { await support.loadLibrary() }
    }
}

/// Characters to put on screen. Picking one closes the tray.
private struct CastTray: View {
    @Binding var draft: Draft
    let done: () -> Void
    @Environment(ComposerSupport.self) private var support
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Their portrait becomes the first frame, so they look like themselves in every shot.").text(.body).foregroundStyle(palette.mutedForeground)
            switch support.characters {
            case .idle, .loading: PickerSkeleton(aspect: 3 / 4)
            case .failed: LoadFailure(message: "Characters didn't load.") { Task { await support.loadCharacters() } }
            case .loaded(let characters) where characters.isEmpty:
                Text("No characters yet. Make one on the web and it shows up here.").text(.body).foregroundStyle(palette.mutedForeground)
            case .loaded(let characters):
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 10) {
                    ForEach(characters, id: \.slug) { character in
                        Button {
                            support.cast(character, into: &draft)
                            done()
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                Color.clear
                                    .aspectRatio(3 / 4, contentMode: .fit)
                                    .overlay { MediaStill(image: character.image, artwork: character.artwork) }
                                    .clipShape(RoundedRectangle(cornerRadius: Radius.field, style: .continuous))
                                    .overlay(RoundedRectangle(cornerRadius: Radius.field, style: .continuous).strokeBorder(draft.cast?.slug == character.slug ? palette.foreground : palette.hairline, lineWidth: draft.cast?.slug == character.slug ? 2 : 1))
                                Text(character.name).text(.caption, weight: .medium).foregroundStyle(palette.foreground).lineLimit(1)
                            }
                        }
                        .buttonStyle(PressStyle())
                        .accessibilityLabel("\(character.name), \(character.tagline)")
                    }
                }
            }
        }
        .task { await support.loadCharacters() }
    }
}

/// A picker grid's shape while it loads.
private struct PickerSkeleton: View {
    let aspect: CGFloat
    @Environment(\.palette) private var palette

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
            ForEach(0..<6, id: \.self) { _ in
                RoundedRectangle(cornerRadius: Radius.field, style: .continuous).fill(palette.card).aspectRatio(aspect, contentMode: .fit)
            }
        }
        .breathing()
        .accessibilityLabel("Loading")
    }
}
