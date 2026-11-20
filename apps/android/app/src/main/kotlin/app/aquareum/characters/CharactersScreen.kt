package app.aquareum.characters

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.aquareum.design.LoadFailure
import app.aquareum.design.LocalPalette
import app.aquareum.design.MediaStill
import app.aquareum.design.style
import app.aquareum.generated.Character
import app.aquareum.generated.TypeSize
import app.aquareum.shell.EmptyState
import app.aquareum.shell.ListModel
import app.aquareum.shell.ListState
import app.aquareum.shell.SignedOutState
import app.aquareum.shell.TabPage
import kotlinx.coroutines.launch

/** The characters the person can chat with: their own and the public ones. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CharactersScreen(model: ListModel<Character>, signIn: () -> Unit, accountButton: @Composable () -> Unit) {
    val state by model.state.collectAsStateWithLifecycle()
    val palette = LocalPalette.current
    val scope = rememberCoroutineScope()
    var refreshing by remember { mutableStateOf(false) }

    TabPage("Characters", accountButton) {
        when (val current = state) {
            ListState.SignedOut -> SignedOutState(Icons.Rounded.Groups, "Characters", "Chat with characters people have made, or make your own. Sign in to meet them.", signIn)
            ListState.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = palette.mutedForeground) }
            ListState.Failed -> LoadFailure("Characters didn't load. Check your connection and try again.", Modifier.fillMaxSize()) { model.load() }
            is ListState.Loaded -> if (current.items.isEmpty()) {
                EmptyState(Icons.Rounded.Groups, "No characters yet", "Characters made here show up in this list.")
            } else {
                PullToRefreshBox(refreshing, onRefresh = { scope.launch { refreshing = true; model.refresh(); refreshing = false } }) {
                    LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)) {
                        items(current.items, key = { it.slug }) { character ->
                            Row(Modifier.fillMaxWidth().padding(vertical = 10.dp).semantics(mergeDescendants = true) {}, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                MediaStill(character.image, character.artwork, Modifier.size(48.dp).clip(CircleShape).border(1.dp, palette.hairline, CircleShape))
                                Column {
                                    BasicText(character.name, style = TypeSize.Body.style(FontWeight.SemiBold).copy(color = palette.foreground))
                                    BasicText(character.tagline, style = TypeSize.Body.style().copy(color = palette.mutedForeground), maxLines = 2)
                                }
                            }
                            HorizontalDivider(Modifier.padding(start = 60.dp), color = palette.hairline)
                        }
                    }
                }
            }
        }
    }
}
