package app.aquareum.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.DocumentScanner
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Image
import androidx.compose.material.icons.rounded.Movie
import androidx.compose.material.icons.rounded.PhotoLibrary
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Sensors
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.aquareum.design.Chip
import app.aquareum.design.LoadFailure
import app.aquareum.design.LocalPalette
import app.aquareum.design.MediaStill
import app.aquareum.design.aspectRatio
import app.aquareum.design.breathing
import app.aquareum.design.pressable
import app.aquareum.design.rememberMotion
import app.aquareum.design.style
import app.aquareum.generated.Conversation
import app.aquareum.generated.InstanceDescription
import app.aquareum.generated.MediaKind
import app.aquareum.generated.Radius
import app.aquareum.generated.ShowcaseItem
import app.aquareum.generated.TypeSize
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch

private val STARTER_ICONS = mapOf("make-video" to Icons.Rounded.Movie, "animate-image" to Icons.Rounded.PhotoLibrary, "understand-video" to Icons.Rounded.DocumentScanner, "restyle-live" to Icons.Rounded.Sensors)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(model: HomeViewModel, instance: InstanceDescription?, composerModifier: Modifier, onOpen: (Conversation) -> Unit) {
    val state by model.state.collectAsStateWithLifecycle()
    val palette = LocalPalette.current
    val motion = rememberMotion()
    val scroll = rememberScrollState()
    val scope = rememberCoroutineScope()
    val focus = remember { FocusRequester() }
    var refreshing by remember { mutableStateOf(false) }

    fun use(prompt: String, app: String) {
        model.fill(prompt, app)
        scope.launch { scroll.animateScrollTo(0) }
        focus.requestFocus()
    }

    PullToRefreshBox(
        isRefreshing = refreshing,
        onRefresh = { scope.launch { refreshing = true; model.refresh(); refreshing = false } },
        modifier = Modifier.fillMaxSize().background(palette.background),
    ) {
        Column(Modifier.fillMaxSize().verticalScroll(scroll)) {
            Box {
                HomeBackdrop(instance)
                Column(Modifier.windowInsetsPadding(WindowInsets.statusBars).padding(top = 56.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    BasicText(
                        "Direct anything.",
                        style = TypeSize.Display.style(FontWeight.SemiBold).copy(color = palette.foreground, fontSize = 34.sp, lineHeight = 38.sp, letterSpacing = (-0.02).em, textAlign = TextAlign.Center),
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).semantics { heading() },
                    )
                    BasicText(
                        "Describe a scene and watch it play out. Then edit it, restyle it, or take it live.",
                        style = TypeSize.Lead.style().copy(color = palette.mutedForeground, textAlign = TextAlign.Center),
                        modifier = Modifier.padding(top = 10.dp).padding(horizontal = 28.dp),
                    )
                    Composer(state.draft, model::setDraft, onSend = { model.send(onOpen) }, modifier = composerModifier.padding(top = 28.dp).padding(horizontal = 16.dp), sending = state.sending, focus = focus)

                    AnimatedVisibility(state.sendError != null) {
                        BasicText(state.sendError.orEmpty(), style = TypeSize.Caption.style().copy(color = palette.destructive), modifier = Modifier.padding(top = 8.dp))
                    }

                    // One row to swipe through: on a phone, wrapping would push the gallery off the first screen.
                    LazyRow(Modifier.padding(top = 14.dp), contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(state.starters, key = { it.id }) { starter ->
                            Chip(starter.label, STARTER_ICONS[starter.id] ?: Icons.Rounded.Movie, selected = state.openStarter == starter.id, hint = "Show example requests") { model.toggle(starter) }
                        }
                    }

                    val open = state.starters.firstOrNull { it.id == state.openStarter }
                    AnimatedVisibility(open != null, enter = expandVertically(motion.morph()) + fadeIn(motion.morph()), exit = shrinkVertically(motion.exit()) + fadeOut(motion.exit())) {
                        Column(Modifier.padding(top = 8.dp).padding(horizontal = 16.dp)) {
                            for (example in open?.examples.orEmpty()) {
                                BasicText(
                                    example,
                                    style = TypeSize.Body.style().copy(color = palette.mutedForeground),
                                    modifier = Modifier.fillMaxWidth().pressable(label = "Put this in the composer") { use(example, open!!.app) }.padding(horizontal = 16.dp, vertical = 12.dp),
                                )
                            }
                        }
                    }
                }
            }

            when (state.phase) {
                Phase.Loading -> GallerySkeleton()
                Phase.Failed -> LoadFailure("Home didn't load. Check your connection and try again.") { model.load() }
                Phase.Loaded -> if (state.showcase.isNotEmpty()) {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 36.dp, bottom = 14.dp), verticalAlignment = Alignment.Bottom) {
                        BasicText("Made here", style = TypeSize.Body.style(FontWeight.SemiBold).copy(color = palette.foreground), modifier = Modifier.semantics { heading() })
                        Spacer(Modifier.weight(1f))
                        BasicText("Pick one to start from its prompt", style = TypeSize.Caption.style().copy(color = palette.subtleForeground))
                    }
                    ShowcaseGrid(state.showcase) { use(it.prompt, it.app) }
                }
            }
            Spacer(Modifier.windowInsetsPadding(WindowInsets.navigationBars).height(32.dp))
        }
    }
}

