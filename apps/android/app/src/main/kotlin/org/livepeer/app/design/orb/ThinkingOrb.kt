package org.livepeer.app.design.orb

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import org.livepeer.app.design.LocalDarkTheme
import org.livepeer.app.design.rememberMotion
import kotlin.math.roundToInt

/**
 * The agent's thinking orb at the library's 20-point design: light ink on the dark theme, dark on the light.
 * It moves only while the app is in front, holds one frame when paused or with animations off, and is hidden from TalkBack
 * because the words beside it say what is happening.
 */
@Composable
fun ThinkingOrb(state: OrbState, modifier: Modifier = Modifier, paused: Boolean = false) {
    val preset = remember(state) { preset(state) }
    val dark = LocalDarkTheme.current
    val still = paused || rememberMotion().reduce
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    // One shared clock, as on the web and iOS, so the orb's phase doesn't jump when its state changes.
    var seconds by remember { mutableDoubleStateOf(System.currentTimeMillis() / 1000.0) }
    LaunchedEffect(still, lifecycle) {
        if (still) return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (true) withFrameMillis { seconds = System.currentTimeMillis() / 1000.0 }
        }
    }
    Canvas(modifier.size(ORB_SIZE.dp).clearAndSetSemantics {}) {
        val t = if (still) REDUCED_MOTION_T * preset.speed else seconds * preset.speed
        val scale = size.width / ORB_SIZE.toFloat()
        for (dot in preset.frame(t)) {
            drawCircle(ink(dot.white, dot.a, dark), radius = (dot.r * scale).toFloat(), center = Offset((dot.x * scale).toFloat(), (dot.y * scale).toFloat()))
        }
    }
}

/** Ink quantised to 8 bits as the library's painters do, mirrored on the dark theme. */
internal fun ink(white: Double, alpha: Double, dark: Boolean): Color {
    val w = white.coerceIn(0.0, 1.0)
    val g = ((if (dark) 1 - w else w) * 255).roundToInt() / 255f
    return Color(g, g, g, alpha.toFloat().coerceIn(0f, 1f))
}
