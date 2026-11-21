import SwiftUI

/// What the composer holds before it is sent.
struct Draft: Equatable {
    var prompt = ""
    /// The capability a starting point, an example or a cast chose; nil lets the agent decide.
    var app: String?
    var aspect = "16:9"
    var durationSeconds: Double = 5
    /// Library items for the agent to watch or work from.
    var attachments: [MediaItem] = []
    /// A character to put on screen, starting from their portrait.
    var cast: CharacterCast?
    /// The language model that runs the agent; nil is Auto.
    var model: String?

    var isVideo: Bool { app?.contains("video") == true && app?.hasPrefix("live") == false }
    var canSend: Bool { !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !attachments.isEmpty }

    /// What is sent. With only attachments, it asks for the videos to be understood, as the web does.
    var text: String {
        let words = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        return words.isEmpty ? "Summarise this and list the key moments." : words
    }

    /// What carries on to the next message in a conversation: the same model, and the same cast.
    var carriedOn: Draft { Draft(app: cast == nil ? nil : app, cast: cast, model: model) }
}

/// What the composer can offer besides words, as the instance describes it.
struct ComposerChoices {
    /// The agent's model menu; shown only with two or more rows.
    var models: [AgentModelEntry] = []
    /// Whether a character can be put on screen.
    var casting = false
    /// Opens a tray to attach from the library, or to put a character in it.
    var attach: () -> Void = {}
    var castCharacter: () -> Void = {}
}

/// The one composer. It sits in the centre of Home and at the foot of a conversation, and holds the
/// view's one ink action: send.
struct Composer: View {
    @Binding var draft: Draft
    var choices = ComposerChoices()
    var placeholder = "A slow push along a harbour at first light…"
    var sending = false
    var focused: FocusState<Bool>.Binding
    let send: () -> Void
    @Environment(\.palette) private var palette
    @Environment(\.motion) private var motion
    @Namespace private var glide

    private static let aspects = ["16:9", "9:16", "1:1"]
    private static let durations: [Double] = [5, 10]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if draft.cast != nil || !draft.attachments.isEmpty || chosenModel != nil { chosen }
            HStack(alignment: .bottom, spacing: 8) {
                more
                // The field's own placeholder cuts off at one line; this one wraps, at any text size,
                // and the field grows to fit it.
                ZStack(alignment: .topLeading) {
                    if draft.prompt.isEmpty {
                        Text(placeholderText)
                            .text(.lead)
                            .foregroundStyle(palette.subtleForeground)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityHidden(true)
                    }
                    TextField("", text: $draft.prompt, axis: .vertical)
                        .lineLimit(1...6)
                        .text(.lead)
                        .foregroundStyle(palette.foreground)
                        .focused(focused)
                        .accessibilityLabel("Describe what you want to make")
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 10)
                // The placeholder can wrap past the field's one line; a tap anywhere on it starts typing.
                .contentShape(Rectangle())
                .onTapGesture { focused.wrappedValue = true }
                // With nothing else to set, send sits beside the words and the composer is one line tall.
                if !draft.isVideo { sendButton }
            }

