package app.aquareum.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.aquareum.api.ApiError
import app.aquareum.generated.Api
import app.aquareum.generated.Conversation
import app.aquareum.generated.Generation
import app.aquareum.generated.GenerationState
import app.aquareum.generated.Message
import app.aquareum.generated.AgentMessageState
import app.aquareum.home.Draft
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeSource

data class ConversationState(
    /** Null until the first read, when the screen was opened by id alone. */
    val conversation: Conversation? = null,
    val generations: Map<String, Generation> = emptyMap(),
    /** How each capability reads where it did a piece of work, keyed by app. */
    val labels: Map<String, String> = emptyMap(),
    val draft: Draft = Draft(),
    val sending: Boolean = false,
    val sendError: String? = null,
    /** Set when the conversation can't be read at all. */
    val loadFailed: Boolean = false,
) {
    private val generationIds: List<String>
        get() = conversation?.messages.orEmpty().flatMap { (it as? Message.Agent)?.value?.generationIds.orEmpty() }

    val pendingGenerations: List<String>
        get() = generationIds.filter { id -> generations[id]?.state.let { it == null || it == GenerationState.Queued || it == GenerationState.Running } }

    /** True while there is something to wait for: a turn in progress or a shot still rendering. */
    val working: Boolean
        get() = conversation == null || pendingGenerations.isNotEmpty() || conversation.messages.any { (it as? Message.Agent)?.value?.state == AgentMessageState.Working }
}

/** One conversation, kept current while the agent works. */
class ConversationViewModel(private val api: Api, private val id: String, seed: Conversation?) : ViewModel() {
    private val _state = MutableStateFlow(ConversationState(conversation = seed))
    val state: StateFlow<ConversationState> = _state

    fun setDraft(draft: Draft) = _state.update { it.copy(draft = draft) }

    /**
     * Follows the conversation until nothing is in progress: quick at first, then backing off, as a
     * long render doesn't need watching closely. Ends when the caller is cancelled, which the screen
     * does when it is no longer in front.
     */
    suspend fun follow() {
        if (_state.value.labels.isEmpty()) {
            runCatching { api.listCapabilityLabels() }.onSuccess { all -> _state.update { it.copy(labels = all.associate { label -> label.app to label.work }) } }
        }
        val started = TimeSource.Monotonic.markNow()
        while (true) {
            refresh()
            if (!_state.value.working || _state.value.loadFailed) return
            val elapsed = started.elapsedNow()
            delay(if (elapsed < 10.seconds) 700.milliseconds else if (elapsed < 30.seconds) 1500.milliseconds else if (elapsed < 90.seconds) 3.seconds else 5.seconds)
        }
    }

    private suspend fun refresh() {
        try {
            val fresh = api.getConversation(id)
            _state.update { it.copy(conversation = fresh, loadFailed = false) }
        } catch (error: ApiError) {
            if (error.status == 404 || error.isSignedOut) _state.update { it.copy(loadFailed = true) }
            return
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            return // A dropped poll is retried on the next turn of the loop.
        }
        val read = coroutineScope { _state.value.pendingGenerations.map { id -> async { runCatching { api.getGeneration(id) }.getOrNull() } }.awaitAll() }.filterNotNull()
        if (read.isNotEmpty()) _state.update { it.copy(generations = it.generations + read.associateBy { generation -> generation.id }) }
    }

    fun retry() {
        _state.update { it.copy(loadFailed = false) }
        viewModelScope.launch { follow() }
    }

    fun send() {
        val draft = _state.value.draft
        if (!draft.canSend || _state.value.sending) return
        _state.update { it.copy(sending = true, sendError = null) }
        viewModelScope.launch {
            try {
                val fresh = api.sendMessage(id, text = draft.prompt.trim())
                _state.update { it.copy(conversation = fresh, sending = false, draft = Draft()) }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                _state.update { it.copy(sending = false, sendError = "That message didn’t send. Try again.") }
            }
        }
    }
}
