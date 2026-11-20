package app.aquareum.design

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.text.font.FontWeight
import app.aquareum.generated.TypeSize

/** An instance's mark, drawn from its SVG path data so it scales and tints like type. */
class VectorMark(val viewBox: Rect, val path: Path) {
    companion object {
        private val VIEW_BOX = Regex("""viewBox="([^"]+)"""")
        private val PATH = Regex("""<path[^>]*\sd="([^"]+)"""")

        /** A mark made only of paths, or null for anything else (shapes, text, images). */
        fun parse(svg: String): VectorMark? {
            val box = VIEW_BOX.find(svg)?.groupValues?.get(1)?.split(Regex("[ ,]+"))?.mapNotNull { it.toFloatOrNull() }?.takeIf { it.size == 4 } ?: return null
            val parts = PATH.findAll(svg).map { it.groupValues[1] }.toList().ifEmpty { return null }
            val path = Path()
            for (data in parts) path.addPath(runCatching { PathParser().parsePathString(data).toPath() }.getOrNull() ?: return null)
            return VectorMark(Rect(box[0], box[1], box[0] + box[2], box[1] + box[3]), path)
        }
    }
}

/** The instance's square mark: its own symbol when there is one, the first letter of its name otherwise. */
@Composable
fun BrandSymbol(mark: VectorMark?, name: String, colour: Color, modifier: Modifier = Modifier) {
    if (mark == null) {
        BasicText(name.take(1), style = TypeSize.Body.style(FontWeight.SemiBold).copy(color = colour), modifier = modifier)
        return
    }
    Canvas(modifier) {
        val scale = minOf(size.width / mark.viewBox.width, size.height / mark.viewBox.height)
        withTransform({
            translate((size.width - mark.viewBox.width * scale) / 2, (size.height - mark.viewBox.height * scale) / 2)
            scale(scale, scale, pivot = androidx.compose.ui.geometry.Offset.Zero)
            translate(-mark.viewBox.left, -mark.viewBox.top)
        }) { drawPath(mark.path, colour) }
    }
}
