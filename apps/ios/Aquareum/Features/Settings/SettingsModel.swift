import SwiftUI

/// Something Settings reads from the instance: not yet, under way, in hand, or failed with nothing to show.
enum Loadable<Value> {
    case idle, loading, loaded(Value), failed

    var value: Value? { if case .loaded(let value) = self { value } else { nil } }
}

/// The signed-in person's settings: plan and credits, usage, preferences, devices and privacy. Each part
/// loads when its screen opens. Buying isn't offered on phones (`docs/mobile/plan.md` §11).
@Observable
final class SettingsModel {
    private(set) var plan: Loadable<PlanAndCredits> = .idle
    private(set) var usage: Loadable<Usage> = .idle
    private(set) var preferences: Loadable<Preferences> = .idle
    private(set) var devices: Loadable<[DeviceSession]> = .idle
    private(set) var privacy: Loadable<PrivacyDescription> = .idle
    /// Readable names for the capabilities usage lists.
    private(set) var labels: [String: String] = [:]
    /// Why the last change didn't go through, in words for the person.
    var error: String?
    private let api: API

    init(api: API) { self.api = api }

    func loadPlan() async { await read(\.plan) { try await self.api.getAccount() } }
    func loadPrivacy() async { await read(\.privacy) { try await self.api.getPrivacy() } }
    func loadPreferences() async { await read(\.preferences) { try await self.api.getPreferences() } }
    func loadDevices() async { await read(\.devices) { try await self.api.listDevices() } }

    func loadUsage() async {
        async let labels = try? api.listCapabilityLabels()
        await read(\.usage) { try await self.api.getUsage() }
        if let labels = await labels { self.labels = Dictionary(labels.map { ($0.app, $0.name) }, uniquingKeysWith: { first, _ in first }) }
    }

    /// The readable name of a capability, or its id when the instance doesn't name it.
    func label(_ app: String) -> String { labels[app] ?? app }

    /// Changes preferences. Shown at once; put back if the instance refuses.
    func update(_ change: (inout Preferences) -> Void) async {
        guard var next = preferences.value else { return }
        let before = next
        change(&next)
        preferences = .loaded(next)
        error = nil
        do {
            preferences = .loaded(try await api.updatePreferences(
                saveChats: next.saveChats == before.saveChats ? nil : next.saveChats,
                confirmBeforeSpending: next.confirmBeforeSpending == before.confirmBeforeSpending ? nil : next.confirmBeforeSpending,
                defaultAspect: next.defaultAspect == before.defaultAspect ? nil : next.defaultAspect.rawValue,
                defaultDuration: next.defaultDuration == before.defaultDuration ? nil : next.defaultDuration
            ))
        } catch {
            preferences = .loaded(before)
            self.error = "That change didn't save. Try again."
        }
    }

    /// Signs another device out. It leaves the list at once and comes back if the instance refuses.
    func revoke(_ device: DeviceSession) async {
        guard let before = devices.value else { return }
        devices = .loaded(before.filter { $0.id != device.id })
        error = nil
        do {
            _ = try await api.revokeDevice(id: device.id)
        } catch {
            devices = .loaded(before)
            self.error = "“\(device.name)” wasn't signed out. Try again."
        }
    }

    /// What one period of a plan costs, as people read it: "$12 a month".
    static func price(of plan: Plan) -> String {
        let amount = Decimal(string: plan.price.amount) ?? 0
        let money = amount.formatted(.currency(code: plan.price.currency).precision(.fractionLength(amount == amount.rounded(0) ? 0 : 2)))
        return "\(money) a \(plan.interval == .year ? "year" : "month")"
    }

    private func read<Value>(_ path: ReferenceWritableKeyPath<SettingsModel, Loadable<Value>>, _ fetch: @escaping () async throws -> Value) async {
        if self[keyPath: path].value == nil { self[keyPath: path] = .loading }
        do {
            self[keyPath: path] = .loaded(try await fetch())
        } catch {
            if self[keyPath: path].value == nil { self[keyPath: path] = .failed }
        }
    }
}

private extension Decimal {
    func rounded(_ scale: Int) -> Decimal {
        var value = self, result = Decimal()
        NSDecimalRound(&result, &value, scale, .plain)
        return result
    }
}
