package app.aquareum.studio

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AspectRatio
import androidx.compose.material.icons.rounded.GridView
import androidx.compose.material.icons.rounded.HighQuality
import androidx.compose.material.icons.rounded.Movie
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import app.aquareum.account.Account
import app.aquareum.chat.GenerationTile
import app.aquareum.design.LoadFailure
import app.aquareum.design.LocalPalette
import app.aquareum.design.Mono
import app.aquareum.design.pressable
import app.aquareum.design.style
import app.aquareum.generated.MediaKind
import app.aquareum.generated.Radius
import app.aquareum.generated.TypeSize
import app.aquareum.shell.EmptyState
import app.aquareum.shell.TabPage
import kotlinx.coroutines.launch

/**
 * The studio: pick a medium, write one draft, Generate. Results land on the stage below and render in place;
 * each is saved to the library.
 */
@Composable
fun StudioScreen(studio: StudioModel, account: Account, accountButton: @Composable () -> Unit) {
    val palette = LocalPalette.current
    val state by studio.state.collectAsStateWithLifecycle()
    val me by account.me.collectAsStateWithLifecycle()
    val signedIn by account.signedIn.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val lifecycle = LocalLifecycleOwner.current.lifecycle

    LaunchedEffect(Unit) { if (state.mediums.isEmpty()) studio.load() }
    // Requote when anything that sets the price changes.
    LaunchedEffect(state.kind, state.draft.mode, state.draft.durationSeconds, state.draft.resolution, state.mediums.size) { studio.requote() }
    // Follows what is rendering while the screen is in front.
    LaunchedEffect(state.rendering, state.results.size) { if (state.rendering) lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) { studio.follow() } }

    val short = signedIn && state.cost != null && me != null && state.cost!! > me!!.balance.credits
    val ready = state.mode?.available == true && state.draft.canGenerate && !state.generating && !short

    TabPage("Studio", accountButton) {
        when {
            state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = palette.mutedForeground) }
            state.failed -> LoadFailure("The studio didn't load. Check your connection and try again.", Modifier.fillMaxSize()) { scope.launch { studio.load() } }
            state.mediums.isEmpty() -> EmptyState(Icons.Rounded.Movie, "The studio isn't offered here", "This service doesn't offer making video, images or audio in the studio right now. You can still ask for them on Home.")
            else -> Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Segmented(state.mediums.map { it.kind to it.label }, state.kind, studio::choose)
                DraftCard(state, studio)

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    val shape = RoundedCornerShape(Radius.Field.dp)
                    Box(
                        Modifier.fillMaxWidth().heightIn(min = 52.dp).background(palette.primary.copy(alpha = if (ready) 1f else 0.4f), shape)
                            .pressable(enabled = ready) {
                                scope.launch {
                                    // A guest signs in here and carries on: the draft stays as it is.
                                    if (account.requireSignIn("Sign in to generate. Your draft stays here.") && studio.generate()) account.refresh()
                                }
                            }
                            .semantics { contentDescription = if (short) "Not enough credits" else "Generate${state.cost?.let { ", $it credits" }.orEmpty()}" },
                        contentAlignment = Alignment.Center,
                    ) {
                        BasicText(
                            buildAnnotatedString {
                                append(if (short) "Not enough credits" else if (state.generating) "Starting…" else "Generate")
                                if (!short) state.cost?.let { cost -> withStyle(SpanStyle(fontFamily = Mono, fontWeight = FontWeight.Medium, color = palette.primaryForeground.copy(alpha = 0.7f))) { append("  $cost") } }
                            },
                            style = TypeSize.Lead.style(FontWeight.SemiBold).copy(color = palette.primaryForeground),
                        )
                    }
                    if (state.mode?.available == false) {
                        BasicText(
                            "No compute operator on the network is offering ${state.mode?.app?.replace('-', ' ')} right now. You can still write your draft; Generate turns on when one comes online.",
                            style = TypeSize.Caption.style().copy(color = palette.mutedForeground),
                            modifier = Modifier.fillMaxWidth().background(palette.muted, shape).padding(12.dp),
                        )
                    }
                    state.error?.let { BasicText(it, style = TypeSize.Caption.style().copy(color = palette.destructive)) }
                }

                Stage(state, studio)
            }
        }
    }
}

