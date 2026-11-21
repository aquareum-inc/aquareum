import SwiftUI

/// Stand-in for a generated frame while media is mocked: three soft light sources, as on the web.
/// Colours here are content, not interface tokens.
struct ArtworkView: View {
    let artwork: MockArtwork

    var body: some View {
        let hues = artwork.hues
        let seed = Int(artwork.seed)
        let x = (20 + Double(seed % 5) * 12) / 100
        let y = (25 + Double(seed % 3) * 18) / 100
        GeometryReader { proxy in
            let side = max(proxy.size.width, proxy.size.height)
            ZStack {
                hsl(hues[2], 0.30, 0.09)
                RadialGradient(colors: [hsl(hues[0], 0.78, 0.62).opacity(0.95), .clear], center: UnitPoint(x: x, y: y), startRadius: 0, endRadius: side * 0.62)
                RadialGradient(colors: [hsl(hues[1], 0.82, 0.58).opacity(0.85), .clear], center: UnitPoint(x: 1 - x, y: y + 0.3), startRadius: 0, endRadius: side * 0.56)
                RadialGradient(colors: [hsl(hues[2], 0.70, 0.40).opacity(0.9), .clear], center: UnitPoint(x: 0.5, y: 1.1), startRadius: 0, endRadius: side * 0.8)
                LinearGradient(colors: [.clear, .black.opacity(0.45)], startPoint: UnitPoint(x: 0.5, y: 0.55), endPoint: .bottom)
            }
        }
        .accessibilityHidden(true)
    }

    private func hsl(_ hue: Double, _ saturation: Double, _ lightness: Double) -> Color {
        let value = lightness + saturation * min(lightness, 1 - lightness)
        return Color(hue: (hue.truncatingRemainder(dividingBy: 360)) / 360, saturation: value == 0 ? 0 : 2 * (1 - lightness / value), brightness: value)
    }
}

/// A still of some media when there is one; the stand-in artwork otherwise and while it loads.
struct MediaStill: View {
    let image: String?
    let artwork: MockArtwork

    var body: some View {
        ZStack {
            ArtworkView(artwork: artwork)
            if let image, let url = URL(string: image, relativeTo: BuildConfig.instanceURL) {
                AsyncImage(url: url, transaction: Transaction(animation: .enter)) { phase in
                    if let picture = phase.image { picture.resizable().scaledToFill() }
                }
            }
        }
        .accessibilityHidden(true)
    }
}

extension String {
    /// "16:9" → 16/9, for laying out a tile before its media exists.
    var aspectRatio: CGFloat {
        let parts = split(separator: ":").compactMap { Double($0) }
        return parts.count == 2 && parts[1] > 0 ? parts[0] / parts[1] : 16 / 9
    }
}
