package app.aquareum

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.ActivityResultLauncher
import androidx.browser.auth.AuthTabIntent
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import app.aquareum.design.LocalDarkTheme
import app.aquareum.design.LocalPalette
import app.aquareum.design.resolved
import app.aquareum.generated.Palette
import app.aquareum.shell.AquareumRoot
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val container get() = (application as AquareumApplication).container

    /** Sign-in in an Auth Tab. Where the browser has none, it opens as a Custom Tab and comes back through [onNewIntent]. */
    private lateinit var signIn: ActivityResultLauncher<Intent>

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        signIn = AuthTabIntent.registerActivityResultLauncher(this) { result ->
            lifecycleScope.launch { container.account.finish(if (result.resultCode == AuthTabIntent.RESULT_OK) result.resultUri else null) }
        }
        intent?.let(::returnFromBrowser)

        setContent {
            val instance by container.instance.description.collectAsStateWithLifecycle()
            val choice by container.theme.choice.collectAsStateWithLifecycle()
            val dark = when (choice) {
                ThemePreference.Choice.Dark -> true
                ThemePreference.Choice.Light -> false
                ThemePreference.Choice.System -> isSystemInDarkTheme()
            }
            val palette = Palette.resolved(dark, (if (dark) instance?.theme?.dark else instance?.theme?.light).orEmpty())

            DisposableEffect(dark) {
                val bars = if (dark) SystemBarStyle.dark(Color.TRANSPARENT) else SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
                enableEdgeToEdge(statusBarStyle = bars, navigationBarStyle = bars)
                onDispose {}
            }
            // The description and the account are read again each time the app comes to the front.
            LifecycleResumeEffect(Unit) {
                lifecycleScope.launch {
                    container.instance.refresh()
                    container.account.refresh()
                }
                onPauseOrDispose {}
            }

            CompositionLocalProvider(LocalPalette provides palette, LocalDarkTheme provides dark) {
                AquareumRoot(container) { uri -> AuthTabIntent.Builder().build().launch(signIn, uri, BuildConfig.APPLICATION_ID) }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        returnFromBrowser(intent)
    }

    /** A Custom Tab returning to this app's own address at the end of a sign-in. */
    private fun returnFromBrowser(intent: Intent) {
        val uri: Uri = intent.data ?: return
        if (uri.scheme != BuildConfig.APPLICATION_ID || uri.host != "auth") return
        setIntent(Intent(this, MainActivity::class.java))
        lifecycleScope.launch { container.account.finish(uri) }
    }
}