/** One draft. Changing mode reshapes this card; it never swaps to another panel. */
@Composable
private fun DraftCard(state: StudioState, studio: StudioModel) {
    val palette = LocalPalette.current
    val medium = state.medium
    val draft = state.draft
    val card = RoundedCornerShape(Radius.Sheet.dp)
    Column(Modifier.fillMaxWidth().background(palette.card, card).border(1.dp, palette.hairline, card).padding(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.modes.size > 1) Segmented(state.modes.map { it to it.label }, state.mode, studio::choose)

        val limit = medium?.promptLimit?.toInt() ?: Int.MAX_VALUE
        BasicTextField(
            value = draft.prompt,
            onValueChange = { studio.setDraft(draft.copy(prompt = it.take(limit))) },
            textStyle = TypeSize.Lead.style().copy(color = palette.foreground),
            cursorBrush = SolidColor(palette.foreground),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Prompt" },
            decorationBox = { field ->
                Box(Modifier.fillMaxWidth().heightIn(min = 120.dp).background(palette.muted, RoundedCornerShape(Radius.Media.dp)).padding(12.dp)) {
                    if (draft.prompt.isEmpty()) BasicText(state.mode?.wordsPlaceholder.orEmpty(), style = TypeSize.Lead.style().copy(color = palette.subtleForeground))
                    field()
                }
            },
        )

        // Shape, length, resolution and how many: only what this medium and mode have.
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            medium?.aspects?.takeIf { it.size > 1 }?.let { aspects ->
                Setting(Icons.Rounded.AspectRatio, draft.aspect.orEmpty(), "Shape", aspects.map { it.value to it.value }) { studio.setDraft(draft.copy(aspect = it)) }
            }
            state.mode?.durations?.takeIf { it.size > 1 }?.let { durations ->
                Setting(Icons.Rounded.Timer, "${draft.durationSeconds?.toInt() ?: 0}s", "Length", durations.map { "${it.toInt()} seconds" to it }) { studio.setDraft(draft.copy(durationSeconds = it)) }
            }
            medium?.resolutions?.takeIf { it.size > 1 }?.let { resolutions ->
                Setting(Icons.Rounded.HighQuality, draft.resolution.orEmpty(), "Resolution", resolutions.map { it.value to it.value }) { studio.setDraft(draft.copy(resolution = it)) }
            }
            medium?.maxVariants?.toInt()?.takeIf { it > 1 }?.let { most ->
                Setting(Icons.Rounded.GridView, "×${draft.variants}", "How many", (1..most).map { "$it at once" to it }) { studio.setDraft(draft.copy(variants = it)) }
            }
        }
    }
}

/** Results, newest first, each rendering in place; or what will land here. */
@Composable
private fun Stage(state: StudioState, studio: StudioModel) {
    val palette = LocalPalette.current
    val empty = state.medium?.empty
    if (state.results.isEmpty() && empty != null) {
        val dash = palette.input
        Column(
            Modifier.fillMaxWidth().heightIn(min = 240.dp).drawBehind {
                drawRoundRect(dash, cornerRadius = CornerRadius(Radius.Card.dp.toPx()), style = Stroke(1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx()))))
            }.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
        ) {
            Row(Modifier.padding(bottom = 10.dp).clearAndSetSemantics {}, verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(Modifier.size(60.dp, 34.dp).background(palette.secondary, RoundedCornerShape(10.dp)))
                Box(Modifier.size(84.dp, 48.dp).background(palette.accent, RoundedCornerShape(12.dp)).border(1.dp, palette.hairline, RoundedCornerShape(12.dp)))
                Box(Modifier.size(60.dp, 34.dp).background(palette.secondary, RoundedCornerShape(10.dp)))
            }
            BasicText(empty.title, style = TypeSize.Lead.style(FontWeight.SemiBold).copy(color = palette.foreground, textAlign = TextAlign.Center))
            BasicText(empty.body, style = TypeSize.Body.style().copy(color = palette.mutedForeground, textAlign = TextAlign.Center))
        }
    } else {
        val columns = if (state.kind == MediaKind.Image) 2 else 1
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            for (row in state.results.chunked(columns)) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    for (generation in row) {
                        Box(Modifier.weight(1f).pressable(label = "Use these words again") { studio.reuse(generation) }) { GenerationTile(generation, generation.request.aspect.value) }
                    }
                    repeat(columns - row.size) { Box(Modifier.weight(1f)) }
                }
            }
        }
    }
}

@Composable
private fun <T> Segmented(options: List<Pair<T, String>>, selected: T?, onSelect: (T) -> Unit) {
    val palette = LocalPalette.current
    Row(Modifier.fillMaxWidth().background(palette.secondary, CircleShape).padding(3.dp)) {
        for ((value, label) in options) {
            val on = value == selected
            Box(
                Modifier.weight(1f).heightIn(min = 40.dp).background(if (on) palette.card else palette.secondary, CircleShape)
                    .then(if (on) Modifier.border(1.dp, palette.hairline, CircleShape) else Modifier)
                    .pressable { onSelect(value) }
                    .semantics { this.selected = on },
                contentAlignment = Alignment.Center,
            ) { BasicText(label, style = TypeSize.Body.style(if (on) FontWeight.Medium else FontWeight.Normal).copy(color = if (on) palette.foreground else palette.mutedForeground)) }
        }
    }
}

@Composable
private fun <T> Setting(icon: ImageVector, value: String, label: String, options: List<Pair<String, T>>, onPick: (T) -> Unit) {
    val palette = LocalPalette.current
    var open by remember { mutableStateOf(false) }
    Box {
        Row(
            Modifier.background(palette.hover, CircleShape).border(1.dp, palette.hairline, CircleShape).heightIn(min = 36.dp).pressable { open = true }.semantics { contentDescription = "$label, $value" }.padding(horizontal = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Icon(icon, contentDescription = null, tint = palette.mutedForeground, modifier = Modifier.size(14.dp))
            BasicText(value, style = TypeSize.Caption.style(mono = true).copy(color = palette.mutedForeground))
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }, containerColor = palette.popover) {
            for ((name, option) in options) {
                DropdownMenuItem(text = { BasicText(name, style = TypeSize.Body.style().copy(color = palette.popoverForeground)) }, onClick = { open = false; onPick(option) })
            }
        }
    }
}
