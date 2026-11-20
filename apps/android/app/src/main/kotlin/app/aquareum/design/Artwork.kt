package app.aquareum.design

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import app.aquareum.BuildConfig
import app.aquareum.generated.MockArtwork
import coil3.compose.AsyncImage

/**
 * Stand-in for a generated frame while media is mocked: three soft light sources, as on the web.
 * Colours here are content, not interface tokens.
 */
@Composable
fun Artwork(artwork: MockArtwork, modifier: Modifier = Modifier) {
    val hues = artwork.hues.map { (it % 360).toFloat() }
    val seed = artwork.seed.toInt()
    val x = (20 + (seed % 5) * 12) / 100f
    val y = (25 + (seed % 3) * 18) / 100f
    Box(
        modifier.drawBehind {
            val side = maxOf(size.width, size.height)
            fun light(colour: Color, cx: Float, cy: Float, reach: Float) =
                drawRect(Brush.radialGradient(listOf(colour, Color.Transparent), center = Offset(size.width * cx, size.height * cy), radius = side * reach))
            drawRect(Color.hsl(hues[2], 0.30f, 0.09f))
            light(Color.hsl(hues[0], 0.78f, 0.62f, 0.95f), x, y, 0.62f)
            light(Color.hsl(hues[1], 0.82f, 0.58f, 0.85f), 1 - x, y + 0.3f, 0.56f)
            light(Color.hsl(hues[2], 0.70f, 0.40f, 0.9f), 0.5f, 1.1f, 0.8f)
            drawRect(Brush.verticalGradient(0.55f to Color.Transparent, 1f to Color.Black.copy(alpha = 0.45f)))
        },
    )
}

/** A still of some media when there is one; the stand-in artwork otherwise and while it loads. */
@Composable
fun MediaStill(image: String?, artwork: MockArtwork, modifier: Modifier = Modifier) {
    Box(modifier) {
        Artwork(artwork, Modifier.fillMaxSize())
        if (image != null) {
            AsyncImage(model = absolute(image), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        }
    }
}

/** An address from the instance, made absolute against it when it is a path. */
fun absolute(address: String): String = if (address.startsWith("http")) address else BuildConfig.INSTANCE_URL.trimEnd('/') + "/" + address.trimStart('/')

/** "16:9" → 16/9, for laying out a tile before its media exists. */
fun aspectRatio(aspect: String): Float {
    val parts = aspect.split(":").mapNotNull { it.toFloatOrNull() }
    return if (parts.size == 2 && parts[1] > 0) parts[0] / parts[1] else 16f / 9f
}
