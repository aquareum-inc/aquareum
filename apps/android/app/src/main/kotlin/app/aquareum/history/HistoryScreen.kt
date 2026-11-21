package app.aquareum.history

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Forum
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.aquareum.design.LoadFailure
import app.aquareum.design.LocalPalette
import app.aquareum.design.pressable
import app.aquareum.design.style
import app.aquareum.generated.Api
import app.aquareum.generated.ConversationSummary
import app.aquareum.generated.TypeSize
import app.aquareum.shell.EmptyState
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

data class HistoryState(
    val loading: Boolean = true,
    val failed: Boolean = false,
    val conversations: List<ConversationSummary> = emptyList(),
    /** Why the last delete didn't go through. */
    val deleteError: String? = null,
)

/** The person's conversations, newest first. */
class HistoryViewModel(private val api: Api) : ViewModel() {
    private val _state = MutableStateFlow(HistoryState())
    val state: StateFlow<HistoryState> = _state

    init {
        load()
    }

    fun load() = viewModelScope.launch {
        try {
            val conversations = api.listConversations()
            _state.update { it.copy(loading = false, failed = false, conversations = conversations) }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            _state.update { it.copy(loading = false, failed = it.conversations.isEmpty()) }
        }
    }

    /** Conversations whose title holds every word of the search. */
    fun matching(search: String): List<ConversationSummary> {
        val words = search.lowercase().split(' ').filter(String::isNotBlank)
        return _state.value.conversations.filter { summary -> words.all { it in summary.title.lowercase() } }
    }

    /** Deletes a conversation. It leaves the list at once and comes back if the instance refuses. */
    fun delete(summary: ConversationSummary) {
        val before = _state.value.conversations
        _state.update { it.copy(conversations = before - summary, deleteError = null) }
        viewModelScope.launch {
            try {
                api.deleteConversation(summary.id)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                _state.update { it.copy(conversations = before, deleteError = "“${summary.title}” wasn't deleted. Try again.") }
            }
        }
    }
}

/** The person's conversations: search by title, open one, swipe to delete. */
@Composable
fun HistoryScreen(model: HistoryViewModel, onBack: () -> Unit, open: (ConversationSummary) -> Unit) {
    val palette = LocalPalette.current
    val state by model.state.collectAsStateWithLifecycle()
    var search by rememberSaveable { mutableStateOf("") }
    var deleting by rememberSaveable { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxSize().background(palette.background).windowInsetsPadding(WindowInsets.statusBars)) {
        Row(Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(48.dp).pressable(round = true, onClick = onBack).semantics { contentDescription = "Back" }, contentAlignment = Alignment.Center) {
                Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = null, tint = palette.foreground, modifier = Modifier.size(22.dp))
            }
            BasicText("Conversations", style = TypeSize.Lead.style(FontWeight.SemiBold).copy(color = palette.foreground), modifier = Modifier.padding(start = 4.dp).semantics { heading() })
        }
        BasicTextField(
            value = search,
            onValueChange = { search = it },
            singleLine = true,
            textStyle = TypeSize.Lead.style().copy(color = palette.foreground),
            cursorBrush = SolidColor(palette.foreground),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp).semantics { contentDescription = "Search by title" },
            decorationBox = { field ->
                Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).background(palette.card, CircleShape).border(1.dp, palette.hairline, CircleShape).padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Rounded.Search, contentDescription = null, tint = palette.mutedForeground, modifier = Modifier.size(20.dp))
                    Box { if (search.isEmpty()) BasicText("Search by title", style = TypeSize.Lead.style().copy(color = palette.subtleForeground)); field() }
                }
            },
        )

        when {
            state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = palette.mutedForeground) }
            state.failed -> LoadFailure("Your conversations didn't load. Check your connection and try again.", Modifier.fillMaxSize()) { model.load() }
            state.conversations.isEmpty() -> EmptyState(Icons.Rounded.Forum, "No conversations yet", "What you ask for on Home starts one, and it shows up here.")
            else -> {
                val shown = model.matching(search)
                LazyColumn(contentPadding = PaddingValues(vertical = 8.dp)) {
                    state.deleteError?.let { error -> item { BasicText(error, style = TypeSize.Body.style().copy(color = palette.destructive), modifier = Modifier.padding(16.dp)) } }
                    items(shown, key = { it.id }) { summary -> Row(summary, onOpen = { open(summary) }, onDelete = { deleting = summary.id }) }
                    if (shown.isEmpty()) item { BasicText("Nothing matches “$search”.", style = TypeSize.Body.style().copy(color = palette.mutedForeground), modifier = Modifier.padding(16.dp)) }
                }
            }
        }
    }

    state.conversations.firstOrNull { it.id == deleting }?.let { summary ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Delete this conversation?") },
            text = { Text("Its shots stay in your library. This can't be undone.") },
            confirmButton = { TextButton({ deleting = null; model.delete(summary) }) { Text("Delete", color = palette.destructive) } },
            dismissButton = { TextButton({ deleting = null }) { Text("Cancel", color = palette.foreground) } },
            containerColor = palette.popover,
            titleContentColor = palette.foreground,
            textContentColor = palette.mutedForeground,
        )
    }
}

/** One conversation. Swiping it away asks to delete it; it stays until confirmed. */
@Composable
private fun Row(summary: ConversationSummary, onOpen: () -> Unit, onDelete: () -> Unit) {
    val palette = LocalPalette.current
    val swipe = rememberSwipeToDismissBoxState()
    LaunchedEffect(swipe.currentValue) {
        if (swipe.currentValue == SwipeToDismissBoxValue.EndToStart) {
            onDelete()
            swipe.reset()
        }
    }
    SwipeToDismissBox(
        state = swipe,
        enableDismissFromStartToEnd = false,
        backgroundContent = {
            Box(Modifier.fillMaxSize().background(palette.destructiveFill).padding(horizontal = 24.dp), contentAlignment = Alignment.CenterEnd) {
                Icon(Icons.Rounded.Delete, contentDescription = null, tint = androidx.compose.ui.graphics.Color.White)
            }
        },
    ) {
        Column(
            Modifier.fillMaxWidth().background(palette.background).pressable(onClick = onOpen)
                .semantics { customActions = listOf(CustomAccessibilityAction("Delete") { onDelete(); true }) }
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            BasicText(summary.title, style = TypeSize.Body.style(FontWeight.Medium).copy(color = palette.foreground), maxLines = 2, overflow = TextOverflow.Ellipsis)
            BasicText(whenChanged(summary.updatedAt), style = TypeSize.Caption.style(mono = true).copy(color = palette.subtleForeground))
        }
    }
    HorizontalDivider(Modifier.padding(horizontal = 16.dp), color = palette.hairline)
}

/** "Today, 14:05", "Yesterday", "12 Nov": when it last changed, in the person's own format. */
private fun whenChanged(stamp: String): String = runCatching {
    val time = OffsetDateTime.parse(stamp).atZoneSameInstant(ZoneId.systemDefault())
    val today = LocalDate.now()
    when (time.toLocalDate()) {
        today -> "Today, " + time.format(DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT))
        today.minusDays(1) -> "Yesterday"
        else -> time.format(DateTimeFormatter.ofPattern("d MMM"))
    }
}.getOrDefault("")
