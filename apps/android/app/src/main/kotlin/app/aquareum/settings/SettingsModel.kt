package app.aquareum.settings

import app.aquareum.composer.Load
import app.aquareum.generated.Api
import app.aquareum.generated.DeviceSession
import app.aquareum.generated.Plan
import app.aquareum.generated.PlanAndCredits
import app.aquareum.generated.PlanInterval
import app.aquareum.generated.Preferences
import app.aquareum.generated.PrivacyDescription
import app.aquareum.generated.Usage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

/**
 * The signed-in person's settings: plan and credits, usage, preferences, devices and privacy. Each part loads
 * when its screen opens. Buying isn't offered on phones (`docs/mobile/plan.md` §11).
 */
class SettingsModel(private val api: Api) {
    private val _plan = MutableStateFlow<Load<PlanAndCredits>>(Load.Idle)
    private val _usage = MutableStateFlow<Load<Usage>>(Load.Idle)
    private val _preferences = MutableStateFlow<Load<Preferences>>(Load.Idle)
    private val _devices = MutableStateFlow<Load<List<DeviceSession>>>(Load.Idle)
    private val _privacy = MutableStateFlow<Load<PrivacyDescription>>(Load.Idle)
    private val _labels = MutableStateFlow<Map<String, String>>(emptyMap())

    val plan: StateFlow<Load<PlanAndCredits>> = _plan
    val usage: StateFlow<Load<Usage>> = _usage
    val preferences: StateFlow<Load<Preferences>> = _preferences
    val devices: StateFlow<Load<List<DeviceSession>>> = _devices
    val privacy: StateFlow<Load<PrivacyDescription>> = _privacy
    /** Readable names for the capabilities usage lists. */
    val labels: StateFlow<Map<String, String>> = _labels
    /** Why the last change didn't go through, in words for the person. */
    val error = MutableStateFlow<String?>(null)

    suspend fun loadPlan() = read(_plan) { api.getAccount() }
    suspend fun loadPreferences() = read(_preferences) { api.getPreferences() }
    suspend fun loadDevices() = read(_devices) { api.listDevices() }
    suspend fun loadPrivacy() = read(_privacy) { api.getPrivacy() }

    suspend fun loadUsage() = coroutineScope {
        val labels = async { runCatching { api.listCapabilityLabels() }.getOrNull() }
        read(_usage) { api.getUsage() }
        labels.await()?.let { list -> _labels.value = list.associate { it.app to it.name } }
    }

    /** Changes preferences. Shown at once; put back if the instance refuses. */
    suspend fun update(change: (Preferences) -> Preferences) {
        val before = (_preferences.value as? Load.Loaded)?.value ?: return
        val next = change(before)
        _preferences.value = Load.Loaded(next)
        error.value = null
        try {
            _preferences.value = Load.Loaded(
                api.updatePreferences(
                    saveChats = next.saveChats.takeIf { it != before.saveChats },
                    confirmBeforeSpending = next.confirmBeforeSpending.takeIf { it != before.confirmBeforeSpending },
                    defaultAspect = next.defaultAspect.takeIf { it != before.defaultAspect }?.value,
                    defaultDuration = next.defaultDuration.takeIf { it != before.defaultDuration },
                ),
            )
        } catch (cause: CancellationException) {
            throw cause
        } catch (cause: Exception) {
            _preferences.value = Load.Loaded(before)
            error.value = "That change didn't save. Try again."
        }
    }

    /** Signs another device out. It leaves the list at once and comes back if the instance refuses. */
    suspend fun revoke(device: DeviceSession) {
        val before = (_devices.value as? Load.Loaded)?.value ?: return
        _devices.value = Load.Loaded(before.filterNot { it.id == device.id })
        error.value = null
        try {
            api.revokeDevice(device.id)
        } catch (cause: CancellationException) {
            throw cause
        } catch (cause: Exception) {
            _devices.value = Load.Loaded(before)
            error.value = "“${device.name}” wasn't signed out. Try again."
        }
    }

    /** Forgets what belonged to the person who was signed in. */
    fun signedOut() {
        _plan.value = Load.Idle
        _usage.value = Load.Idle
        _preferences.value = Load.Idle
        _devices.value = Load.Idle
        _privacy.value = Load.Idle
        error.value = null
    }

    private suspend fun <T> read(into: MutableStateFlow<Load<T>>, fetch: suspend () -> T) {
        if (into.value !is Load.Loaded) into.value = Load.Loading
        try {
            into.value = Load.Loaded(fetch())
        } catch (cause: CancellationException) {
            throw cause
        } catch (cause: Exception) {
            if (into.value !is Load.Loaded) into.value = Load.Failed
        }
    }

    companion object {
        /** What one period of a plan costs, as people read it: "$12 a month". */
        fun price(plan: Plan): String {
            val amount = BigDecimal(plan.price.amount)
            val format = NumberFormat.getCurrencyInstance(Locale.US).apply {
                currency = Currency.getInstance(plan.price.currency)
                maximumFractionDigits = if (amount.stripTrailingZeros().scale() <= 0) 0 else 2
                minimumFractionDigits = maximumFractionDigits
            }
            return "${format.format(amount)} a ${if (plan.interval == PlanInterval.Year) "year" else "month"}"
        }
    }
}