            // Parameters appear with intent: only once the request is a video.
            if draft.isVideo {
                HStack(spacing: 8) {
                    Menu {
                        Picker("Shape", selection: $draft.aspect) {
                            ForEach(Self.aspects, id: \.self) { Text($0).tag($0) }
                        }
                    } label: {
                        parameter(draft.aspect, symbol: "aspectratio")
                    }
                    .accessibilityLabel("Shape, \(draft.aspect)")
                    Menu {
                        Picker("Length", selection: $draft.durationSeconds) {
                            ForEach(Self.durations, id: \.self) { Text("\(Int($0)) seconds").tag($0) }
                        }
                    } label: {
                        parameter("\(Int(draft.durationSeconds))s", symbol: "timer")
                    }
                    .accessibilityLabel("Length, \(Int(draft.durationSeconds)) seconds")
                    Spacer(minLength: 0)
                    sendButton
                }
                .transition(.opacity.combined(with: .offset(y: 6)))
            }
        }
        .animation(motion(.morph), value: draft.isVideo)
        .animation(motion(.morph), value: draft.attachments.count + (draft.cast == nil ? 0 : 1) + (draft.model == nil ? 0 : 1))
        .padding(.leading, 8)
        .padding(.trailing, 8)
        .padding(.vertical, 8)
        .glass(in: RoundedRectangle(cornerRadius: Radius.sheet, style: .continuous))
    }

    /// What to write, given what has been added: a cast asks for a scene, an attachment for a question.
    private var placeholderText: String {
        if let cast = draft.cast { return "Put \(cast.name) in a scene: where, doing what, in what light…" }
        if !draft.attachments.isEmpty { return "Ask about it, or send as it is for a summary and the key moments" }
        return placeholder
    }

    private var chosenModel: AgentModelEntry? {
        guard let model = draft.model, choices.models.count >= 2 else { return nil }
        return choices.models.first { $0.app == model || $0.also.contains(model) }
    }

    /// Everything besides words: attach, cast and the agent's model. One button, so the composer stays one line.
    private var more: some View {
        Menu {
            Button("Attach from your library", systemImage: "photo.on.rectangle.angled", action: choices.attach)
            if choices.casting {
                Button("Put a character in it", systemImage: "person.crop.rectangle", action: choices.castCharacter)
            }
            if choices.models.count >= 2 {
                Picker(selection: $draft.model) {
                    Text("Auto").tag(String?.none)
                    ForEach(choices.models, id: \.app) { entry in
                        Button {} label: {
                            Text(entry.name)
                            Text(entry.busy ? "Busy · \(entry.description)" : entry.description)
                        }
                        .tag(String?.some(entry.app))
                    }
                } label: {
                    Label("Model: \(chosenModel?.name ?? "Auto")", systemImage: "cpu")
                }
                .pickerStyle(.menu)
            }
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(palette.mutedForeground)
                .frame(width: 44, height: 44)
                .contentShape(Circle())
        }
        .accessibilityLabel("Add to the request")
    }

    /// What has been added, each removable: who is cast, what is attached, which model runs the agent.
    private var chosen: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 6) {
                if let cast = draft.cast {
                    token(cast.name.prefix(1).uppercased(), image: cast.image, label: "With \(cast.name)", remove: "Take \(cast.name) out") {
                        draft.cast = nil
                        if draft.app == "image-to-video" { draft.app = nil }
                    }
                }
                ForEach(draft.attachments, id: \.id) { item in
                    token(nil, image: item.image, label: item.title, remove: "Remove \(item.title)") {
                        draft.attachments.removeAll { $0.id == item.id }
                    }
                }
                if let model = chosenModel {
                    token(nil, symbol: "cpu", label: model.name, remove: "Back to Auto") { draft.model = nil }
                }
            }
            .padding(.leading, 10)
        }
        .scrollIndicators(.hidden)
        .transition(.opacity.combined(with: .offset(y: -4)))
    }

    private func token(_ initial: String?, image: String? = nil, symbol: String? = nil, label: String, remove: String, action: @escaping () -> Void) -> some View {
        HStack(spacing: 6) {
            if let symbol {
                Image(systemName: symbol).imageScale(.small).foregroundStyle(palette.mutedForeground)
            } else {
                ZStack {
                    Circle().fill(palette.secondary)
                    if let initial { Text(initial).font(.system(size: 10, weight: .semibold)).foregroundStyle(palette.foreground) }
                    if let image, let url = URL(string: image, relativeTo: BuildConfig.instanceURL) {
                        AsyncImage(url: url) { phase in phase.image?.resizable().scaledToFill() }
                    }
                }
                .frame(width: 20, height: 20)
                .clipShape(Circle())
            }
            Text(label).text(.caption, weight: .medium).foregroundStyle(palette.foreground).lineLimit(1)
            Button(action: action) {
                Image(systemName: "xmark").font(.system(size: 10, weight: .bold)).foregroundStyle(palette.mutedForeground).frame(width: 28, height: 28).contentShape(Circle())
            }
            .buttonStyle(PressStyle(round: true))
            .accessibilityLabel(remove)
        }
        .padding(.leading, 6)
        .frame(minHeight: 32)
        .background(palette.hover, in: Capsule())
        .overlay(Capsule().strokeBorder(palette.hairline, lineWidth: 1))
    }

    /// The view's one ink action. It is one button that glides between its two places.
    private var sendButton: some View {
        Button(action: send) {
            Image(systemName: sending ? "stop.fill" : "arrow.up")
                .font(.system(size: 17, weight: .semibold))
                .contentTransition(.symbolEffect(.replace))
                .foregroundStyle(palette.primaryForeground)
                .frame(width: 44, height: 44)
                .background(palette.primary, in: Circle())
                .opacity(draft.canSend || sending ? 1 : 0.35)
        }
        .buttonStyle(PressStyle(round: true))
        .disabled(!draft.canSend || sending)
        .accessibilityLabel(sending ? "Sending" : "Send")
        .matchedGeometryEffect(id: "send", in: glide)
    }

    private func parameter(_ label: String, symbol: String) -> some View {
        HStack(spacing: 5) {
            Image(systemName: symbol).imageScale(.small)
            Text(label).text(.caption, mono: true)
        }
        .foregroundStyle(palette.mutedForeground)
        .padding(.horizontal, 10)
        .frame(minHeight: 32)
        .background(palette.hover, in: Capsule())
        .overlay(Capsule().strokeBorder(palette.hairline, lineWidth: 1))
        .transition(.scale(scale: 0.9).combined(with: .opacity))
    }
}
