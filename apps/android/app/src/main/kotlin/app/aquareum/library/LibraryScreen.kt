package app.aquareum.library

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesomeMosaic
import androidx.compose.material.icons.rounded.GridView
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.aquareum.design.LoadFailure
import app.aquareum.design.LocalPalette
import app.aquareum.design.MediaStill
import app.aquareum.design.breathing
import app.aquareum.design.style
import app.aquareum.generated.MediaItem
import app.aquareum.generated.Radius
import app.aquareum.generated.TypeSize
import app.aquareum.shell.EmptyState
import app.aquareum.shell.ListModel
import app.aquareum.shell.ListState
import app.aquareum.shell.SignedOutState
import app.aquareum.shell.TabPage
import kotlinx.coroutines.launch

/** Everything the person has made or added, newest first. A guest sees what the library is for. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(model: ListModel<MediaItem>, signIn: () -> Unit, accountButton: @Composable () -> Unit) {
    val state by model.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    var refreshing by remember { mutableStateOf(false) }

    TabPage("Library", accountButton) {
        when (val current = state) {
            ListState.SignedOut -> SignedOutState(Icons.Rounded.GridView, "Your library", "Everything you make is kept here, searchable by what's in it. Sign in to see yours.", signIn)
            ListState.Loading -> Skeleton()
            ListState.Failed -> LoadFailure("Your library didn't load. Check your connection and try again.", Modifier.fillMaxSize()) { model.load() }
            is ListState.Loaded -> if (current.items.isEmpty()) {
                EmptyState(Icons.Rounded.AutoAwesomeMosaic, "Nothing here yet", "What you make on Home shows up here.")
            } else {
                PullToRefreshBox(refreshing, onRefresh = { scope.launch { refreshing = true; model.refresh(); refreshing = false } }) {
                    LazyVerticalGrid(GridCells.Fixed(2), contentPadding = PaddingValues(16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        items(current.items, key = { it.id }) { Tile(it) }
                    }
                }
            }
        }
    }
}

@Composable
private fun Tile(item: MediaItem) {
    val palette = LocalPalette.current
    val shape = RoundedCornerShape(Radius.Media.dp)
    Box(Modifier.fillMaxWidth().aspectRatio(1f).clip(shape).border(1.dp, palette.hairline, shape).clearAndSetSemantics { contentDescription = item.title }) {
        MediaStill(item.image, item.artwork, Modifier.fillMaxSize())
        BasicText(
            item.title,
            style = TypeSize.Caption.style(FontWeight.Medium).copy(color = Color.White),
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.align(Alignment.BottomStart).fillMaxWidth().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.65f)))).padding(10.dp),
        )
    }
}

/** The grid's shape while it loads. */
@Composable
private fun Skeleton() {
    val palette = LocalPalette.current
    LazyVerticalGrid(GridCells.Fixed(2), contentPadding = PaddingValues(16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp), userScrollEnabled = false, modifier = Modifier.breathing()) {
        items(6) { Box(Modifier.fillMaxWidth().aspectRatio(1f).background(palette.card, RoundedCornerShape(Radius.Media.dp))) }
    }
}
