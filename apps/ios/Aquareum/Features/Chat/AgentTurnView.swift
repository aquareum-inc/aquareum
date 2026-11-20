import SwiftUI

/// One turn of the agent. While it works each tool call is a step; when it finishes the steps fold
/// to one line that opens again in place. Shots appear under the steps that made them.
struct AgentTurnView: View {
    let turn: AgentMessage
    let generations: [String: Generation]
    let labels: [String: String]
    let aspect: String
    @State private var expanded = false
    @Environment(\.palette) private var palette
    @Environment(\.motion) private var motion

    private var working: Bool { turn.state == .working }
    private var open: Bool { working || expanded }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            BrandSymbol()
                .frame(width: 12, height: 12)
                .frame(width: 28, height: 28)
                .overlay(Circle().strokeBorder(palette.hairline, lineWidth: 1))

            VStack(alignment: .leading, spacing: 12) {
                summary
                if open, !turn.steps.isEmpty {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(turn.steps.enumerated()), id: \.element.id) { index, step in
                            StepRow(step: step, label: step.app.map { labels[$0] ?? $0 }, last: index == turn.steps.count - 1)
                        }
                    }
                    .transition(.opacity.combined(with: .offset(y: -4)))
                }
                if !turn.generationIds.isEmpty {
                    VStack(spacing: 12) {
                        ForEach(turn.generationIds, id: \.self) { id in
                            GenerationTile(generation: generations[id], aspect: generations[id]?.request.aspect.rawValue ?? aspect)
                        }
                    }
                }
                if let moments = turn.analysis?.moments, !moments.isEmpty {
                    MomentList(moments: moments)
                }
                if let text = turn.text {
                    Text(text)
                        .text(.lead)
                        .foregroundStyle(palette.foreground)
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)
                        .transition(.opacity)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .animation(motion(.morph), value: open)
        .animation(motion(.enter), value: turn.text)
    }

    @ViewBuilder private var summary: some View {
        if working {
            let running = turn.steps.first { $0.state == .running }
            Text("\(running?.title ?? "Starting")…")
                .text(.body)
                .foregroundStyle(palette.mutedForeground)
                .breathing()
                .frame(minHeight: 28)
                .accessibilityAddTraits(.updatesFrequently)
        } else {
            Button {
                expanded.toggle()
            } label: {
                HStack(spacing: 6) {
                    Text("Worked for \(max(1, Int((turn.elapsedMs / 1000).rounded())))s · \(turn.steps.count) \(turn.steps.count == 1 ? "step" : "steps")")
                        .foregroundStyle(palette.mutedForeground)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(palette.mutedForeground)
                        .rotationEffect(.degrees(expanded ? 180 : 0))
                }
                .text(.body)
                .frame(minHeight: 28)
                .contentShape(Rectangle())
            }
            .buttonStyle(PressStyle())
            .accessibilityHint(expanded ? "Hides the steps" : "Shows the steps")
        }
    }
}

private struct StepRow: View {
    let step: AgentStep
    let label: String?
    let last: Bool
    @Environment(\.palette) private var palette

    private var symbol: String {
        if step.state == .done { return "checkmark" }
        switch step.kind {
        case .plan: return "list.bullet.indent"
        case .review: return "eye"
        default: return "wrench.adjustable"
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(step.state == .running ? palette.foreground : palette.mutedForeground)
                .frame(width: 24, height: 24)
                .overlay(Circle().strokeBorder(palette.hairline, lineWidth: 1))
                .breathing(step.state == .running)
            VStack(alignment: .leading, spacing: 3) {
                Text(step.title).text(.body, weight: .medium).foregroundStyle(palette.foreground).fixedSize(horizontal: false, vertical: true)
                if let label {
                    Text(label)
                        .text(.caption, mono: true)
                        .foregroundStyle(palette.mutedForeground)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(palette.active, in: Capsule())
                }
                Text(step.detail).text(.caption).foregroundStyle(palette.mutedForeground).fixedSize(horizontal: false, vertical: true)
            }
            .padding(.bottom, last ? 0 : 16)
        }
        // The line that joins a step to the next, from under its mark to the top of the following one.
        .background(alignment: .topLeading) {
            if !last { Rectangle().fill(palette.border).frame(width: 1).padding(.top, 28).padding(.bottom, 4).padding(.leading, 11.5) }
        }
        .opacity(step.state == .pending ? 0.4 : 1)
        .accessibilityElement(children: .combine)
    }
}

/// The moments a video analysis found, each with where it is.
private struct MomentList: View {
    let moments: [VideoMoment]
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(moments.enumerated()), id: \.offset) { index, moment in
                HStack(spacing: 12) {
                    let whole = Int(moment.atSeconds)
                    Text("\(whole / 60):\(String(format: "%02d", whole % 60))")
                        .text(.caption, mono: true)
                        .foregroundStyle(palette.mutedForeground)
                        .frame(width: 48, height: 22)
                        .background(palette.active, in: Capsule())
                    Text(moment.label).text(.body).foregroundStyle(palette.foreground).frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                if index < moments.count - 1 { Rectangle().fill(palette.hairline).frame(height: 1) }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(palette.hairline, lineWidth: 1))
    }
}
