package org.livepeer.app.home

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
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Memory
import androidx.compose.material.icons.rounded.PersonAdd
import androidx.compose.material.icons.rounded.PhotoLibrary
import androidx.compose.material3.HorizontalDivider
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import org.livepeer.app.design.absolute
import org.livepeer.app.generated.AgentModelEntry
import org.livepeer.app.generated.CharacterCast
import org.livepeer.app.generated.MediaItem
import coil3.compose.AsyncImage
import org.livepeer.app.design.LocalPalette
import org.livepeer.app.design.glass
import org.livepeer.app.design.pressable
import org.livepeer.app.design.rememberMotion
import org.livepeer.app.design.style
import org.livepeer.app.generated.Radius
import org.livepeer.app.generated.TypeSize

/** What the composer holds before it is sent. */
data class Draft(
    val prompt: String = "",
    /** The capability a starting point, an example or a cast chose; null lets the agent decide. */
    val app: String? = null,
    val aspect: String = "16:9",
    val durationSeconds: Int = 5,
    /** Library items for the agent to watch or work from. */
    val attachments: List<MediaItem> = emptyList(),
    /** A character to put on screen, starting from their portrait. */
    val cast: CharacterCast? = null,
    /** The language model that runs the agent; null is Auto. */
    val model: String? = null,
) {
    val isVideo: Boolean get() = app?.contains("video") == true && app?.startsWith("live") == false
    val canSend: Boolean get() = prompt.isNotBlank() || attachments.isNotEmpty()

    /** What is sent. With only attachments, it asks for the videos to be understood, as the web does. */
    val text: String get() = prompt.trim().ifEmpty { "Summarise this and list the key moments." }

    /** What carries on to the next message in a conversation: the same model, and the same cast. */
    val carriedOn: Draft get() = Draft(app = if (cast == null) null else app, cast = cast, model = model)
}

