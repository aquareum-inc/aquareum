package org.livepeer.app

import org.livepeer.app.api.ApiTransport
import org.livepeer.app.generated.AgentMessageState
import org.livepeer.app.generated.AgentModel
import org.livepeer.app.generated.CapabilityLabel
import org.livepeer.app.generated.Conversation
import org.livepeer.app.generated.Generation
import org.livepeer.app.generated.GenerationState
import org.livepeer.app.generated.InstanceDescription
import org.livepeer.app.generated.Message
import org.livepeer.app.generated.Offering
import org.livepeer.app.generated.PromptStarter
import org.livepeer.app.generated.ShowcaseItem
import org.livepeer.app.generated.SignInMethodName
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.builtins.ListSerializer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** The generated models against responses captured from a mock-only instance (docs/mobile/fixtures). */
class DecodingTest {
    // Unit tests run with the module directory (apps/android/app) as the working directory.
    private fun <T> fixture(name: String, serializer: DeserializationStrategy<T>): T =
        ApiTransport.json.decodeFromString(serializer, File("../../../docs/mobile/fixtures/$name.json").readText())

    @Test
    fun instanceDescription() {
        val instance = fixture("get_instance", InstanceDescription.serializer())
        assertEquals("1", instance.apiVersion)
        assertTrue(instance.name.isNotEmpty())
        assertTrue(SignInMethodName.Email in instance.signIn.methods)
    }

    @Test
    fun homeLists() {
        assertTrue(fixture("list_prompt_starters", ListSerializer(PromptStarter.serializer())).isNotEmpty())
        assertTrue(fixture("list_showcase", ListSerializer(ShowcaseItem.serializer())).isNotEmpty())
        assertTrue(fixture("list_agent_models", ListSerializer(AgentModel.serializer())).isNotEmpty())
        assertTrue(fixture("list_capability_labels", ListSerializer(CapabilityLabel.serializer())).isNotEmpty())
        assertTrue(fixture("list_capabilities", ListSerializer(Offering.serializer())).isNotEmpty())
    }

    @Test
    fun conversationTellsUserAndAgentMessagesApart() {
        for (name in listOf("create_conversation", "get_conversation_working", "get_conversation_done")) {
            val conversation = fixture(name, Conversation.serializer())
            val sent = conversation.messages.first() as Message.User
            val turn = conversation.messages.last() as Message.Agent
            assertTrue(name, sent.value.text.isNotEmpty())
            assertNotEquals(name, AgentMessageState.Unknown, turn.value.state)
        }
    }

    @Test
    fun generation() {
        val generation = fixture("get_generation", Generation.serializer())
        assertNotEquals(GenerationState.Unknown, generation.state)
        assertEquals(3, generation.artwork.hues.size)
    }

    @Test
    fun aValueFromANewerInstanceDecodesAsUnknown() {
        assertEquals(GenerationState.Unknown, ApiTransport.json.decodeFromString(GenerationState.serializer(), "\"paused\""))
    }

    @Test
    fun aFieldFromANewerInstanceIsIgnored() {
        val starter = ApiTransport.json.decodeFromString(PromptStarter.serializer(), """{"id":"a","label":"A","app":"chat","examples":[],"added_later":true}""")
        assertEquals("a", starter.id)
    }
}
