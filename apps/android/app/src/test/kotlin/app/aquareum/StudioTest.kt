package app.aquareum

import app.aquareum.api.ApiTransport
import app.aquareum.generated.MediaKind
import app.aquareum.generated.Quote
import app.aquareum.generated.StudioMedium
import app.aquareum.studio.StudioState
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.builtins.ListSerializer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import java.io.File

/** The studio as the instance describes it, what the phone offers of it, and its quotes. */
class StudioTest {
    private fun <T> fixture(name: String, serializer: DeserializationStrategy<T>): T =
        ApiTransport.json.decodeFromString(serializer, File("../../../docs/mobile/fixtures/$name.json").readText())

    @Test
    fun thePhoneOffersModesThatNeedNoUpload() {
        val mediums = fixture("list_studio_mediums", ListSerializer(StudioMedium.serializer()))
        assertEquals(listOf(MediaKind.Video, MediaKind.Image, MediaKind.Audio), mediums.map { it.kind })
        val video = StudioState(loading = false, mediums = mediums)
        assertEquals(listOf("frames"), video.modes.map { it.value })
        assertFalse("frame" in video.mode!!.wordsPlaceholder)
        assertEquals(StudioState(loading = false, mediums = mediums, kind = MediaKind.Audio).modes.map { it.value }, listOf("music", "voice"))
    }

    @Test
    fun aFreshDraftTakesEachMediumsFirstSettings() {
        val state = StudioState(loading = false, mediums = fixture("list_studio_mediums", ListSerializer(StudioMedium.serializer())))
        val video = state.fresh(MediaKind.Video)
        assertEquals("16:9", video.aspect)
        assertEquals(5.0, video.durationSeconds)
        assertEquals("720p", video.resolution)
        assertEquals(null, state.fresh(MediaKind.Image).durationSeconds)
    }

    @Test
    fun aQuoteIsCredits() = assertEquals(55.0, fixture("quote_generation", Quote.serializer()).credits, 0.0)
}
