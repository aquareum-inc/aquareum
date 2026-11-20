package app.aquareum.characters

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Block
import androidx.compose.material.icons.rounded.Flag
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.RadioButtonChecked
import androidx.compose.material.icons.rounded.RadioButtonUnchecked
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.aquareum.account.Account
import app.aquareum.design.LocalPalette
import app.aquareum.design.PrimaryButton
import app.aquareum.design.Tray
import app.aquareum.design.pressable
import app.aquareum.design.style
import app.aquareum.generated.Character
import app.aquareum.generated.Radius
import app.aquareum.generated.ReportReason
import app.aquareum.generated.TypeSize
import kotlinx.coroutines.launch

/** One character: who they are, casting them in a scene, and, for someone else's, reporting or blocking it. */
@Composable
fun CharacterScreen(character: Character, model: CharactersModel, account: Account, instanceName: String, onBack: () -> Unit, castInScene: (Character) -> Unit) {
    val palette = LocalPalette.current
    val scope = rememberCoroutineScope()
    var menu by remember { mutableStateOf(false) }
    var reporting by rememberSaveable { mutableStateOf(false) }
    var confirmingBlock by rememberSaveable { mutableStateOf(false) }
    var blockFailed by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().background(palette.background).windowInsetsPadding(WindowInsets.statusBars)) {
        Row(Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(48.dp).pressable(round = true, onClick = onBack).semantics { contentDescription = "Back" }, contentAlignment = Alignment.Center) {
                Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = null, tint = palette.foreground, modifier = Modifier.size(22.dp))
            }
            BasicText(character.name, style = TypeSize.Lead.style(FontWeight.SemiBold).copy(color = palette.foreground), modifier = Modifier.weight(1f).padding(start = 4.dp))
            if (!character.mine) {
                Box {
                    Box(Modifier.size(48.dp).pressable(round = true) { menu = true }.semantics { contentDescription = "More" }, contentAlignment = Alignment.Center) {
                        Icon(Icons.Rounded.MoreVert, contentDescription = null, tint = palette.foreground, modifier = Modifier.size(22.dp))
                    }
                    DropdownMenu(menu, onDismissRequest = { menu = false }, containerColor = palette.popover) {
                        DropdownMenuItem(
                            text = { Text("Report ${character.name}…", color = palette.foreground) },
                            leadingIcon = { Icon(Icons.Rounded.Flag, contentDescription = null, tint = palette.foreground) },
                            onClick = {
                                menu = false
                                scope.launch { if (account.requireSignIn("Sign in to report a character.")) reporting = true }
                            },
                        )
                        DropdownMenuItem(
                            text = { Text("Block ${character.name}", color = palette.destructive) },
                            leadingIcon = { Icon(Icons.Rounded.Block, contentDescription = null, tint = palette.destructive) },
                            onClick = {
                                menu = false
                                scope.launch { if (account.requireSignIn("Sign in to block a character.")) confirmingBlock = true }
                            },
                        )
                    }
                }
            }
        }

        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp)) {
            val shape = RoundedCornerShape(Radius.Card.dp)
            CharacterPortrait(character, Modifier.align(Alignment.CenterHorizontally).widthIn(max = 220.dp).fillMaxWidth().aspectRatio(4f / 5f).clip(shape).border(1.dp, palette.hairline, shape))
            BasicText(character.name, style = TypeSize.Title.style(FontWeight.SemiBold).copy(color = palette.foreground), modifier = Modifier.padding(top = 20.dp).semantics { heading() })
            BasicText(character.tagline, style = TypeSize.Lead.style().copy(color = palette.mutedForeground), modifier = Modifier.padding(top = 4.dp))
            Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                BasicText("by ${character.author}", style = TypeSize.Caption.style(mono = true).copy(color = palette.subtleForeground))
                if (character.chats > 0) CharacterStats(character)
            }
            BasicText(character.description, style = TypeSize.Body.style().copy(color = palette.foreground), modifier = Modifier.padding(top = 16.dp))

            // Casting comes first: characters are for putting on screen.
            PrimaryButton("Cast ${character.name} in a scene", Modifier.padding(top = 24.dp)) { castInScene(character) }
            BasicText(
                if (character.image == null) "Describe a scene and they'll play it, in character." else "Their portrait is the first frame, so they look like themselves in every shot.",
                style = TypeSize.Caption.style().copy(color = palette.mutedForeground),
                modifier = Modifier.padding(top = 8.dp),
            )

            val card = RoundedCornerShape(Radius.Card.dp)
            Column(Modifier.padding(top = 24.dp).fillMaxWidth().background(palette.card, card).border(1.dp, palette.hairline, card).padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                BasicText("How they open", style = TypeSize.Caption.style(FontWeight.Medium).copy(color = palette.subtleForeground))
                BasicText("“${character.greeting}”", style = TypeSize.Body.style().copy(color = palette.mutedForeground, fontStyle = FontStyle.Italic))
            }
        }
    }

    if (reporting) {
        Tray("Report ${character.name}", onDismiss = { reporting = false }) { close -> ReportTray(character, model, instanceName, close) }
    }
    if (confirmingBlock) {
        AlertDialog(
            onDismissRequest = { confirmingBlock = false },
            title = { Text("Block ${character.name}?") },
            text = { Text("You won't see ${character.name} or anything else by ${character.author} again.") },
            confirmButton = {
                TextButton({
                    confirmingBlock = false
                    scope.launch { if (model.block(character)) onBack() else blockFailed = true }
                }) { Text("Block", color = palette.destructive) }
            },
            dismissButton = { TextButton({ confirmingBlock = false }) { Text("Cancel", color = palette.foreground) } },
            containerColor = palette.popover,
            titleContentColor = palette.foreground,
            textContentColor = palette.mutedForeground,
        )
    }
    if (blockFailed) {
        AlertDialog(
            onDismissRequest = { blockFailed = false },
            title = { Text("That didn't go through") },
            text = { Text("${character.name} isn't blocked. Check your connection and try again.") },
            confirmButton = { TextButton({ blockFailed = false }) { Text("OK", color = palette.foreground) } },
            containerColor = palette.popover,
            titleContentColor = palette.foreground,
            textContentColor = palette.mutedForeground,
        )
    }
}

