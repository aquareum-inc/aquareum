import Foundation
import Testing
@testable import Aquareum

/// Settings as the instance describes them: plan and credits, usage, preferences and privacy.
struct SettingsTests {
    private func fixture<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
        let fixtures = URL(filePath: #filePath).deletingLastPathComponent().appending(path: "../../../docs/mobile/fixtures").standardizedFileURL
        return try JSONDecoder().decode(type, from: Data(contentsOf: fixtures.appending(path: "\(name).json")))
    }

    @Test func planAndCreditsDecodeAndPricesReadAsPeopleSayThem() throws {
        let details = try fixture("get_account", as: PlanAndCredits.self)
        #expect(details.plan == nil)
        let creator = try #require(details.plans.first)
        #expect(SettingsModel.price(of: creator).hasSuffix(" a month"))
        var yearly = creator
        yearly.interval = .year
        yearly.price = Money(amount: "99.50", currency: "USD")
        #expect(SettingsModel.price(of: yearly) == "$99.50 a year")
        yearly.price = Money(amount: "120.00", currency: "USD")
        #expect(SettingsModel.price(of: yearly) == "$120 a year")
    }

    @Test func usagePreferencesAndPrivacyDecode() throws {
        let usage = try fixture("get_usage", as: Usage.self)
        #expect(usage.summary.byApp.reduce(0) { $0 + $1.credits } == usage.summary.credits)
        let preferences = try fixture("get_preferences", as: Preferences.self)
        #expect(preferences.defaultAspect == .v16x9)
        #expect(!preferences.adultContent)
        let privacy = try fixture("get_privacy", as: PrivacyDescription.self)
        #expect(privacy.tiers.contains { $0.status == "Planned, not available" })
    }
}
