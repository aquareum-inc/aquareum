// Generated from packages/ui/src/styles/tokens.css and packages/ui/src/lib/motion.ts
// by packages/mobile-codegen. Do not edit: change the sources and run `pnpm mobile:generate`.

import SwiftUI

/// The colours of one theme. Token names match the web's CSS custom properties.
struct Palette: Equatable, Sendable {
    var background: Color
    var foreground: Color
    var card: Color
    var cardForeground: Color
    var popover: Color
    var popoverForeground: Color
    var primary: Color
    var primaryForeground: Color
    var secondary: Color
    var secondaryForeground: Color
    var muted: Color
    var mutedForeground: Color
    var accent: Color
    var accentForeground: Color
    var destructive: Color
    var destructiveFill: Color
    var border: Color
    var input: Color
    var ring: Color
    var brand: Color
    var brandFill: Color
    var auroraTeal: Color
    var auroraViolet: Color
    var surfaceLifted: Color
    var surfaceLiftedEdge: Color
    var panel: Color
    var hairline: Color
    var frameEdge: Color
    var hover: Color
    var active: Color
    var subtleForeground: Color
    var overlay: Color
    var glassFill: Color
    var glassEdge: Color
    var glassMenuFill: Color

    static let dark = Palette(
        background: Color(rgba: 0x070707FF),
        foreground: Color(rgba: 0xFAFAFAFF),
        card: Color(rgba: 0x181818FF),
        cardForeground: Color(rgba: 0xFAFAFAFF),
        popover: Color(rgba: 0x1E1E1EFF),
        popoverForeground: Color(rgba: 0xFAFAFAFF),
        primary: Color(rgba: 0xE5E5E5FF),
        primaryForeground: Color(rgba: 0x171717FF),
        secondary: Color(rgba: 0x262626FF),
        secondaryForeground: Color(rgba: 0xFAFAFAFF),
        muted: Color(rgba: 0x0D0D0DFF),
        mutedForeground: Color(rgba: 0xA1A1A1FF),
        accent: Color(rgba: 0x262626FF),
        accentForeground: Color(rgba: 0xFAFAFAFF),
        destructive: Color(rgba: 0xFF6467FF),
        destructiveFill: Color(rgba: 0xD42F34FF),
        border: Color(rgba: 0xFFFFFF1A),
        input: Color(rgba: 0xFFFFFF26),
        ring: Color(rgba: 0x737373FF),
        brand: Color(rgba: 0x40BF86FF),
        brandFill: Color(rgba: 0x40BF86FF),
        auroraTeal: Color(rgba: 0x44D0C1FF),
        auroraViolet: Color(rgba: 0x8968F4FF),
        surfaceLifted: Color(rgba: 0x1F1F1FFF),
        surfaceLiftedEdge: Color(rgba: 0x363636FF),
        panel: Color(rgba: 0x0F0F0FFF),
        hairline: Color(rgba: 0xFFFFFF14),
        frameEdge: Color(rgba: 0xFFFFFF1C),
        hover: Color(rgba: 0xFAFAFA0A),
        active: Color(rgba: 0xFAFAFA12),
        subtleForeground: Color(rgba: 0xFAFAFA80),
        overlay: Color(rgba: 0x00000099),
        glassFill: Color(rgba: 0xFFFFFF0F),
        glassEdge: Color(rgba: 0xFFFFFF1F),
        glassMenuFill: Color(rgba: 0x1E1F2294)
    )

