package org.livepeer.app

import org.livepeer.app.api.ApiTransport
import org.livepeer.app.generated.Money
import org.livepeer.app.generated.PlanAndCredits
import org.livepeer.app.generated.PlanInterval
import org.livepeer.app.generated.Preferences
import org.livepeer.app.generated.PreferencesDefaultAspect
import org.livepeer.app.generated.PrivacyDescription
import org.livepeer.app.generated.Usage
import org.livepeer.app.settings.SettingsModel
import kotlinx.serialization.DeserializationStrategy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** Settings as the instance describes them: plan and credits, usage, preferences and privacy. */
class SettingsTest {
    private fun <T> fixture(name: String, serializer: DeserializationStrategy<T>): T =
        ApiTransport.json.decodeFromString(serializer, File("../../../docs/mobile/fixtures/$name.json").readText())

    @Test
    fun planAndCreditsDecodeAndPricesReadAsPeopleSayThem() {
        val details = fixture("get_account", PlanAndCredits.serializer())
        assertNull(details.plan)
        val creator = details.plans.first()
        assertTrue(SettingsModel.price(creator).endsWith(" a month"))
        assertEquals("$99.50 a year", SettingsModel.price(creator.copy(interval = PlanInterval.Year, price = Money("99.50", "USD"))))
        assertEquals("$120 a year", SettingsModel.price(creator.copy(interval = PlanInterval.Year, price = Money("120.00", "USD"))))
    }

    @Test
    fun usagePreferencesAndPrivacyDecode() {
        val usage = fixture("get_usage", Usage.serializer())
        assertEquals(usage.summary.credits, usage.summary.byApp.sumOf { it.credits }, 0.0)
        val preferences = fixture("get_preferences", Preferences.serializer())
        assertEquals(PreferencesDefaultAspect.V16x9, preferences.defaultAspect)
        assertFalse(preferences.adultContent)
        assertTrue(fixture("get_privacy", PrivacyDescription.serializer()).tiers.any { it.status == "Planned, not available" })
    }
}
