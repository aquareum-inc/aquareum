import SwiftUI

/// One character: who they are, casting them in a scene, and, for someone else's, reporting or blocking it.
struct CharacterView: View {
    let character: Character
    let model: CharactersModel
    /// Leaves the character once it's blocked.
    let leave: () -> Void
    @State private var reporting: Character?
    @State private var confirmingBlock = false
    @State private var blockFailed = false
    @Environment(Account.self) private var account
    @Environment(\.castInScene) private var castInScene
    @Environment(\.palette) private var palette

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                CharacterPortrait(character: character)
                    .aspectRatio(4 / 5, contentMode: .fit)
                    .frame(maxWidth: 220)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(palette.hairline, lineWidth: 1))
                    .frame(maxWidth: .infinity)

                Text(character.name).text(.title, weight: .semibold).foregroundStyle(palette.foreground).padding(.top, 20)
                Text(character.tagline).text(.lead).foregroundStyle(palette.mutedForeground).padding(.top, 4)
                HStack(spacing: 10) {
                    Text("by \(character.author)")
                    if character.chats > 0 { CharacterStats(character: character) }
                }
                .text(.caption, mono: true)
                .foregroundStyle(palette.subtleForeground)
                .padding(.top, 8)
                Text(character.description).text(.body).foregroundStyle(palette.foreground).padding(.top, 16)

                // Casting comes first: characters are for putting on screen.
                PrimaryButton(label: "Cast \(character.name) in a scene") { castInScene(character) }
                    .padding(.top, 24)
                Text(character.image == nil ? "Describe a scene and they'll play it, in character." : "Their portrait is the first frame, so they look like themselves in every shot.")
                    .text(.caption).foregroundStyle(palette.mutedForeground).padding(.top, 8)

                VStack(alignment: .leading, spacing: 6) {
                    Text("How they open").text(.caption, weight: .medium).foregroundStyle(palette.subtleForeground)
                    Text("“\(character.greeting)”").text(.body).italic().foregroundStyle(palette.mutedForeground)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(palette.hairline, lineWidth: 1))
                .padding(.top, 24)
            }
            .padding(16)
        }
        .background(palette.background)
        .navigationTitle(character.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if !character.mine {
                Menu("More", systemImage: "ellipsis") {
                    Button("Report \(character.name)…", systemImage: "flag") {
                        Task { if await account.requireSignIn("Sign in to report a character.") { reporting = character } }
                    }
                    Button("Block \(character.name)", systemImage: "hand.raised", role: .destructive) {
                        Task { if await account.requireSignIn("Sign in to block a character.") { confirmingBlock = true } }
                    }
                }
            }
        }
        .tray(item: $reporting, title: { "Report \($0.name)" }) { character in
            ReportTray(character: character, model: model) { reporting = nil }
        }
        .alert("Block \(character.name)?", isPresented: $confirmingBlock) {
            Button("Cancel", role: .cancel) {}
            Button("Block", role: .destructive) {
                Task { if await model.block(character) { leave() } else { blockFailed = true } }
            }
        } message: {
            Text("You won't see \(character.name) or anything else by \(character.author) again.")
        }
        .alert("That didn't go through", isPresented: $blockFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("\(character.name) isn't blocked. Check your connection and try again.")
        }
    }
}

extension Character: Identifiable {
    var id: String { slug }
}

/// Why someone is reporting a character, and anything they want to add. Goes to the instance's operator.
private struct ReportTray: View {
    let character: Character
    let model: CharactersModel
    let close: () -> Void
    @State private var reason: ReportReason?
    @State private var note = ""
    @State private var sending = false
    @State private var sent = false
    @State private var failed = false
    @Environment(InstanceStore.self) private var instance
    @Environment(\.palette) private var palette

    var body: some View {
        if sent {
            VStack(alignment: .leading, spacing: 16) {
                Text("Thanks. The people who run \(instance.description?.name ?? "this service") will look at it. You can also block \(character.name) so you don't see them again.")
                    .text(.body).foregroundStyle(palette.foreground)
                PrimaryButton(label: "Done", action: close)
            }
        } else {
            VStack(alignment: .leading, spacing: 14) {
                VStack(spacing: 0) {
                    ForEach(ReportReason.offered, id: \.self) { option in
                        Button { reason = option } label: {
                            HStack {
                                Text(option.label).text(.body).foregroundStyle(palette.foreground)
                                Spacer()
                                Image(systemName: reason == option ? "largecircle.fill.circle" : "circle")
                                    .foregroundStyle(reason == option ? palette.foreground : palette.subtleForeground)
                            }
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(reason == option ? .isSelected : [])
                        if option != ReportReason.offered.last { Divider().overlay(palette.hairline) }
                    }
                }
                TextField("Anything to add (optional)", text: $note, axis: .vertical)
                    .lineLimit(2...4)
                    .text(.body)
                    .padding(12)
                    .background(palette.muted, in: RoundedRectangle(cornerRadius: Radius.field, style: .continuous))
                    .onChange(of: note) { _, value in if value.count > 500 { note = String(value.prefix(500)) } }
                if failed {
                    Text("That didn't send. Check your connection and try again.").text(.caption).foregroundStyle(palette.destructive)
                }
                PrimaryButton(label: "Send report", busy: sending) {
                    guard let reason else { return }
                    sending = true
                    failed = false
                    Task {
                        sent = await model.report(character, reason: reason, note: note)
                        failed = !sent
                        sending = false
                    }
                }
                .disabled(reason == nil || sending)
            }
        }
    }
}