    static let light = Palette(
        background: Color(rgba: 0xF4F4F5FF),
        foreground: Color(rgba: 0x1E1E21FF),
        card: Color(rgba: 0xFFFFFFFF),
        cardForeground: Color(rgba: 0x1E1E21FF),
        popover: Color(rgba: 0xFFFFFFFF),
        popoverForeground: Color(rgba: 0x1E1E21FF),
        primary: Color(rgba: 0x17171AFF),
        primaryForeground: Color(rgba: 0xFAFAFAFF),
        secondary: Color(rgba: 0xF5F5F6FF),
        secondaryForeground: Color(rgba: 0x17171AFF),
        muted: Color(rgba: 0xF5F5F6FF),
        mutedForeground: Color(rgba: 0x62626AFF),
        accent: Color(rgba: 0xF1F1F4FF),
        accentForeground: Color(rgba: 0x17171AFF),
        destructive: Color(rgba: 0xE7000BFF),
        destructiveFill: Color(rgba: 0xE7000BFF),
        border: Color(rgba: 0xE2E2E5FF),
        input: Color(rgba: 0xE2E2E5FF),
        ring: Color(rgba: 0x9E9EA5FF),
        brand: Color(rgba: 0x1E9960FF),
        brandFill: Color(rgba: 0x38B47EFF),
        auroraTeal: Color(rgba: 0x009B95FF),
        auroraViolet: Color(rgba: 0x7552DBFF),
        surfaceLifted: Color(rgba: 0xFFFFFFFF),
        surfaceLiftedEdge: Color(rgba: 0xE0E0E1FF),
        panel: Color(rgba: 0xFDFDFDFF),
        hairline: Color(rgba: 0x21202B1A),
        frameEdge: Color(rgba: 0x21202B1A),
        hover: Color(rgba: 0x1E1E210D),
        active: Color(rgba: 0x1E1E2114),
        subtleForeground: Color(rgba: 0x1E1E2173),
        overlay: Color(rgba: 0x18181B52),
        glassFill: Color(rgba: 0xFFFFFF85),
        glassEdge: Color(rgba: 0xFFFFFFA6),
        glassMenuFill: Color(rgba: 0xFCFCFCB3)
    )

    /// Sets a token by its CSS name, for an instance's theme overrides. Unknown names are ignored.
    mutating func set(_ token: String, to colour: Color) {
        switch token {
        case "background": background = colour
        case "foreground": foreground = colour
        case "card": card = colour
        case "card-foreground": cardForeground = colour
        case "popover": popover = colour
        case "popover-foreground": popoverForeground = colour
        case "primary": primary = colour
        case "primary-foreground": primaryForeground = colour
        case "secondary": secondary = colour
        case "secondary-foreground": secondaryForeground = colour
        case "muted": muted = colour
        case "muted-foreground": mutedForeground = colour
        case "accent": accent = colour
        case "accent-foreground": accentForeground = colour
        case "destructive": destructive = colour
        case "destructive-fill": destructiveFill = colour
        case "border": border = colour
        case "input": input = colour
        case "ring": ring = colour
        case "brand": brand = colour
        case "brand-fill": brandFill = colour
        case "aurora-teal": auroraTeal = colour
        case "aurora-violet": auroraViolet = colour
        case "surface-lifted": surfaceLifted = colour
        case "surface-lifted-edge": surfaceLiftedEdge = colour
        case "panel": panel = colour
        case "hairline": hairline = colour
        case "frame-edge": frameEdge = colour
        case "hover": hover = colour
        case "active": active = colour
        case "subtle-foreground": subtleForeground = colour
        case "overlay": overlay = colour
        case "glass-fill": glassFill = colour
        case "glass-edge": glassEdge = colour
        case "glass-menu-fill": glassMenuFill = colour
        default: break
        }
    }
}

enum Radius {
    static let field: CGFloat = 12
    static let media: CGFloat = 16
    static let card: CGFloat = 20
    static let sheet: CGFloat = 28
}

/// A text size and its line height, in points at the default Dynamic Type size.
struct TypeSize: Sendable {
    let size: CGFloat
    let line: CGFloat

    static let caption = TypeSize(size: 12, line: 16)
    static let body = TypeSize(size: 14, line: 20)
    static let lead = TypeSize(size: 16, line: 24)
    static let title = TypeSize(size: 26, line: 32)
    static let display = TypeSize(size: 40, line: 44)
}

enum Motion {
    /// Seconds.
    static let enter: Double = 0.24
    static let exit: Double = 0.15
    static let morph: Double = 0.32
    static let stagger: Double = 0.05
    /// The control points of the one curve: cubic-bezier(0.19, 1, 0.22, 1).
    static let curve: (Double, Double, Double, Double) = (0.19, 1, 0.22, 1)
    static let springStiffness: Double = 420
    static let springDamping: Double = 36
    static let springMass: Double = 1
}
