package app.aquareum.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowUpward
import androidx.compose.material.icons.rounded.AspectRatio
import androidx.compose.material.icons.rounded.Stop
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import app.aquareum.design.LocalPalette
import app.aquareum.design.glass
import app.aquareum.design.pressable
import app.aquareum.design.rememberMotion
import app.aquareum.design.style
import app.aquareum.generated.Radius
import app.aquareum.generated.TypeSize

/** What the composer holds before it is sent. */
data class Draft(
    val prompt: String = "",
    /** The capability a starting point or an example chose; null lets the agent decide. */
    val app: String? = null,
    val aspect: String = "16:9",
    val durationSeconds: Int = 5,
) {
    val isVideo: Boolean get() = app?.contains("video") == true && app?.startsWith("live") == false
    val canSend: Boolean get() = prompt.isNotBlank()
}

private val ASPECTS = listOf("16:9", "9:16", "1:1")
private val DURATIONS = listOf(5, 10)

/**
 * The one composer. It sits in the centre of Home and at the foot of a conversation, and holds the
 * view's one ink action: send.
 */
@Composable
fun Composer(
    draft: Draft,
    onDraft: (Draft) -> Unit,
    onSend: () -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "A slow push along a harbour at first light…",
    sending: Boolean = false,
    focus: FocusRequester = remember { FocusRequester() },
) {
    val palette = LocalPalette.current
    val motion = rememberMotion()
    val shape = RoundedCornerShape(Radius.Sheet.dp)
    Column(modifier.fillMaxWidth().glass(shape).padding(start = 18.dp, end = 8.dp, top = 8.dp, bottom = 8.dp)) {
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            BasicTextField(
                value = draft.prompt,
                onValueChange = { onDraft(draft.copy(prompt = it)) },
                textStyle = TypeSize.Lead.style().copy(color = palette.foreground),
                cursorBrush = SolidColor(palette.brand),
                maxLines = 6,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                modifier = Modifier.weight(1f).padding(vertical = 10.dp).focusRequester(focus).semantics { contentDescription = "Describe what you want to make" },
                decorationBox = { field ->
                    Box {
                        if (draft.prompt.isEmpty()) BasicText(placeholder, style = TypeSize.Lead.style().copy(color = palette.subtleForeground))
                        field()
                    }
                },
            )
            // With nothing else to set, send sits beside the words and the composer is one line tall.
            if (!draft.isVideo) SendButton(draft.canSend, sending, onSend)
        }
        // Parameters appear with intent: only once the request is a video.
        AnimatedVisibility(draft.isVideo, enter = expandVertically(motion.morph()) + fadeIn(motion.morph()), exit = shrinkVertically(motion.exit()) + fadeOut(motion.exit())) {
            Row(Modifier.padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Parameter(draft.aspect, Icons.Rounded.AspectRatio, "Shape, ${draft.aspect}", ASPECTS.map { it to it }) { onDraft(draft.copy(aspect = it)) }
                Parameter("${draft.durationSeconds}s", Icons.Rounded.Timer, "Length, ${draft.durationSeconds} seconds", DURATIONS.map { "$it seconds" to it }) { onDraft(draft.copy(durationSeconds = it)) }
                Spacer(Modifier.weight(1f))
                SendButton(draft.canSend, sending, onSend)
            }
        }
    }
}

/** The view's one ink action. */
@Composable
private fun SendButton(enabled: Boolean, sending: Boolean, onSend: () -> Unit) {
    val palette = LocalPalette.current
    val alpha by animateFloatAsState(if (enabled || sending) 1f else 0.35f, label = "send")
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(48.dp)
            .pressable(enabled = enabled && !sending, round = true, onClick = onSend)
            .alpha(alpha)
            .padding(2.dp)
            .background(palette.primary, CircleShape)
            .semantics { contentDescription = if (sending) "Sending" else "Send" },
    ) {
        Icon(if (sending) Icons.Rounded.Stop else Icons.Rounded.ArrowUpward, contentDescription = null, tint = palette.primaryForeground, modifier = Modifier.size(22.dp))
    }
}

@Composable
private fun <T> Parameter(label: String, icon: ImageVector, description: String, options: List<Pair<String, T>>, onPick: (T) -> Unit) {
    val palette = LocalPalette.current
    var open by remember { mutableStateOf(false) }
    Box {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
            modifier = Modifier
                .pressable { open = true }
                .semantics { contentDescription = description }
                .background(palette.hover, CircleShape)
                .border(1.dp, palette.hairline, CircleShape)
                .heightIn(min = 32.dp)
                .padding(horizontal = 10.dp),
        ) {
            Icon(icon, contentDescription = null, tint = palette.mutedForeground, modifier = Modifier.size(14.dp))
            BasicText(label, style = TypeSize.Caption.style(mono = true).copy(color = palette.mutedForeground))
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }, containerColor = palette.popover) {
            for ((name, value) in options) {
                DropdownMenuItem(text = { BasicText(name, style = TypeSize.Body.style().copy(color = palette.popoverForeground)) }, onClick = { open = false; onPick(value) })
            }
        }
    }
}
