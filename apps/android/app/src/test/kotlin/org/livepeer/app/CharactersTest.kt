package org.livepeer.app

import org.livepeer.app.api.ApiTransport
import org.livepeer.app.characters.CharacterDraft
import org.livepeer.app.characters.CharactersState
import org.livepeer.app.characters.REPORT_REASONS
import org.livepeer.app.characters.compactCount
import org.livepeer.app.characters.label
import org.livepeer.app.generated.Character
import org.livepeer.app.generated.CharacterBlock
import org.livepeer.app.generated.CharacterReport
import org.livepeer.app.generated.CharacterReportState
import org.livepeer.app.generated.ReportReason
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.builtins.ListSerializer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** Characters as the instance sends them, what the list shows, and what a report and a block send back. */
class CharactersTest {
    private fun <T> fixture(name: String, serializer: DeserializationStrategy<T>): T =
        ApiTransport.json.decodeFromString(serializer, File("../../../docs/mobile/fixtures/$name.json").readText())

    private val all = fixture("list_characters", ListSerializer(Character.serializer()))

    @Test
    fun aGuestHasNoneOfTheirOwnAndSearchNarrowsTheShared() {
        val state = CharactersState(loading = false, all = all.mapIndexed { index, character -> character.copy(mine = index == 0) })
        assertEquals(1, state.mine(signedIn = true).size)
        assertTrue(state.mine(signedIn = false).isEmpty())
        assertEquals(all.size - 1, state.shared.size)
        assertEquals(listOf("Lumen"), state.copy(query = " LIGHTING ").shared.map { it.name })
        assertTrue(state.copy(query = "nobody like this").shared.isEmpty())
    }

    @Test
    fun aCharacterNeedsANameWhoTheyAreAndHowTheyOpen() {
        assertFalse(CharacterDraft(name = "Wren").canCreate)
        assertFalse(CharacterDraft(name = "  ", description = "x", greeting = "y").canCreate)
        assertTrue(CharacterDraft(name = "Wren", description = "A sound recordist.", greeting = "Quiet on set.").canCreate)
    }

    @Test
    fun aReportAndABlockDecode() {
        val report = fixture("report_character", CharacterReport.serializer())
        assertEquals(ReportReason.Spam, report.reason)
        assertEquals(CharacterReportState.Open, report.state)
        assertEquals("relay-club", fixture("block_character", CharacterBlock.serializer()).author)
        assertEquals("Mara", fixture("get_character", Character.serializer()).name)
        assertEquals(6, REPORT_REASONS.map { it.label }.toSet().size)
    }

    @Test
    fun countsReadAsPeopleSayThem() {
        assertEquals("940", compactCount(940.0))
        assertEquals("5.4K", compactCount(5_400.0))
        assertEquals("9K", compactCount(9_000.0))
        assertEquals("18K", compactCount(18_400.0))
        assertEquals("1.2M", compactCount(1_200_000.0))
    }
}
