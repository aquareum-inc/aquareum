import SwiftUI

/// A result is one tile from request to finish: present from the start, soft and breathing while it
/// renders, then the same tile sharpens. Finishing is marked once, with a green ring and a tap.
struct GenerationTile: View {
    /// Nil until the first read of the job: the tile is already there, at the requested shape.
    let generation: Generation?
    let aspect: String
    @State private var settled = false
    @State private var ring = false
    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var rendering: Bool { generation.map { $0.state == .queued || $0.state == .running } ?? true }
    private var failed: Bool { generation?.state == .failed }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Radius.media, style: .continuous)
        Color.clear
            .aspectRatio(aspect.aspectRatio, contentMode: .fit)
            .overlay {
                if let generation {
                    ArtworkView(artwork: generation.artwork)
                        .blur(radius: rendering ? 18 : 0)
                        .saturation(failed ? 0 : 1)
                        .opacity(failed ? 0.35 : 1)
                } else {
                    palette.card
                }
            }
            .breathing(rendering)
            .overlay(alignment: .bottomLeading) { caption.padding(10) }
            .clipShape(shape)
            .overlay(shape.strokeBorder(palette.hairline, lineWidth: 1))
            .overlay(shape.strokeBorder(palette.brand, lineWidth: 2).opacity(ring ? 1 : 0))
            .animation(reduceMotion ? .reduced : .easeOut(duration: 0.5), value: rendering)
            .sensoryFeedback(.success, trigger: settled)
            .onChange(of: generation?.state) { old, new in
                guard new == .succeeded, old == .queued || old == .running else { return }
                settled = true
                ring = true
                withAnimation(.easeOut(duration: 1.4)) { ring = false }
            }
            .accessibilityElement()
            .accessibilityLabel(label)
    }

    @ViewBuilder private var caption: some View {
        if failed {
            tag("Didn't render")
        } else if rendering {
            tag(generation.map { $0.state == .queued ? "Queued" : "\(Int(($0.progress * 100).rounded()))%" } ?? "Queued")
                .contentTransition(.numericText())
        } else if let seconds = generation?.request.durationSeconds {
            tag("\(Int(seconds))s")
        }
    }

    private func tag(_ text: String) -> some View {
        Text(text)
            .text(.caption, mono: true)
            .foregroundStyle(.white)
            .padding(.horizontal, 8)
            .frame(height: 24)
            .background(.black.opacity(0.45), in: Capsule())
    }

    private var label: String {
        guard let generation else { return "Shot, queued" }
        switch generation.state {
        case .succeeded: return "Shot: \(generation.request.prompt)"
        case .failed: return "This shot didn't render"
        default: return "Shot, rendering, \(Int((generation.progress * 100).rounded())) percent"
        }
    }
}
