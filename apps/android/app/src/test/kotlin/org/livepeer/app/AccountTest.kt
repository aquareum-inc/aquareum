package org.livepeer.app

import org.livepeer.app.InstanceStore.Availability
import org.livepeer.app.account.initials
import org.livepeer.app.api.ApiTransport
import org.livepeer.app.generated.DeviceSession
import org.livepeer.app.generated.DeviceSessionPlatform
import org.livepeer.app.generated.DeviceToken
import org.livepeer.app.generated.InstanceDescription
import org.livepeer.app.generated.Me
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.builtins.ListSerializer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** The sign-in responses, and when the app can be used with an instance at all. */
class AccountTest {
    private fun <T> fixture(name: String, serializer: DeserializationStrategy<T>): T =
        ApiTransport.json.decodeFromString(serializer, File("../../../docs/mobile/fixtures/$name.json").readText())

    @Test
    fun signInResponses() {
        val issued = fixture("create_device_session", DeviceToken.serializer())
        assertTrue(issued.token.startsWith("aqd_"))
        assertEquals(DeviceSessionPlatform.Ios, issued.device.platform)
        val me = fixture("get_me", Me.serializer())
        assertTrue(me.name.isNotEmpty() && me.balance.credits > 0)
        assertTrue(fixture("list_devices", ListSerializer(DeviceSession.serializer())).isNotEmpty())
    }

    @Test
    fun availability() {
        val instance = fixture("get_instance", InstanceDescription.serializer())
        assertEquals(Availability.Available, InstanceStore.availability(instance, "org.livepeer.app.dev", "0.1.0"))
        assertEquals(Availability.Available, InstanceStore.availability(null, "org.livepeer.app.dev", "0.1.0"))
        // An app the instance doesn't list can't sign in, so it isn't offered.
        assertEquals(Availability.NotOffered, InstanceStore.availability(instance, "org.example.other", "0.1.0"))
        assertEquals(Availability.NotOffered, InstanceStore.availability(instance.copy(surfaces = instance.surfaces.copy(mobile = false)), "org.livepeer.app.dev", "0.1.0"))

        val newer = instance.copy(mobile = instance.mobile.copy(android = instance.mobile.android!!.copy(minimumVersion = "0.10.0")))
        assertEquals(Availability.UpdateRequired, InstanceStore.availability(newer, "org.livepeer.app.dev", "0.9.3"))
        assertEquals(Availability.Available, InstanceStore.availability(newer, "org.livepeer.app.dev", "0.10.0"))
    }

    @Test
    fun initialsFromAName() {
        assertEquals("AS", initials("Adam Soffer"))
        assertEquals("M", initials("Mara"))
        assertEquals("", initials(null))
    }
}
