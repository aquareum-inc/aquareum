package app.aquareum.account

import android.net.Uri
import android.util.Base64
import app.aquareum.BuildConfig
import app.aquareum.InstanceStore
import app.aquareum.api.Refusal
import app.aquareum.api.TokenVault
import app.aquareum.generated.Api
import app.aquareum.generated.Me
import app.aquareum.generated.SignInMethodName
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.security.MessageDigest
import java.security.SecureRandom

/** An open sign-in tray, and what it's for. */
data class SignInPrompt(val reason: String?)

/** Where a sign-in started from the tray has got to. */
sealed interface SignInProgress {
    data object Idle : SignInProgress
    data class Busy(val method: SignInMethodName) : SignInProgress
    data class Failed(val message: String) : SignInProgress
}

/**
 * Who is using the app: a guest, or a person signed in with a device session of their own.
 *
 * Sign-in runs in an Auth Tab (a Custom Tab where the browser has no Auth Tab), never a web view. The instance
 * hands a one-time code back to this app's own address, and the app exchanges it with the PKCE verifier only
 * it holds for a device session.
 */
class Account(
    private val api: Api,
    private val vault: TokenVault,
    private val instance: InstanceStore,
    private val scope: CoroutineScope,
    /** How this device appears in the person's list of devices. */
    private val deviceName: String,
) {
    private val _signedIn = MutableStateFlow(vault.token != null)
    private val _me = MutableStateFlow<Me?>(null)
    private val _prompt = MutableStateFlow<SignInPrompt?>(null)
    private val _progress = MutableStateFlow<SignInProgress>(SignInProgress.Idle)

    val signedIn: StateFlow<Boolean> = _signedIn
    val me: StateFlow<Me?> = _me
    /** The sign-in tray, when it's open. */
    val prompt: StateFlow<SignInPrompt?> = _prompt
    val progress: StateFlow<SignInProgress> = _progress
    /** Something to tell the person once, such as "You've been signed out." */
    val notice = MutableStateFlow<String?>(null)

    private var waiting: CompletableDeferred<Boolean>? = null
    /** The sign-in under way: its verifier and state, kept until the browser comes back. */
    private var pending: Pair<String, String>? = null

    /** Called by the transport, on any thread. */
    fun refused(refusal: Refusal) {
        scope.launch {
            if (refusal.error.isMobileOff) {
                instance.refresh()
            } else if (refusal.token == vault.token) {
                forget()
                notice.value = "You've been signed out."
            }
        }
    }

    suspend fun refresh() {
        if (!_signedIn.value) return
        runCatching { api.getMe() }.getOrNull()?.let { _me.value = it }
    }

    /**
     * Opens the sign-in tray and waits for it. True once signed in, false if the person closed it. Whatever
     * asked carries on from where it was.
     */
    suspend fun requireSignIn(reason: String? = null): Boolean {
        if (_signedIn.value) return true
        finishPrompt(false)
        val result = CompletableDeferred<Boolean>()
        waiting = result
        _progress.value = SignInProgress.Idle
        _prompt.value = SignInPrompt(reason)
        return result.await()
    }

    /** The sign-in tray closed, however it closed. */
    fun promptClosed() = finishPrompt(_signedIn.value)

    private fun finishPrompt(done: Boolean) {
        _prompt.value = null
        waiting?.complete(done)
        waiting = null
    }

    /** Where to send the browser to sign in with a method the instance offers. */
    fun start(method: SignInMethodName, email: String?): Uri {
        val verifier = randomText(32)
        val state = randomText(16)
        pending = verifier to state
        _progress.value = SignInProgress.Busy(method)
        val challenge = base64Url(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))
        return Uri.parse(BuildConfig.INSTANCE_URL).buildUpon().appendEncodedPath("auth/start")
            .appendQueryParameter("method", method.value)
            .appendQueryParameter("client", "android")
            .appendQueryParameter("challenge", challenge)
            .appendQueryParameter("state", state)
            .apply { if (email != null) appendQueryParameter("email", email) }
            .build()
    }

    /** The browser came back: with the app's address and a code, or with nothing when the person closed it. */
    suspend fun finish(callback: Uri?) {
        val (verifier, state) = pending ?: return
        pending = null
        if (callback == null) {
            _progress.value = SignInProgress.Idle
            return
        }
        val failure = when {
            callback.getQueryParameter("state") != state -> UNFINISHED
            callback.getQueryParameter("error") == "method" -> "That way of signing in isn't offered here."
            callback.getQueryParameter("error") == "mobile_off" -> {
                instance.refresh()
                "This service doesn't offer its app on phones right now."
            }
            callback.getQueryParameter("error") != null || callback.getQueryParameter("code") == null -> UNFINISHED
            else -> null
        }
        if (failure != null) {
            _progress.value = SignInProgress.Failed(failure)
            return
        }
        try {
            val issued = api.createDeviceSession(callback.getQueryParameter("code")!!, verifier, "android", deviceName)
            vault.set(issued.token)
            _signedIn.value = true
            notice.value = null
            _progress.value = SignInProgress.Idle
            finishPrompt(true)
            refresh()
        } catch (error: Exception) {
            if (error is kotlinx.coroutines.CancellationException) throw error
            _progress.value = SignInProgress.Failed("Sign-in didn't finish. Check your connection and try again.")
        }
    }

    /** Ends this device's session on the instance, then forgets it here. Signed out here even when offline. */
    suspend fun signOut() {
        runCatching { api.endDeviceSession() }
        forget()
    }

    /** Deletes the account on the instance, then forgets it here. False when the instance didn't. */
    suspend fun deleteAccount(): Boolean = try {
        api.deleteAccount()
        forget()
        notice.value = "Your account was deleted."
        true
    } catch (error: kotlinx.coroutines.CancellationException) {
        throw error
    } catch (error: Exception) {
        false
    }

    private fun forget() {
        vault.set(null)
        _signedIn.value = false
        _me.value = null
    }

    private companion object {
        const val UNFINISHED = "Sign-in didn't finish. Try again."
        private val random = SecureRandom()

        fun randomText(bytes: Int): String = base64Url(ByteArray(bytes).also(random::nextBytes))
        fun base64Url(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }
}
