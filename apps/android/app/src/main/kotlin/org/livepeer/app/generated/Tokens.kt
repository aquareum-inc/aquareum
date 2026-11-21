// Generated from packages/ui/src/styles/tokens.css and packages/ui/src/lib/motion.ts
// by packages/mobile-codegen. Do not edit: change the sources and run `pnpm mobile:generate`.

package org.livepeer.app.generated

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/** The colours of one theme. Token names match the web's CSS custom properties. */
@Immutable
data class Palette(
    val background: Color,
    val foreground: Color,
    val card: Color,
    val cardForeground: Color,
    val popover: Color,
    val popoverForeground: Color,
    val primary: Color,
    val primaryForeground: Color,
    val secondary: Color,
    val secondaryForeground: Color,
    val muted: Color,
    val mutedForeground: Color,
    val accent: Color,
    val accentForeground: Color,
    val destructive: Color,
    val destructiveFill: Color,
    val border: Color,
    val input: Color,
    val ring: Color,
    val brand: Color,
    val brandFill: Color,
    val auroraTeal: Color,
    val auroraViolet: Color,
    val surfaceLifted: Color,
    val surfaceLiftedEdge: Color,
    val panel: Color,
    val hairline: Color,
    val frameEdge: Color,
    val hover: Color,
    val active: Color,
    val subtleForeground: Color,
    val overlay: Color,
    val glassFill: Color,
    val glassEdge: Color,
    val glassMenuFill: Color,
) {
    /** Sets a token by its CSS name, for an instance's theme overrides. Unknown names are ignored. */
    fun with(token: String, colour: Color): Palette = when (token) {
        "background" -> copy(background = colour)
        "foreground" -> copy(foreground = colour)
        "card" -> copy(card = colour)
        "card-foreground" -> copy(cardForeground = colour)
        "popover" -> copy(popover = colour)
        "popover-foreground" -> copy(popoverForeground = colour)
        "primary" -> copy(primary = colour)
        "primary-foreground" -> copy(primaryForeground = colour)
        "secondary" -> copy(secondary = colour)
        "secondary-foreground" -> copy(secondaryForeground = colour)
        "muted" -> copy(muted = colour)
        "muted-foreground" -> copy(mutedForeground = colour)
        "accent" -> copy(accent = colour)
        "accent-foreground" -> copy(accentForeground = colour)
        "destructive" -> copy(destructive = colour)
        "destructive-fill" -> copy(destructiveFill = colour)
        "border" -> copy(border = colour)
        "input" -> copy(input = colour)
        "ring" -> copy(ring = colour)
        "brand" -> copy(brand = colour)
        "brand-fill" -> copy(brandFill = colour)
        "aurora-teal" -> copy(auroraTeal = colour)
        "aurora-violet" -> copy(auroraViolet = colour)
        "surface-lifted" -> copy(surfaceLifted = colour)
        "surface-lifted-edge" -> copy(surfaceLiftedEdge = colour)
        "panel" -> copy(panel = colour)
        "hairline" -> copy(hairline = colour)
        "frame-edge" -> copy(frameEdge = colour)
        "hover" -> copy(hover = colour)
        "active" -> copy(active = colour)
        "subtle-foreground" -> copy(subtleForeground = colour)
        "overlay" -> copy(overlay = colour)
        "glass-fill" -> copy(glassFill = colour)
        "glass-edge" -> copy(glassEdge = colour)
        "glass-menu-fill" -> copy(glassMenuFill = colour)
        else -> this
    }

    companion object {
        val Dark = Palette(
            background = Color(0xFF070707),
            foreground = Color(0xFFFAFAFA),
            card = Color(0xFF181818),
            cardForeground = Color(0xFFFAFAFA),
            popover = Color(0xFF1E1E1E),
            popoverForeground = Color(0xFFFAFAFA),
            primary = Color(0xFFE5E5E5),
            primaryForeground = Color(0xFF171717),
            secondary = Color(0xFF262626),
            secondaryForeground = Color(0xFFFAFAFA),
            muted = Color(0xFF0D0D0D),
            mutedForeground = Color(0xFFA1A1A1),
            accent = Color(0xFF262626),
            accentForeground = Color(0xFFFAFAFA),
            destructive = Color(0xFFFF6467),
            destructiveFill = Color(0xFFD42F34),
            border = Color(0x1AFFFFFF),
            input = Color(0x26FFFFFF),
            ring = Color(0xFF737373),
            brand = Color(0xFF40BF86),
            brandFill = Color(0xFF40BF86),
            auroraTeal = Color(0xFF44D0C1),
            auroraViolet = Color(0xFF8968F4),
            surfaceLifted = Color(0xFF1F1F1F),
            surfaceLiftedEdge = Color(0xFF363636),
            panel = Color(0xFF0F0F0F),
            hairline = Color(0x14FFFFFF),
            frameEdge = Color(0x1CFFFFFF),
            hover = Color(0x0AFAFAFA),
            active = Color(0x12FAFAFA),
            subtleForeground = Color(0x80FAFAFA),
            overlay = Color(0x99000000),
            glassFill = Color(0x0FFFFFFF),
            glassEdge = Color(0x1FFFFFFF),
            glassMenuFill = Color(0x941E1F22),
        )

        val Light = Palette(
            background = Color(0xFFF4F4F5),
            foreground = Color(0xFF1E1E21),
            card = Color(0xFFFFFFFF),
            cardForeground = Color(0xFF1E1E21),
            popover = Color(0xFFFFFFFF),
            popoverForeground = Color(0xFF1E1E21),
            primary = Color(0xFF17171A),
            primaryForeground = Color(0xFFFAFAFA),
            secondary = Color(0xFFF5F5F6),
            secondaryForeground = Color(0xFF17171A),
            muted = Color(0xFFF5F5F6),
            mutedForeground = Color(0xFF62626A),
            accent = Color(0xFFF1F1F4),
            accentForeground = Color(0xFF17171A),
            destructive = Color(0xFFE7000B),
            destructiveFill = Color(0xFFE7000B),
            border = Color(0xFFE2E2E5),
            input = Color(0xFFE2E2E5),
            ring = Color(0xFF9E9EA5),
            brand = Color(0xFF1E9960),
            brandFill = Color(0xFF38B47E),
            auroraTeal = Color(0xFF009B95),
            auroraViolet = Color(0xFF7552DB),
            surfaceLifted = Color(0xFFFFFFFF),
            surfaceLiftedEdge = Color(0xFFE0E0E1),
            panel = Color(0xFFFDFDFD),
            hairline = Color(0x1A21202B),
            frameEdge = Color(0x1A21202B),
            hover = Color(0x0D1E1E21),
            active = Color(0x141E1E21),
            subtleForeground = Color(0x731E1E21),
            overlay = Color(0x5218181B),
            glassFill = Color(0x85FFFFFF),
            glassEdge = Color(0xA6FFFFFF),
            glassMenuFill = Color(0xB3FCFCFC),
        )
    }
}

/** Corner radii, in dp. */
object Radius {
    const val Field = 12
    const val Media = 16
    const val Card = 20
    const val Sheet = 28
}

/** A text size and its line height, in sp at the default font scale. */
data class TypeSize(val size: Int, val line: Int) {
    companion object {
        val Caption = TypeSize(12, 16)
        val Body = TypeSize(14, 20)
        val Lead = TypeSize(16, 24)
        val Title = TypeSize(26, 32)
        val Display = TypeSize(40, 44)
    }
}

object Motion {
    /** Milliseconds. */
    const val Enter = 240
    const val Exit = 150
    const val Morph = 320
    const val Stagger = 50
    /** The control points of the one curve: cubic-bezier(0.19, 1, 0.22, 1). */
    val Curve = floatArrayOf(0.19f, 1f, 0.22f, 1f)
    const val SpringStiffness = 420f
    const val SpringDamping = 36f
    const val SpringMass = 1f
}
