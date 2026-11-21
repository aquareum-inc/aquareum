package app.aquareum

import androidx.compose.ui.graphics.Color
import app.aquareum.design.aspectRatio
import app.aquareum.design.parseHex
import app.aquareum.design.resolved
import app.aquareum.generated.Palette
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DesignTest {
    @Test
    fun hexColoursFromAnInstanceParse() {
        assertEquals(Color(0xFF40BF86), parseHex("#40BF86"))
        assertEquals(Color(0x8040BF86), parseHex("#40BF8680"))
        assertEquals(Color(0xFF40BF86), parseHex("40BF86"))
        assertNull(parseHex("#40B"))
        assertNull(parseHex("primary"))
    }

    @Test
    fun themeOverridesReplaceOnlyTheTokensTheyName() {
        val palette = Palette.resolved(dark = true, overrides = mapOf("primary" to "#FF0000", "not-a-token" to "#00FF00"))
        assertEquals(Color(0xFFFF0000), palette.primary)
        assertEquals(Palette.Dark.background, palette.background)
    }

    @Test
    fun shapesBecomeRatios() {
        assertEquals(16f / 9f, aspectRatio("16:9"), 0.0001f)
        assertEquals(1f, aspectRatio("1:1"), 0.0001f)
        assertEquals(16f / 9f, aspectRatio("nonsense"), 0.0001f)
    }
}
