package org.livepeer.app.composer

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.livepeer.app.design.LoadFailure
import org.livepeer.app.design.LocalPalette
import org.livepeer.app.design.MediaStill
import org.livepeer.app.design.breathing
import org.livepeer.app.design.pressable
import org.livepeer.app.design.style
import org.livepeer.app.generated.AgentModelEntry
import org.livepeer.app.generated.Api
import org.livepeer.app.generated.Character
import org.livepeer.app.generated.CharacterCast
import org.livepeer.app.generated.MediaItem
import org.livepeer.app.generated.Radius
import org.livepeer.app.generated.TypeSize
import org.livepeer.app.home.Draft
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/** Something read on demand: not yet, under way, read, or failed. */
sealed interface Load<out T> {
    data object Idle : Load<Nothing>
    data object Loading : Load<Nothing>
    data object Failed : Load<Nothing>
    data class Loaded<T>(val value: T) : Load<T>
}

/**
 * What every composer can offer besides words: the agent's models, the capabilities on offer, and the
 * library and characters to pick from. Read once and shared by Home and every conversation.
 */
class ComposerSupport(private val api: Api) {
    private val _models = MutableStateFlow<List<AgentModelEntry>>(emptyList())
    private val _library = MutableStateFlow<Load<List<MediaItem>>>(Load.Idle)
    private val _characters = MutableStateFlow<Load<List<Character>>>(Load.Idle)
    /** The capabilities on offer, so casting a character can start the shot from their portrait. */
    private var apps: Set<String> = emptySet()

    val models: StateFlow<List<AgentModelEntry>> = _models
    val library: StateFlow<Load<List<MediaItem>>> = _library
    val characters: StateFlow<Load<List<Character>>> = _characters
    /** A character waiting to be put in Home's composer, from "Cast in a scene" on their page. */
    val pendingCast = MutableStateFlow<Character?>(null)

    suspend fun load() {
        runCatching { api.listAgentModelMenu() }.onSuccess { _models.value = it }
        runCatching { api.listCapabilityLabels() }.onSuccess { labels -> apps = labels.map { it.app }.toSet() }
    }

    /** The person's videos, for the agent to watch or work from. */
    suspend fun loadLibrary() = read(_library) { api.searchLibrary(kind = "video") }

    /** Characters the person can put on screen: their own first, then the public ones. */
    suspend fun loadCharacters() = read(_characters) { api.listCharacters().sortedByDescending { it.mine } }

    /** Forgets what belonged to the person who was signed in. */
    fun signedOut() {
        _library.value = Load.Idle
        _characters.value = Load.Idle
    }

    /** Puts a character on screen. The shot starts from their portrait, so it becomes image to video when the network offers it. */
    fun cast(character: Character, draft: Draft): Draft =
        draft.copy(cast = CharacterCast(character.slug, character.name, character.image), app = if ("image-to-video" in apps) "image-to-video" else draft.app)

    private suspend fun <T> read(into: MutableStateFlow<Load<T>>, fetch: suspend () -> T) {
        if (into.value !is Load.Loaded) into.value = Load.Loading
        try {
            into.value = Load.Loaded(fetch())
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            if (into.value !is Load.Loaded) into.value = Load.Failed
        }
    }
}

/** Which composer tray is open. */
enum class ComposerTray { Attach, Cast }

/** Library videos to attach. Each tap adds or removes one; the tray stays open to pick several. */
@Composable
fun AttachTray(support: ComposerSupport, draft: Draft, onDraft: (Draft) -> Unit) {
    val palette = LocalPalette.current
    val library by support.library.collectAsStateWithLifecycle()
    val haptics = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { support.loadLibrary() }

    BasicText("The agent can watch a video, summarise it, find moments and work from it.", style = TypeSize.Body.style().copy(color = palette.mutedForeground))
    when (val current = library) {
        Load.Idle, Load.Loading -> Skeleton(16f / 9f)
        Load.Failed -> LoadFailure("Your library didn't load.") { scope.launch { support.loadLibrary() } }
        is Load.Loaded -> if (current.value.isEmpty()) {
            BasicText("Nothing in your library yet. Shots you generate are saved there.", style = TypeSize.Body.style().copy(color = palette.mutedForeground))
        } else {
            Grid(current.value, columns = 3) { item ->
                val attached = draft.attachments.any { it.id == item.id }
                val shape = RoundedCornerShape(Radius.Field.dp)
                Box(
                    Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(shape).border(if (attached) 2.dp else 1.dp, if (attached) palette.foreground else palette.hairline, shape)
                        .pressable {
                            haptics.performHapticFeedback(HapticFeedbackType.SegmentTick)
                            onDraft(draft.copy(attachments = if (attached) draft.attachments.filterNot { it.id == item.id } else draft.attachments + item))
                        }
                        .semantics { contentDescription = item.title; selected = attached },
                ) {
                    MediaStill(item.image, item.artwork, Modifier.fillMaxSize())
                    if (attached) {
                        Box(Modifier.align(Alignment.TopEnd).padding(5.dp).size(20.dp).background(palette.primary, CircleShape), contentAlignment = Alignment.Center) {
                            Icon(Icons.Rounded.Check, contentDescription = null, tint = palette.primaryForeground, modifier = Modifier.size(12.dp))
                        }
                    }
                }
            }
        }
    }
}

/** Characters to put on screen. Picking one closes the tray. */
@Composable
fun CastTray(support: ComposerSupport, draft: Draft, onDraft: (Draft) -> Unit, done: () -> Unit) {
    val palette = LocalPalette.current
    val characters by support.characters.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { support.loadCharacters() }

    BasicText("Their portrait becomes the first frame, so they look like themselves in every shot.", style = TypeSize.Body.style().copy(color = palette.mutedForeground))
    when (val current = characters) {
        Load.Idle, Load.Loading -> Skeleton(3f / 4f)
        Load.Failed -> LoadFailure("Characters didn't load.") { scope.launch { support.loadCharacters() } }
        is Load.Loaded -> if (current.value.isEmpty()) {
            BasicText("No characters yet. Make one on the web and it shows up here.", style = TypeSize.Body.style().copy(color = palette.mutedForeground))
        } else {
            Grid(current.value, columns = 3) { character ->
                val chosen = draft.cast?.slug == character.slug
                val shape = RoundedCornerShape(Radius.Field.dp)
                Column(
                    Modifier.pressable { onDraft(support.cast(character, draft)); done() }.semantics(mergeDescendants = true) { contentDescription = "${character.name}, ${character.tagline}" },
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    MediaStill(character.image, character.artwork, Modifier.fillMaxWidth().aspectRatio(3f / 4f).clip(shape).border(if (chosen) 2.dp else 1.dp, if (chosen) palette.foreground else palette.hairline, shape))
                    BasicText(character.name, style = TypeSize.Caption.style(FontWeight.Medium).copy(color = palette.foreground), maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

/** A grid inside a tray, which already scrolls: rows of [columns] cells. */
@Composable
private fun <T> Grid(items: List<T>, columns: Int, cell: @Composable (T) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for (row in items.chunked(columns)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for (item in row) Box(Modifier.weight(1f)) { cell(item) }
                repeat(columns - row.size) { Box(Modifier.weight(1f)) }
            }
        }
    }
}

/** A picker grid's shape while it loads. */
@Composable
private fun Skeleton(aspect: Float) {
    val palette = LocalPalette.current
    Grid(List(6) { it }, columns = 3) { Box(Modifier.fillMaxWidth().aspectRatio(aspect).background(palette.card, RoundedCornerShape(Radius.Field.dp)).breathing()) }
}
