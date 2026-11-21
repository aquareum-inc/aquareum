package org.livepeer.app.design

import android.provider.Settings
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import org.livepeer.app.R
import org.livepeer.app.generated.Motion
import org.livepeer.app.generated.Palette
import org.livepeer.app.generated.TypeSize

/** The colours of the current theme. Composables read tokens from here, never literal colours. */
val LocalPalette = staticCompositionLocalOf { Palette.Dark }

/** Whether the current theme is dark: the system's, unless the person chose one. */
val LocalDarkTheme = staticCompositionLocalOf { true }

/** "#RRGGBB" or "#RRGGBBAA", as the instance sends theme overrides. */
fun parseHex(hex: String): Color? {
    val digits = hex.removePrefix("#")
    val value = digits.toLongOrNull(16) ?: return null
    return when (digits.length) {
        6 -> Color(0xFF000000 or value)
        8 -> Color(((value and 0xFF) shl 24) or (value shr 8))
        else -> null
    }
}

/** The default palette for a theme with an instance's overrides applied. */
fun Palette.Companion.resolved(dark: Boolean, overrides: Map<String, String>): Palette =
    overrides.entries.fold(if (dark) Dark else Light) { palette, (token, hex) -> parseHex(hex)?.let { palette.with(token, it) } ?: palette }

/** Mono sets facts: prices, counts, durations and ids. */
val Mono = FontFamily(Font(R.font.geist_mono_regular, FontWeight.Normal), Font(R.font.geist_mono_medium, FontWeight.Medium))

/** Text at a token size. Sizes are in sp, so they follow the system font scale. */
fun TypeSize.style(weight: FontWeight = FontWeight.Normal, mono: Boolean = false): TextStyle =
    TextStyle(fontSize = size.sp, lineHeight = line.sp, fontWeight = weight, fontFamily = if (mono) Mono else FontFamily.Default)

/** The one curve. */
val EaseOutExpo = CubicBezierEasing(Motion.Curve[0], Motion.Curve[1], Motion.Curve[2], Motion.Curve[3])

/** How things move, or a short fade's worth of time when the user has asked for less movement. */
class MotionSpec(val reduce: Boolean) {
    fun <T> enter(): FiniteAnimationSpec<T> = tween(if (reduce) 120 else Motion.Enter, easing = EaseOutExpo)
    fun <T> exit(): FiniteAnimationSpec<T> = tween(if (reduce) 120 else Motion.Exit, easing = EaseOutExpo)
    fun <T> morph(): FiniteAnimationSpec<T> = tween(if (reduce) 120 else Motion.Morph, easing = EaseOutExpo)
    /** Layout and shared-element moves. */
    fun <T> layout(): FiniteAnimationSpec<T> = if (reduce) tween(120) else spring(dampingRatio = Motion.SpringDamping / (2 * kotlin.math.sqrt(Motion.SpringStiffness * Motion.SpringMass)), stiffness = Motion.SpringStiffness)
}

/** True when the user has turned animations off for the device. */
@Composable
fun rememberMotion(): MotionSpec {
    val resolver = LocalContext.current.contentResolver
    return remember(resolver) { MotionSpec(reduce = Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f) }
}
