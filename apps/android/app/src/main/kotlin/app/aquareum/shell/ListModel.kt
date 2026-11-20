package app.aquareum.shell

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.aquareum.account.Account
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** What a list a person has to be signed in for shows. */
sealed interface ListState<out T> {
    data object SignedOut : ListState<Nothing>
    data object Loading : ListState<Nothing>
    data object Failed : ListState<Nothing>
    data class Loaded<T>(val items: List<T>) : ListState<T>
}

/**
 * A tab that lists the signed-in person's things: loads when they sign in, empties when they sign out, and
 * keeps what it has when a refresh fails.
 */
class ListModel<T>(account: Account, private val read: suspend () -> List<T>) : ViewModel() {
    private val _state = MutableStateFlow<ListState<T>>(ListState.SignedOut)
    val state: StateFlow<ListState<T>> = _state

    init {
        viewModelScope.launch {
            account.signedIn.collect { signedIn ->
                if (signedIn) {
                    _state.value = ListState.Loading
                    refresh()
                } else {
                    _state.value = ListState.SignedOut
                }
            }
        }
    }

    fun load() = viewModelScope.launch { refresh() }

    suspend fun refresh() {
        try {
            val items = read()
            _state.update { if (it is ListState.SignedOut) it else ListState.Loaded(items) }
        } catch (error: Exception) {
            if (error is kotlinx.coroutines.CancellationException) throw error
            _state.update { if (it is ListState.Loaded || it is ListState.SignedOut) it else ListState.Failed }
        }
    }
}
