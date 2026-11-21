import SwiftUI

/// Who a new character is, how they look and move, and how they speak.
struct NewCharacterView: View {
    let model: CharactersModel
    let created: (Character) -> Void
    @State private var draft = CharacterDraft()
    @State private var saving = false
    @State private var failed = false
    @Environment(\.dismiss) private var dismiss
    @Environment(\.palette) private var palette

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    field("Name", text: $draft.name, limit: CharacterDraft.limits.name, prompt: "Mara")
                }
                Section {
                    field("One line about them", text: $draft.tagline, limit: CharacterDraft.limits.tagline, prompt: "A film director who thinks in shots.")
                } header: {
                    Text("One line about them")
                } footer: {
                    Text("Shown under their name.")
                }
                Section {
                    field("Who they are", text: $draft.description, limit: CharacterDraft.limits.description, prompt: "How they look, move and speak, and what they care about", lines: 5...12)
                } header: {
                    Text("Who they are")
                } footer: {
                    Text("Every scene keeps them in character from this.")
                }
                Section {
                    field("How they open", text: $draft.greeting, limit: CharacterDraft.limits.greeting, prompt: "Tell me what the audience should feel in the last frame.", lines: 2...5)
                } header: {
                    Text("How they open")
                } footer: {
                    Text("The first thing they say.")
                }
                Section {
                    Toggle("Share with everyone here", isOn: $draft.shared)
                } footer: {
                    Text("Off keeps the character private to you.")
                }
                if failed {
                    Text("That didn't save. Try again.").foregroundStyle(palette.destructive)
                }
            }
            .scrollContentBackground(.hidden)
            .background(palette.background)
            .navigationTitle("New character")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving {
                        ProgressView()
                    } else {
                        Button("Create") {
                            saving = true
                            failed = false
                            Task {
                                do { created(try await model.create(draft)) } catch { failed = true }
                                saving = false
                            }
                        }
                        .disabled(!draft.canCreate)
                    }
                }
            }
        }
        .tint(palette.foreground)
        .interactiveDismissDisabled(draft != CharacterDraft())
    }

    private func field(_ label: String, text: Binding<String>, limit: Int, prompt: String, lines: ClosedRange<Int> = 1...2) -> some View {
        TextField(label, text: text, prompt: Text(prompt), axis: .vertical)
            .lineLimit(lines)
            .accessibilityLabel(label)
            .onChange(of: text.wrappedValue) { _, value in if value.count > limit { text.wrappedValue = String(value.prefix(limit)) } }
    }
}