/** The instance's own picture behind the composer, fading into the page before the gallery. */
@Composable
private fun HomeBackdrop(instance: InstanceDescription?) {
    val palette = LocalPalette.current
    val dark = isSystemInDarkTheme()
    val home = instance?.home
    // A night sky belongs to the dark theme; on the light theme the page stays pale, as on the web.
    val picture = (home?.backgroundPoster ?: home?.backgroundImage)?.takeIf { dark || home?.aurora != true }
    Box(Modifier.fillMaxWidth().height(560.dp)) {
        if (picture != null) {
            AsyncImage(model = picture, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            // A light scrim on the dark theme, a heavier one on the light, as on the web.
            Box(Modifier.fillMaxSize().background(palette.panel.copy(alpha = if (dark) 0.22f else 0.66f)))
        }
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.55f to Color.Transparent, 1f to palette.background)))
    }
}

/** Examples in two columns, each tile at its own shape. A tile hands its prompt to the composer; it never sends. */
@Composable
private fun ShowcaseGrid(items: List<ShowcaseItem>, onUse: (ShowcaseItem) -> Unit) {
    // Fill the shorter column first, so the two stay level whatever the shapes.
    val left = mutableListOf<ShowcaseItem>()
    val right = mutableListOf<ShowcaseItem>()
    var leftHeight = 0f
    var rightHeight = 0f
    for (item in items) {
        val height = 1 / aspectRatio(item.aspect.value)
        if (leftHeight <= rightHeight) { left += item; leftHeight += height } else { right += item; rightHeight += height }
    }
    Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        for (column in listOf(left, right)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                for (item in column) ShowcaseTile(item) { onUse(item) }
            }
        }
    }
}

@Composable
private fun ShowcaseTile(item: ShowcaseItem, onUse: () -> Unit) {
    val palette = LocalPalette.current
    val shape = RoundedCornerShape(Radius.Media.dp)
    val (icon, label) = when {
        item.app.startsWith("live") -> Icons.Rounded.Sensors to "Live"
        item.kind == MediaKind.Image -> Icons.Rounded.Image to "Image"
        item.kind == MediaKind.Audio -> Icons.Rounded.GraphicEq to "Audio"
        else -> Icons.Rounded.PlayArrow to (item.durationSeconds?.let { "${it.toInt()}s" } ?: "Video")
    }
    Box(
        Modifier
            .fillMaxWidth()
            .aspectRatio(aspectRatio(item.aspect.value))
            .pressable(onClick = onUse)
            .semantics(mergeDescendants = true) { contentDescription = "Use the prompt for “${item.title}”" }
            .clip(shape)
            .border(1.dp, palette.hairline, shape),
    ) {
        MediaStill(item.image, item.artwork, Modifier.fillMaxSize())
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.4f to Color.Transparent, 1f to Color.Black.copy(alpha = 0.7f))))
        Row(
            Modifier.padding(10.dp).background(Color.Black.copy(alpha = 0.45f), CircleShape).height(24.dp).padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(12.dp))
            BasicText(label, style = TypeSize.Caption.style(mono = true).copy(color = Color.White))
        }
        BasicText(item.title, style = TypeSize.Body.style(FontWeight.Medium).copy(color = Color.White), modifier = Modifier.align(Alignment.BottomStart).padding(12.dp))
    }
}

/** The gallery's shape while it loads, so nothing shifts when it arrives. */
@Composable
private fun GallerySkeleton() {
    val palette = LocalPalette.current
    Row(Modifier.padding(horizontal = 16.dp).padding(top = 28.dp).breathing().semantics { contentDescription = "Loading examples" }, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        for (column in 0..1) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                for (row in 0..2) Box(Modifier.fillMaxWidth().aspectRatio(if ((row + column) % 2 == 0) 16f / 9f else 1f).background(palette.card, RoundedCornerShape(Radius.Media.dp)))
            }
        }
    }
}
