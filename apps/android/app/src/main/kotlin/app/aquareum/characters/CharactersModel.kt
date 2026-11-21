package app.aquareum.characters

import app.aquareum.generated.Api
import app.aquareum.generated.Character
import app.aquareum.generated.ReportReason
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update

data class CharactersState(
    val loading: Boolean = true,
    val failed: Boolean = false,
    val all: List<Character> = emptyList(),
    /** Narrows the shared characters by name, role or subject. */
    val query: String = "",
) {
    /** The person's own. A guest has none. */
    fun mine(signedIn: Boolean): List<Character> = if (signedIn) all.filter { it.mine } else emptyList()

    /** Everyone else's, as the search narrows them. */
    val shared: List<Character>
        get() {
            val others = all.filterNot { it.mine }
            val needle = query.trim().lowercase()
            if (needle.isEmpty()) return others
            return others.filter { character -> (listOf(character.name, character.tagline) + character.tags).any { needle in it.lowercase() } }
        }
}

/** A new character, as the form holds it. */
data class CharacterDraft(
    val name: String = "",
    val tagline: String = "",
    val description: String = "",
    val greeting: String = "",
    val shared: Boolean = false,
) {
    val canCreate: Boolean get() = name.isNotBlank() && description.isNotBlank() && greeting.isNotBlank()

    companion object {
        const val NAME = 40
        const val TAGLINE = 80
        const val DESCRIPTION = 2000
        const val GREETING = 300
    }
}

/** The person's own characters and those shared on the instance, and what can be done with them. */
class CharactersModel(private val api: Api) {
    private val _state = MutableStateFlow(CharactersState())
    val state: StateFlow<CharactersState> = _state

    suspend fun load() {
        try {
            val all = api.listCharacters()
            _state.update { it.copy(loading = false, failed = false, all = all) }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            _state.update { it.copy(loading = false, failed = it.all.isEmpty()) }
        }
    }

    fun setQuery(query: String) = _state.update { it.copy(query = query) }

    fun find(slug: String): Character? = _state.value.all.firstOrNull { it.slug == slug }

    /** Makes a character and puts it first among the person's own. Null when it didn't save. */
    suspend fun create(draft: CharacterDraft): Character? = try {
        api.createCharacter(
            name = draft.name.trim(),
            description = draft.description.trim(),
            greeting = draft.greeting.trim(),
            tagline = draft.tagline.trim(),
            visibility = if (draft.shared) "public" else "private",
        ).also { made -> _state.update { it.copy(all = listOf(made) + it.all) } }
    } catch (error: CancellationException) {
        throw error
    } catch (error: Exception) {
        null
    }

    /** Sends a report to the instance's operator. True once it's received. */
    suspend fun report(character: Character, reason: ReportReason, note: String): Boolean = attempt {
        api.reportCharacter(character.slug, reason.value, note.trim().ifEmpty { null })
    }

    /** Blocks a character. It, and everything else by its author, leaves the list at once. */
    suspend fun block(character: Character): Boolean = attempt { api.blockCharacter(character.slug) }.also { blocked ->
        if (blocked) _state.update { state -> state.copy(all = state.all.filter { it.mine || (it.slug != character.slug && it.author != character.author) }) }
    }

    /** Forgets the person's own characters once they sign out. */
    fun signedOut() = _state.update { state -> state.copy(all = state.all.filterNot { it.mine }) }

    private suspend fun attempt(call: suspend () -> Unit): Boolean = try {
        call()
        true
    } catch (error: CancellationException) {
        throw error
    } catch (error: Exception) {
        false
    }
}

/** The reasons a person can choose, in the order the report tray lists them. */
val REPORT_REASONS = listOf(ReportReason.Sexual, ReportReason.Hateful, ReportReason.Violent, ReportReason.Impersonation, ReportReason.Spam, ReportReason.Other)

val ReportReason.label: String
    get() = when (this) {
        ReportReason.Sexual -> "Sexual content"
        ReportReason.Hateful -> "Hateful or harassing"
        ReportReason.Violent -> "Violent or dangerous"
        ReportReason.Impersonation -> "Pretends to be a real person"
        ReportReason.Spam -> "Spam or a scam"
        ReportReason.Other, ReportReason.Unknown -> "Something else"
    }

/** A count as people say it, to two figures: 940, 5.4K, 18K, 1.2M. */
fun compactCount(count: Double): String {
    val (scaled, unit) = when {
        count >= 1_000_000 -> count / 1_000_000 to "M"
        count >= 1_000 -> count / 1_000 to "K"
        else -> return count.toLong().toString()
    }
    val figures = if (scaled < 10) "%.1f".format(java.util.Locale.ENGLISH, scaled).removeSuffix(".0") else Math.round(scaled).toString()
    return figures + unit
}
