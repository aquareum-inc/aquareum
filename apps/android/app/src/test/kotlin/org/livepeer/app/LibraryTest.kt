package org.livepeer.app

import org.livepeer.app.api.ApiTransport
import org.livepeer.app.generated.MediaItem
import org.livepeer.app.library.LibraryState
import org.livepeer.app.library.LibraryViewModel
import kotlinx.serialization.builtins.ListSerializer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** What the library opens in the studio, and when an empty grid means "nothing matches". */
class LibraryTest {
    private val items = ApiTransport.json.decodeFromString(ListSerializer(MediaItem.serializer()), File("../../../docs/mobile/fixtures/search_library.json").readText())

    @Test
    fun theStudioStartsFromWhatMadeIt() {
        val item = items.first()
        assertEquals("A slow push along a harbour", LibraryViewModel.studioPrompt(item.copy(prompt = "A slow push along a harbour")))
        assertEquals(item.description, LibraryViewModel.studioPrompt(item.copy(prompt = null)))
    }

    @Test
    fun anEmptyGridIsANoMatchOnlyWhenFiltered() {
        assertFalse(LibraryState().filtered)
        assertFalse(LibraryState(query = "   ").filtered)
        assertTrue(LibraryState(query = "harbour").filtered)
        assertTrue(LibraryState(kind = items.first().kind).filtered)
    }
}
