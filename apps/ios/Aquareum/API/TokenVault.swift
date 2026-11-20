import Foundation
import Security
import Synchronization

/// Holds the device session token: in the Keychain, readable after the first unlock, on this device only
/// (never in a backup or on another device), with a copy in memory for the transport to read on any thread.
nonisolated final class TokenVault: Sendable {
    private let current: Mutex<String?>
    private let service: String
    private static let account = "device-session"

    init(service: String = Bundle.main.bundleIdentifier ?? "app.aquareum") {
        self.service = service
        current = Mutex(Self.read(service: service))
    }

    var token: String? { current.withLock { $0 } }

    /// Stores a new token, or removes it with nil.
    func set(_ token: String?) {
        current.withLock { $0 = token }
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: Self.account]
        SecItemDelete(query as CFDictionary)
        guard let token else { return }
        var item = query
        item[kSecValueData as String] = Data(token.utf8)
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil)
    }

    private static func read(service: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
