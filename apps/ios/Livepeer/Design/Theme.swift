import SwiftUI

extension Color {
    /// 0xRRGGBBAA in sRGB, as the token generator writes it.
    init(rgba: UInt32) {
        self.init(
            .sRGB,
            red: Double((rgba >> 24) & 0xFF) / 255,
            green: Double((rgba >> 16) & 0xFF) / 255,
            blue: Double((rgba >> 8) & 0xFF) / 255,
            opacity: Double(rgba & 0xFF) / 255
        )
    }

    /// "#RRGGBB" or "#RRGGBBAA", as the instance sends theme overrides.
    init?(hex: String) {
        let digits = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard digits.count == 6 || digits.count == 8, let value = UInt32(digits, radix: 16) else { return nil }
        self.init(rgba: digits.count == 6 ? (value << 8) | 0xFF : value)
    }
}

extension Palette {
    /// The default palette for a colour scheme with an instance's overrides applied.
    static func resolved(for scheme: ColorScheme, overrides: [String: String]) -> Palette {
        var palette = scheme == .dark ? Palette.dark : Palette.light
        for (token, hex) in overrides {
            if let colour = Color(hex: hex) { palette.set(token, to: colour) }
        }
        return palette
    }
}

extension EnvironmentValues {
    /// The colours of the current theme. Views read tokens from here, never literal colours.
    @Entry var palette: Palette = .dark
}

/// Which faces set the interface. Mono always sets facts: prices, counts, durations and ids.
enum Typeface {
    static let mono = "GeistMono-Regular"
    static let monoMedium = "GeistMono-Medium"
}

/// Sets text at a token size that follows Dynamic Type, with the token's line height.
private struct TokenText: ViewModifier {
    let size: TypeSize
    let weight: Font.Weight
    let mono: Bool
    @ScaledMetric(relativeTo: .body) private var scale: CGFloat = 1

    func body(content: Content) -> some View {
        let points = size.size * scale
        content
            .font(mono ? .custom(weight == .regular ? Typeface.mono : Typeface.monoMedium, fixedSize: points) : .system(size: points, weight: weight))
            .lineSpacing(max(0, (size.line - size.size * 1.2) * scale))
    }
}

extension View {
    func text(_ size: TypeSize, weight: Font.Weight = .regular, mono: Bool = false) -> some View {
        modifier(TokenText(size: size, weight: weight, mono: mono))
    }
}

extension Animation {
    /// The one curve, at the entrance duration.
    static let enter = Animation.timingCurve(Motion.curve.0, Motion.curve.1, Motion.curve.2, Motion.curve.3, duration: Motion.enter)
    /// Exits are faster than entrances.
    static let exit = Animation.timingCurve(Motion.curve.0, Motion.curve.1, Motion.curve.2, Motion.curve.3, duration: Motion.exit)
    /// A control changing shape in place.
    static let morph = Animation.timingCurve(Motion.curve.0, Motion.curve.1, Motion.curve.2, Motion.curve.3, duration: Motion.morph)
    /// Layout and shared-element moves.
    static let layout = Animation.interpolatingSpring(mass: Motion.springMass, stiffness: Motion.springStiffness, damping: Motion.springDamping)
    /// What movement becomes when the user has asked for less of it.
    static let reduced = Animation.easeOut(duration: 0.12)
}

/// Runs a change with the given animation, or a short fade when Reduce Motion is on.
struct MotionPreference {
    let reduce: Bool
    func callAsFunction(_ animation: Animation) -> Animation { reduce ? .reduced : animation }
}

extension EnvironmentValues {
    var motion: MotionPreference { MotionPreference(reduce: accessibilityReduceMotion) }
}
