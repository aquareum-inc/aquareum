package app.aquareum.characters

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.SearchOff
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.aquareum.account.Account
import app.aquareum.design.LoadFailure
import app.aquareum.design.LocalPalette
import app.aquareum.design.MediaStill
import app.aquareum.design.pressable
import app.aquareum.design.style
import app.aquareum.generated.Character
import app.aquareum.generated.CharacterVisibility
import app.aquareum.generated.Radius
import app.aquareum.generated.TypeSize
import app.aquareum.shell.EmptyState
import app.aquareum.shell.TabPage
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * A cast for the person's scenes: their own characters, then those shared on the instance. A guest sees the
 * shared ones and signs in to make their own.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CharactersScreen(model: CharactersModel, account: Account, accountButton: @Composable () -> Unit, open: (Character) -> Unit, create: () -> Unit) {
    val palette = LocalPalette.current
    val state by model.state.collectAsStateWithLifecycle()
    val signedIn by account.signedIn.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    var refreshing by remember { mutableStateOf(false) }

    TabPage("Characters", accountButton) {
        BasicTextField(
            value = state.query,
            onValueChange = model::setQuery,
            singleLine = true,
            textStyle = TypeSize.Lead.style().copy(color = palette.foreground),
            cursorBrush = SolidColor(palette.foreground),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).semantics { contentDescription = "Search characters" },
            decorationBox = { field ->
                Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).background(palette.card, CircleShape).border(1.dp, palette.hairline, CircleShape).padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Rounded.Search, contentDescription = null, tint = palette.mutedForeground, modifier = Modifier.size(20.dp))
                    Box { if (state.query.isEmpty()) BasicText("Search characters", style = TypeSize.Lead.style().copy(color = palette.subtleForeground)); field() }
                }
            },
        )
        Box(Modifier.weight(1f).padding(top = 12.dp)) {
            when {
                state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = palette.mutedForeground) }
                state.failed -> LoadFailure("Characters didn't load. Check your connection and try again.", Modifier.fillMaxSize()) { scope.launch { model.load() } }
                else -> PullToRefreshBox(refreshing, onRefresh = { scope.launch { refreshing = true; model.load(); refreshing = false } }) {
                    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (state.query.isEmpty()) {
                            val mine = state.mine(signedIn)
                            item(key = "yours") {
                                Row(Modifier.fillMaxWidth().heightIn(min = 40.dp), verticalAlignment = Alignment.CenterVertically) {
                                    SectionTitle("Yours", Modifier.weight(1f))
                                    if (mine.isNotEmpty()) {
                                        Row(Modifier.pressable(label = "New character", onClick = create).padding(horizontal = 8.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                            Icon(Icons.Rounded.Add, contentDescription = null, tint = palette.foreground, modifier = Modifier.size(18.dp))
                                            BasicText("New", style = TypeSize.Body.style(FontWeight.Medium).copy(color = palette.foreground))
                                        }
                                    }
                                }
                            }
                            if (mine.isEmpty()) item(key = "first") { FirstCharacter(create) }
                            items(mine, key = { "mine-${it.slug}" }) { CharacterCard(it) { open(it) } }
                        }
                        item(key = "shared") { SectionTitle(if (signedIn) "Shared by others" else "Shared here", Modifier.padding(top = if (state.query.isEmpty()) 18.dp else 0.dp)) }
                        if (state.shared.isEmpty()) {
                            item(key = "none") {
                                Box(Modifier.fillMaxWidth().heightIn(min = 220.dp)) {
                                    if (state.query.isEmpty()) EmptyState(Icons.Rounded.SearchOff, "No one shared yet", "Characters people share on this service appear here.")
                                    else EmptyState(Icons.Rounded.SearchOff, "No one by that description", "Try a role or a subject, like “editor” or “lighting”.")
                                }
                            }
                        }
                        items(state.shared, key = { it.slug }) { CharacterCard(it) { open(it) } }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    BasicText(text, style = TypeSize.Body.style(FontWeight.SemiBold).copy(color = LocalPalette.current.foreground), modifier = modifier.semantics { heading() })
}

/** The way in when the person has no characters of their own. */
@Composable
private fun FirstCharacter(create: () -> Unit) {
    val palette = LocalPalette.current
    val radius = Radius.Card.dp
    Column(
        Modifier.fillMaxWidth()
            .drawBehind { drawRoundRect(palette.input, cornerRadius = CornerRadius(radius.toPx()), style = Stroke(width = 1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx())))) }
            .clip(RoundedCornerShape(radius))
            .pressable(label = "Make your first character", onClick = create)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        BasicText("Make your first character", style = TypeSize.Body.style(FontWeight.SemiBold).copy(color = palette.foreground))
        BasicText("Describe who they are and how they look, move and speak, then cast them in any scene. They stay private until you share them.", style = TypeSize.Caption.style().copy(color = palette.mutedForeground))
    }
}

/** One character in a list: portrait, name, one line and how well liked they are. */
@Composable
private fun CharacterCard(character: Character, open: () -> Unit) {
    val palette = LocalPalette.current
    val shape = RoundedCornerShape(Radius.Card.dp)
    Row(
        Modifier.fillMaxWidth().clip(shape).background(palette.card).border(1.dp, palette.hairline, shape).pressable(label = "Open ${character.name}", onClick = open).padding(12.dp)
            .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        val media = RoundedCornerShape(Radius.Media.dp)
        CharacterPortrait(character, Modifier.size(72.dp).clip(media).border(1.dp, palette.hairline, media))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                BasicText(character.name, style = TypeSize.Body.style(FontWeight.SemiBold).copy(color = palette.foreground), maxLines = 1)
                if (character.visibility == CharacterVisibility.Private) {
                    BasicText("Private", style = TypeSize.Caption.style(FontWeight.Medium).copy(color = palette.mutedForeground), modifier = Modifier.background(palette.secondary, CircleShape).padding(horizontal = 7.dp, vertical = 2.dp))
                }
            }
            BasicText(character.tagline, style = TypeSize.Caption.style().copy(color = palette.mutedForeground), maxLines = 2)
            if (character.chats > 0) CharacterStats(character, Modifier.padding(top = 3.dp))
        }
    }
}

/** A character's portrait, or their initial over their artwork when they have none. */
@Composable
fun CharacterPortrait(character: Character, modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier, contentAlignment = Alignment.Center) {
        MediaStill(character.image, character.artwork, Modifier.fillMaxSize())
        if (character.image == null) {
            val size = (maxWidth.value * 0.42f).sp
            BasicText(character.name.take(1).uppercase(), style = TypeSize.Title.style(FontWeight.SemiBold).copy(color = Color.White.copy(alpha = 0.92f), fontSize = size, lineHeight = size))
        }
    }
}

/** Rating and how many conversations, in mono. */
@Composable
fun CharacterStats(character: Character, modifier: Modifier = Modifier) {
    val palette = LocalPalette.current
    val chats = compactCount(character.chats)
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        Icon(Icons.Rounded.Star, contentDescription = null, tint = palette.subtleForeground, modifier = Modifier.size(12.dp))
        BasicText("%.1f".format(Locale.ENGLISH, character.rating) + "  $chats chats", style = TypeSize.Caption.style(mono = true).copy(color = palette.subtleForeground))
    }
}
