package app.aquareum

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionLayout
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import app.aquareum.chat.ConversationScreen
import app.aquareum.chat.ConversationViewModel
import app.aquareum.design.LocalPalette
import app.aquareum.design.rememberMotion
import app.aquareum.design.resolved
import app.aquareum.generated.Palette
import app.aquareum.home.HomeScreen
import app.aquareum.home.HomeViewModel
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    @OptIn(ExperimentalSharedTransitionApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val container = (application as AquareumApplication).container

        setContent {
            val instance by container.instance.description.collectAsStateWithLifecycle()
            val symbol by container.instance.symbol.collectAsStateWithLifecycle()
            val dark = isSystemInDarkTheme()
            val palette = Palette.resolved(dark, (if (dark) instance?.theme?.dark else instance?.theme?.light).orEmpty())
            val motion = rememberMotion()
            val navigation = rememberNavController()

            // The description is read again each time the app comes to the front.
            LifecycleResumeEffect(Unit) {
                lifecycleScope.launch { container.instance.refresh() }
                onPauseOrDispose {}
            }

            CompositionLocalProvider(LocalPalette provides palette) {
                // The composer is one object that travels: it is shared between Home and a conversation.
                SharedTransitionLayout {
                    NavHost(navigation, startDestination = "home", enterTransition = { fadeIn(motion.enter()) }, exitTransition = { fadeOut(motion.exit()) }) {
                        composable("home") {
                            val model = viewModel<HomeViewModel>(factory = viewModelFactory { initializer { HomeViewModel(container.api) } })
                            HomeScreen(model, instance, Modifier.sharedBounds(rememberSharedContentState("composer"), this, boundsTransform = { _, _ -> motion.layout() })) { conversation ->
                                container.conversations[conversation.id] = conversation
                                navigation.navigate("conversation/${conversation.id}")
                            }
                        }
                        composable("conversation/{id}") { entry ->
                            val id = entry.arguments?.getString("id").orEmpty()
                            val model = viewModel<ConversationViewModel>(factory = viewModelFactory { initializer { ConversationViewModel(container.api, id, container.conversations[id]) } })
                            ConversationScreen(model, symbol, instance?.name ?: getString(R.string.app_name), Modifier.sharedBounds(rememberSharedContentState("composer"), this, boundsTransform = { _, _ -> motion.layout() })) {
                                navigation.popBackStack()
                            }
                        }
                    }
                }
            }
        }
    }
}
