import SwiftUI

/// What the composer holds before it is sent.
struct Draft: Equatable {
    var prompt = ""
    /// The capability a starting point or an example chose; nil lets the agent decide.
    var app: String?
    var aspect = "16:9"
    var durationSeconds: Double = 5

    var isVideo: Bool { app?.contains("video") == true && app?.hasPrefix("live") == false }
    var canSend: Bool { !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
}

/// The one composer. It sits in the centre of Home and at the foot of a conversation, and holds the
/// view's one ink action: send.
struct Composer: View {
    @Binding var draft: Draft
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
            HStack(alignment: .bottom, spacing: 8) {
                // The field's own placeholder cuts off at one line; this one wraps, at any text size,
                // and the field grows to fit it.
                ZStack(alignment: .topLeading) {
                    if draft.prompt.isEmpty {
                        Text(placeholder)
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
        .padding(.leading, 18)
        .padding(.trailing, 8)
        .padding(.vertical, 8)
        .glass(in: RoundedRectangle(cornerRadius: Radius.sheet, style: .continuous))
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
