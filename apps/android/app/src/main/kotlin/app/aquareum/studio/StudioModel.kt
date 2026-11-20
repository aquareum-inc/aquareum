package app.aquareum.studio

import app.aquareum.generated.Api
import app.aquareum.generated.Generation
import app.aquareum.generated.GenerationState
import app.aquareum.generated.MediaKind
import app.aquareum.generated.StudioMedium
import app.aquareum.generated.StudioMode
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeSource

/** One studio draft: the words, the mode and the settings for one medium. */
data class StudioDraft(
    val mode: String,
    val prompt: String = "",
    val aspect: String? = null,
    val durationSeconds: Double? = null,
    val resolution: String? = null,
    val variants: Int = 1,
) {
    val canGenerate: Boolean get() = prompt.isNotBlank()
}

data class StudioState(
    val loading: Boolean = true,
    val failed: Boolean = false,
    val mediums: List<StudioMedium> = emptyList(),
    val kind: MediaKind = MediaKind.Video,
    val drafts: Map<MediaKind, StudioDraft> = emptyMap(),
    val made: Map<MediaKind, List<Generation>> = emptyMap(),
    /** What one result of the current draft costs, once quoted. */
    val quote: Int? = null,
    val generating: Boolean = false,
    /** Why the last Generate didn't start, in words for the person. */
    val error: String? = null,
) {
    val medium: StudioMedium? get() = mediums.firstOrNull { it.kind == kind }

    /** The modes the apps can offer: those that don't need an input to upload. */
    val modes: List<StudioMode> get() = medium?.modes.orEmpty().filterNot { it.needsInput }
    val draft: StudioDraft get() = drafts[kind] ?: fresh(kind)
    val mode: StudioMode? get() = modes.firstOrNull { it.value == draft.mode } ?: modes.firstOrNull()
    val results: List<Generation> get() = made[kind].orEmpty()
    val cost: Int? get() = quote?.let { it * draft.variants }
    val rendering: Boolean get() = made.values.flatten().any { it.state == GenerationState.Queued || it.state == GenerationState.Running }

    /** Gives a draft opened with words before the studio loaded this medium's defaults, keeping the words. */
    fun settled(): StudioState = copy(drafts = drafts.mapValues { (kind, draft) -> if (draft.mode.isEmpty()) fresh(kind).copy(prompt = draft.prompt) else draft })

    fun fresh(kind: MediaKind): StudioDraft {
        val medium = mediums.firstOrNull { it.kind == kind }
        val mode = medium?.modes?.firstOrNull { !it.needsInput }
        return StudioDraft(mode = mode?.value.orEmpty(), aspect = medium?.aspects?.firstOrNull()?.value, durationSeconds = mode?.durations?.firstOrNull(), resolution = medium?.resolutions?.firstOrNull()?.value)
    }
}

/**
 * The studio: one medium at a time, a draft for each, and what each has made, newest first. Which mediums
 * and modes exist, and what each runs, comes from the instance (`list_studio_mediums`), which reads the web's
 * own studio. Modes that only make sense with an input to upload aren't offered until the apps can send one.
 */
class StudioModel(private val api: Api) {
    private val _state = MutableStateFlow(StudioState())
    val state: StateFlow<StudioState> = _state

    suspend fun load() {
        try {
            val mediums = api.listStudioMediums()
            _state.update { it.copy(loading = false, failed = false, mediums = mediums).settled() }
            requote()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            _state.update { it.copy(loading = false, failed = it.mediums.isEmpty()) }
        }
    }

    fun choose(kind: MediaKind) = _state.update { it.copy(kind = kind, error = null) }

    fun setDraft(draft: StudioDraft) = _state.update { it.copy(drafts = it.drafts + (it.kind to draft)) }

    /** Opens a medium with words to start from, as "Open in the studio" does from a conversation. */
    fun open(kind: MediaKind, prompt: String) = _state.update { state ->
        val draft = (state.drafts[kind] ?: state.fresh(kind)).copy(prompt = prompt)
        state.copy(kind = kind, drafts = state.drafts + (kind to draft))
    }

    /** Changes mode, keeping the words and the shape. */
    fun choose(mode: StudioMode) {
        val draft = _state.value.draft
        val durations = mode.durations
        setDraft(draft.copy(mode = mode.value, durationSeconds = if (durations == null) null else draft.durationSeconds?.takeIf { it in durations } ?: durations.firstOrNull()))
    }

    /** Reads the price of one result again, after anything that changes it. */
    suspend fun requote() {
        val state = _state.value
        val mode = state.mode ?: return _state.update { it.copy(quote = null) }
        val quote = runCatching { api.quoteGeneration(state.kind.value, mode.app, state.draft.durationSeconds, state.draft.resolution) }.getOrNull()
        _state.update { it.copy(quote = quote?.credits?.toInt()) }
    }

    /** Starts the draft, once per variant. Each result appears at once and renders in place. */
    suspend fun generate(): Boolean {
        val state = _state.value
        val mode = state.mode ?: return false
        if (!mode.available || !state.draft.canGenerate || state.generating) return false
        _state.update { it.copy(generating = true, error = null) }
        val draft = state.draft
        val kind = state.kind
        return try {
            val started = coroutineScope {
                (1..draft.variants).map {
                    async { api.createGeneration(kind.value, mode.app, draft.prompt.trim(), draft.aspect, draft.durationSeconds, draft.resolution) }
                }.awaitAll()
            }
            _state.update { it.copy(generating = false, made = it.made + (kind to started + it.made[kind].orEmpty())) }
            true
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            _state.update { it.copy(generating = false, error = "That didn’t start. Nothing was charged — try again.") }
            false
        }
    }

    /** Follows what is rendering until it finishes: quick at first, then backing off. */
    suspend fun follow() {
        val started = TimeSource.Monotonic.markNow()
        while (_state.value.rendering) {
            val elapsed = started.elapsedNow()
            delay(if (elapsed < 10.seconds) 700.milliseconds else if (elapsed < 30.seconds) 1500.milliseconds else if (elapsed < 90.seconds) 3.seconds else 5.seconds)
            val pending = _state.value.made.values.flatten().filter { it.state == GenerationState.Queued || it.state == GenerationState.Running }
            val fresh = coroutineScope { pending.map { async { runCatching { api.getGeneration(it.id) }.getOrNull() } }.awaitAll() }.filterNotNull().associateBy { it.id }
            _state.update { state -> state.copy(made = state.made.mapValues { (_, list) -> list.map { fresh[it.id] ?: it } }) }
        }
    }

    /** Puts a result's words back in the draft, to change and try again. */
    fun reuse(generation: Generation) = setDraft(_state.value.draft.copy(prompt = generation.request.prompt))
}
