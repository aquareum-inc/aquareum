package org.livepeer.app.characters

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.livepeer.app.design.LocalPalette
import org.livepeer.app.design.pressable
import org.livepeer.app.design.style
import org.livepeer.app.generated.Character
import org.livepeer.app.generated.Radius
import org.livepeer.app.generated.TypeSize
import kotlinx.coroutines.launch

/** Who a new character is, how they look and move, and how they speak. */
@Composable
fun NewCharacterScreen(model: CharactersModel, onClose: () -> Unit, created: (Character) -> Unit) {
    val palette = LocalPalette.current
    val scope = rememberCoroutineScope()
    var name by rememberSaveable { mutableStateOf("") }
    var tagline by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var greeting by rememberSaveable { mutableStateOf("") }
    var shared by rememberSaveable { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    val draft = CharacterDraft(name, tagline, description, greeting, shared)

    Column(Modifier.fillMaxSize().background(palette.background).windowInsetsPadding(WindowInsets.statusBars).imePadding()) {
        Row(Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(48.dp).pressable(round = true, onClick = onClose).semantics { contentDescription = "Cancel" }, contentAlignment = Alignment.Center) {
                Icon(Icons.Rounded.Close, contentDescription = null, tint = palette.foreground, modifier = Modifier.size(22.dp))
            }
            BasicText("New character", style = TypeSize.Lead.style(FontWeight.SemiBold).copy(color = palette.foreground), modifier = Modifier.weight(1f).padding(start = 4.dp).semantics { heading() })
            val ready = draft.canCreate && !saving
            Box(
                Modifier.padding(end = 8.dp).heightIn(min = 40.dp).background(palette.primary.copy(alpha = if (ready) 1f else 0.4f), RoundedCornerShape(Radius.Field.dp)).pressable(enabled = ready) {
                    saving = true
                    failed = false
                    scope.launch {
                        val made = model.create(draft)
                        saving = false
                        if (made != null) created(made) else failed = true
                    }
                }.padding(horizontal = 16.dp),
                contentAlignment = Alignment.Center,
            ) {
                BasicText("Create", style = TypeSize.Body.style(FontWeight.SemiBold).copy(color = palette.primaryForeground), modifier = Modifier.alpha(if (saving) 0f else 1f))
                if (saving) CircularProgressIndicator(color = palette.primaryForeground, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
            }
        }

        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Field("Name", name, { name = it.take(CharacterDraft.NAME) }, "Mara")
            Field("One line about them", tagline, { tagline = it.take(CharacterDraft.TAGLINE) }, "A film director who thinks in shots.", hint = "Shown under their name.")
            Field("Who they are", description, { description = it.take(CharacterDraft.DESCRIPTION) }, "How they look, move and speak, and what they care about", hint = "Every scene keeps them in character from this.", lines = 5)
            Field("How they open", greeting, { greeting = it.take(CharacterDraft.GREETING) }, "Tell me what the audience should feel in the last frame.", hint = "The first thing they say.", lines = 2)
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(Modifier.fillMaxWidth().background(palette.card, RoundedCornerShape(Radius.Field.dp)).border(1.dp, palette.hairline, RoundedCornerShape(Radius.Field.dp)).pressable { shared = !shared }.padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    BasicText("Share with everyone here", style = TypeSize.Lead.style().copy(color = palette.foreground), modifier = Modifier.weight(1f))
                    Switch(shared, onCheckedChange = { shared = it }, colors = SwitchDefaults.colors(checkedTrackColor = palette.primary, checkedThumbColor = palette.primaryForeground, uncheckedTrackColor = palette.muted, uncheckedThumbColor = palette.mutedForeground, uncheckedBorderColor = palette.hairline))
                }
                BasicText("Off keeps the character private to you.", style = TypeSize.Caption.style().copy(color = palette.mutedForeground), modifier = Modifier.padding(horizontal = 4.dp))
            }
            if (failed) BasicText("That didn't save. Try again.", style = TypeSize.Body.style().copy(color = palette.destructive))
        }
    }
}

@Composable
private fun Field(label: String, value: String, onChange: (String) -> Unit, placeholder: String, hint: String? = null, lines: Int = 1) {
    val palette = LocalPalette.current
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        // The field carries the label for screen readers, so it isn't read twice.
        BasicText(label, style = TypeSize.Body.style(FontWeight.Medium).copy(color = palette.mutedForeground), modifier = Modifier.padding(horizontal = 4.dp).clearAndSetSemantics {})
        BasicTextField(
            value = value,
            onValueChange = onChange,
            singleLine = lines == 1,
            minLines = lines,
            textStyle = TypeSize.Lead.style().copy(color = palette.foreground),
            cursorBrush = SolidColor(palette.foreground),
            modifier = Modifier.fillMaxWidth().semantics { contentDescription = label },
            decorationBox = { field ->
                val shape = RoundedCornerShape(Radius.Field.dp)
                Box(Modifier.fillMaxWidth().background(palette.card, shape).border(1.dp, palette.hairline, shape).padding(horizontal = 14.dp, vertical = 12.dp)) {
                    if (value.isEmpty()) BasicText(placeholder, style = TypeSize.Lead.style().copy(color = palette.subtleForeground))
                    field()
                }
            },
        )
        if (hint != null) BasicText(hint, style = TypeSize.Caption.style().copy(color = palette.mutedForeground), modifier = Modifier.padding(horizontal = 4.dp))
    }
}
