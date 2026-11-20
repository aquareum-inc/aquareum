package app.aquareum.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.aquareum.account.Account
import app.aquareum.api.ApiError
import app.aquareum.generated.Api
import app.aquareum.generated.Conversation
import app.aquareum.generated.PromptStarter
import app.aquareum.generated.ShowcaseItem
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class Phase { Loading, Loaded, Failed }

data class HomeState(
    val phase: Phase = Phase.Loading,
    val starters: List<PromptStarter> = emptyList(),
    val showcase: List<ShowcaseItem> = emptyList(),
    val draft: Draft = Draft(),
    val openStarter: String? = null,
    val sending: Boolean = false,
    /** Why the last send didn't go through, in words for the user. */
    val sendError: String? = null,
)

class HomeViewModel(private val api: Api, account: Account) : ViewModel() {
    private val _state = MutableStateFlow(HomeState())
    val state: StateFlow<HomeState> = _state

    init {
        load()
        // Again on signing in or out: what loaded with an old session may have been refused.
        viewModelScope.launch { account.signedIn.drop(1).collect { refresh() } }
    }

    fun load() = viewModelScope.launch { refresh() }

    suspend fun refresh() {
        _state.update { if (it.phase == Phase.Failed) it.copy(phase = Phase.Loading) else it }
        try {
            coroutineScope {
                val starters = async { api.listPromptStarters() }
                val showcase = async { api.listShowcase() }
                val loaded = starters.await() to showcase.await()
                _state.update { it.copy(phase = Phase.Loaded, starters = loaded.first, showcase = loaded.second) }
            }
        } catch (error: Exception) {
            if (error is kotlinx.coroutines.CancellationException) throw error
            _state.update { if (it.starters.isEmpty() && it.showcase.isEmpty()) it.copy(phase = Phase.Failed) else it }
        }
    }

    fun setDraft(draft: Draft) = _state.update { it.copy(draft = draft) }

    /** Opens or closes a starting point. It reveals examples; it never sends. */
    fun toggle(starter: PromptStarter) = _state.update {
        val closing = it.openStarter == starter.id
        it.copy(openStarter = if (closing) null else starter.id, draft = if (closing) it.draft else it.draft.copy(app = starter.app))
    }

    /** Puts an example's words in the composer, ready to edit. */
    fun fill(prompt: String, app: String) = _state.update { it.copy(draft = it.draft.copy(prompt = prompt, app = app), openStarter = null) }

    fun send(onOpen: (Conversation) -> Unit) {
        val draft = _state.value.draft
        if (!draft.canSend || _state.value.sending) return
        _state.update { it.copy(sending = true, sendError = null) }
        viewModelScope.launch {
            try {
                val conversation = api.createConversation(text = draft.prompt.trim(), app = draft.app, aspect = draft.aspect, durationSeconds = draft.durationSeconds.toDouble())
                _state.update { it.copy(sending = false, draft = Draft()) }
                onOpen(conversation)
            } catch (error: Exception) {
                if (error is kotlinx.coroutines.CancellationException) throw error
                val message = if (error is ApiError && error.isSignedOut) "Sign in to send a request." else "That didn't send. Check your connection and try again."
                _state.update { it.copy(sending = false, sendError = message) }
            }
        }
    }
}