/** What the composer can offer besides words, as the instance describes it. */
data class ComposerChoices(
    /** The agent's model menu; shown only with two or more rows. */
    val models: List<AgentModelEntry> = emptyList(),
    /** Whether a character can be put on screen. */
    val casting: Boolean = false,
    val attach: () -> Unit = {},
    val castCharacter: () -> Unit = {},
)

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
    choices: ComposerChoices = ComposerChoices(),
) {
    val palette = LocalPalette.current
    val motion = rememberMotion()
    val shape = RoundedCornerShape(Radius.Sheet.dp)
    val chosenModel = draft.model?.let { model -> choices.models.takeIf { it.size >= 2 }?.firstOrNull { it.app == model || model in it.also } }
    Column(modifier.fillMaxWidth().glass(shape).padding(start = 6.dp, end = 8.dp, top = 8.dp, bottom = 8.dp)) {
        AnimatedVisibility(draft.cast != null || draft.attachments.isNotEmpty() || chosenModel != null, enter = expandVertically(motion.morph()) + fadeIn(motion.morph()), exit = shrinkVertically(motion.exit()) + fadeOut(motion.exit())) {
            Chosen(draft, chosenModel, onDraft)
        }
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            More(draft, choices, chosenModel, onDraft)
            // Words that arrive from outside (an example, a cleared draft) put the cursor at their end.
            var field by remember { mutableStateOf(TextFieldValue(draft.prompt, TextRange(draft.prompt.length))) }
            if (field.text != draft.prompt) field = TextFieldValue(draft.prompt, TextRange(draft.prompt.length))
            BasicTextField(
                value = field,
                onValueChange = { field = it; if (it.text != draft.prompt) onDraft(draft.copy(prompt = it.text)) },
                textStyle = TypeSize.Lead.style().copy(color = palette.foreground),
                cursorBrush = SolidColor(palette.brand),
                maxLines = 6,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                modifier = Modifier.weight(1f).padding(vertical = 10.dp).focusRequester(focus).semantics { contentDescription = "Describe what you want to make" },
                decorationBox = { field ->
                    Box {
                        if (draft.prompt.isEmpty()) BasicText(placeholderFor(draft, placeholder), style = TypeSize.Lead.style().copy(color = palette.subtleForeground))
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

/** What to write, given what has been added: a cast asks for a scene, an attachment for a question. */
private fun placeholderFor(draft: Draft, fallback: String): String = when {
    draft.cast != null -> "Put ${draft.cast.name} in a scene: where, doing what, in what light…"
    draft.attachments.isNotEmpty() -> "Ask about it, or send as it is for a summary and the key moments"
    else -> fallback
}

/** Everything besides words: attach, cast and the agent's model. One button, so the composer stays one line. */
@Composable
private fun More(draft: Draft, choices: ComposerChoices, chosen: AgentModelEntry?, onDraft: (Draft) -> Unit) {
    val palette = LocalPalette.current
    var open by remember { mutableStateOf(false) }
    Box {
        Box(Modifier.size(48.dp).pressable(round = true, label = "Add to the request") { open = true }.semantics { contentDescription = "Add to the request" }, contentAlignment = Alignment.Center) {
            Icon(Icons.Rounded.Add, contentDescription = null, tint = palette.mutedForeground, modifier = Modifier.size(22.dp))
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }, containerColor = palette.popover) {
            val item = { label: String, icon: ImageVector, action: () -> Unit ->
                @Composable { DropdownMenuItem(text = { BasicText(label, style = TypeSize.Body.style().copy(color = palette.popoverForeground)) }, leadingIcon = { Icon(icon, null, tint = palette.mutedForeground) }, onClick = { open = false; action() }) }
            }
            item("Attach from your library", Icons.Rounded.PhotoLibrary, choices.attach)()
            if (choices.casting) item("Put a character in it", Icons.Rounded.PersonAdd, choices.castCharacter)()
            if (choices.models.size >= 2) {
                HorizontalDivider(color = palette.hairline)
                BasicText("Model", style = TypeSize.Caption.style(FontWeight.Medium).copy(color = palette.mutedForeground), modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
                ModelItem("Auto", "Picks a model for each request", draft.model == null) { open = false; onDraft(draft.copy(model = null)) }
                for (entry in choices.models) {
                    ModelItem(entry.name, if (entry.busy) "Busy · ${entry.description}" else entry.description, chosen?.app == entry.app) { open = false; onDraft(draft.copy(model = entry.app)) }
                }
            }
        }
    }
}

@Composable
private fun ModelItem(name: String, description: String, selected: Boolean, onClick: () -> Unit) {
    val palette = LocalPalette.current
    DropdownMenuItem(
        text = {
            Column {
                BasicText(name, style = TypeSize.Body.style(FontWeight.Medium).copy(color = palette.popoverForeground))
                BasicText(description, style = TypeSize.Caption.style().copy(color = palette.mutedForeground))
            }
        },
        leadingIcon = { Icon(Icons.Rounded.Check, null, tint = if (selected) palette.foreground else androidx.compose.ui.graphics.Color.Transparent) },
        onClick = onClick,
        modifier = Modifier.semantics { this.selected = selected },
    )
}

/** What has been added, each removable: who is cast, what is attached, which model runs the agent. */
@Composable
private fun Chosen(draft: Draft, model: AgentModelEntry?, onDraft: (Draft) -> Unit) {
    LazyRow(Modifier.padding(start = 6.dp, bottom = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        draft.cast?.let { cast ->
            item(key = "cast") {
                Token(cast.name.take(1).uppercase(), cast.image, null, "With ${cast.name}", "Take ${cast.name} out") {
                    onDraft(draft.copy(cast = null, app = if (draft.app == "image-to-video") null else draft.app))
                }
            }
        }
        items(draft.attachments, key = { it.id }) { attached ->
            Token(null, attached.image, null, attached.title, "Remove ${attached.title}") { onDraft(draft.copy(attachments = draft.attachments - attached)) }
        }
        model?.let { entry -> item(key = "model") { Token(null, null, Icons.Rounded.Memory, entry.name, "Back to Auto") { onDraft(draft.copy(model = null)) } } }
    }
}

@Composable
private fun Token(initial: String?, image: String?, icon: ImageVector?, label: String, remove: String, onRemove: () -> Unit) {
    val palette = LocalPalette.current
    Row(
        Modifier.background(palette.hover, CircleShape).border(1.dp, palette.hairline, CircleShape).heightIn(min = 32.dp).padding(start = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = palette.mutedForeground, modifier = Modifier.size(16.dp))
        } else {
            Box(Modifier.size(20.dp).clip(CircleShape).background(palette.secondary), contentAlignment = Alignment.Center) {
                if (initial != null) BasicText(initial, style = TypeSize.Caption.style(FontWeight.SemiBold).copy(color = palette.foreground, fontSize = 10.sp))
                if (image != null) AsyncImage(absolute(image), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.matchParentSize())
            }
        }
        BasicText(label, style = TypeSize.Caption.style(FontWeight.Medium).copy(color = palette.foreground), maxLines = 1)
        Box(Modifier.size(32.dp).pressable(round = true, label = remove, onClick = onRemove).semantics { contentDescription = remove }, contentAlignment = Alignment.Center) {
            Icon(Icons.Rounded.Close, contentDescription = null, tint = palette.mutedForeground, modifier = Modifier.size(14.dp))
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