/** Why someone is reporting a character, and anything they want to add. Goes to the instance's operator. */
@Composable
private fun ReportTray(character: Character, model: CharactersModel, instanceName: String, close: () -> Unit) {
    val palette = LocalPalette.current
    val scope = rememberCoroutineScope()
    var reason by rememberSaveable { mutableStateOf<ReportReason?>(null) }
    var note by rememberSaveable { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var sent by rememberSaveable { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }

    if (sent) {
        BasicText("Thanks. The people who run $instanceName will look at it. You can also block ${character.name} so you don't see them again.", style = TypeSize.Body.style().copy(color = palette.foreground))
        PrimaryButton("Done", onClick = close)
        return
    }
    Column {
        REPORT_REASONS.forEachIndexed { index, option ->
            Row(
                Modifier.fillMaxWidth().heightIn(min = 48.dp).pressable { reason = option }.semantics(mergeDescendants = true) { role = Role.RadioButton; selected = reason == option },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                BasicText(option.label, style = TypeSize.Body.style().copy(color = palette.foreground), modifier = Modifier.weight(1f))
                Icon(if (reason == option) Icons.Rounded.RadioButtonChecked else Icons.Rounded.RadioButtonUnchecked, contentDescription = null, tint = if (reason == option) palette.foreground else palette.subtleForeground)
            }
            if (index < REPORT_REASONS.lastIndex) HorizontalDivider(color = palette.hairline)
        }
    }
    BasicTextField(
        value = note,
        onValueChange = { note = it.take(500) },
        textStyle = TypeSize.Body.style().copy(color = palette.foreground),
        cursorBrush = SolidColor(palette.foreground),
        minLines = 2,
        maxLines = 4,
        modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Anything to add" },
        decorationBox = { field ->
            Box(Modifier.fillMaxWidth().background(palette.muted, RoundedCornerShape(Radius.Field.dp)).padding(12.dp)) {
                if (note.isEmpty()) BasicText("Anything to add (optional)", style = TypeSize.Body.style().copy(color = palette.subtleForeground))
                field()
            }
        },
    )
    if (failed) BasicText("That didn't send. Check your connection and try again.", style = TypeSize.Caption.style().copy(color = palette.destructive))
    PrimaryButton("Send report", enabled = reason != null, busy = sending) {
        val chosen = reason ?: return@PrimaryButton
        sending = true
        failed = false
        scope.launch {
            sent = model.report(character, chosen, note)
            failed = !sent
            sending = false
        }
    }
}
