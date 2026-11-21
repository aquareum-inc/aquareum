import Foundation
import Testing
@testable import Livepeer

/// The sign-in responses, and when the app can be used with an instance at all.
struct AccountTests {
    private func fixture<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
        let fixtures = URL(filePath: #filePath).deletingLastPathComponent().appending(path: "../../../docs/mobile/fixtures").standardizedFileURL
        return try JSONDecoder().decode(type, from: Data(contentsOf: fixtures.appending(path: "\(name).json")))
    }

    @Test func signInResponses() throws {
        let issued = try fixture("create_device_session", as: DeviceToken.self)
        #expect(issued.token.hasPrefix("aqd_"))
        #expect(issued.device.platform == .ios && issued.device.current)
        let me = try fixture("get_me", as: Me.self)
        #expect(!me.name.isEmpty && me.balance.credits > 0)
        #expect(try !fixture("list_devices", as: [DeviceSession].self).isEmpty)
    }

    @Test func availability() throws {
        let instance = try fixture("get_instance", as: InstanceDescription.self)
        #expect(InstanceStore.availability(of: instance, bundleID: "org.livepeer.app.dev", version: "0.1.0") == .available)
        #expect(InstanceStore.availability(of: instance, bundleID: "Org.Livepeer.App.Dev", version: "0.1.0") == .available)
        // An app the instance doesn't list can't sign in, so it isn't offered.
        #expect(InstanceStore.availability(of: instance, bundleID: "org.example.other", version: "0.1.0") == .notOffered)

        var off = instance
        off.surfaces.mobile = false
        #expect(InstanceStore.availability(of: off, bundleID: "org.livepeer.app.dev", version: "0.1.0") == .notOffered)

        var newer = instance
        newer.mobile.ios?.minimumVersion = "0.10.0"
        #expect(InstanceStore.availability(of: newer, bundleID: "org.livepeer.app.dev", version: "0.9.3") == .updateRequired)
        #expect(InstanceStore.availability(of: newer, bundleID: "org.livepeer.app.dev", version: "0.10.0") == .available)
    }

    @Test func errorsCarryTheirReason() throws {
        let data = Data(#"{"error":{"status":403,"message":"This service doesn't offer its app on phones right now.","code":"mobile_off"}}"#.utf8)
        struct Envelope: Decodable { struct Body: Decodable { let status: Int; let message: String; let code: String? }; let error: Body }
        let body = try JSONDecoder().decode(Envelope.self, from: data).error
        #expect(APIError(status: body.status, message: body.message, code: body.code).isMobileOff)
        #expect(APIError(status: 401, message: "", code: "signed_out").isSignedOut)
    }
}
