import Foundation

/// What is fixed when the app is built: which instance it belongs to. Written by `./aquareum mobile`
/// into Config/Instance.xcconfig. Everything else about the instance is read from it at run time.
nonisolated enum BuildConfig {
    static let instanceURL: URL = {
        guard let text = Bundle.main.object(forInfoDictionaryKey: "InstanceURL") as? String, let url = URL(string: text), url.host() != nil else {
            fatalError("Config/Instance.xcconfig must set INSTANCE_URL to the instance's address.")
        }
        return url
    }()

    /// Development builds against a mock-only instance send its demo key until sign-in is built.
    /// A real instance refuses it, and release builds don't carry it.
    static let demoKey: String? = {
        #if DEBUG
        let key = Bundle.main.object(forInfoDictionaryKey: "MockOnlyDemoKey") as? String
        return key?.isEmpty == false ? key : nil
        #else
        return nil
        #endif
    }()
}
