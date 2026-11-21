import CryptoKit
import Foundation

/// The mock-only instance the tests run against (`MOCK_ONLY=1`, the dev config), and its real native sign-in.
enum Instance {
    static let url = URL(string: ProcessInfo.processInfo.environment["AQUAREUM_INSTANCE_URL"] ?? "http://localhost:3100")!

    /// Signs in as the instance's test user the way the app does, without the browser: starts the flow with a
    /// PKCE challenge, follows the mock provider back to the app's callback, and redeems the code for a device
    /// session.
    static func signIn() throws -> String {
        let verifier = random(32)
        let state = random(16)
        let challenge = base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
        var start = URLComponents(url: url.appending(path: "auth/start"), resolvingAgainstBaseURL: false)!
        start.queryItems = [.init(name: "method", value: "email"), .init(name: "email", value: "adam@example.test"), .init(name: "client", value: "ios"), .init(name: "challenge", value: challenge), .init(name: "state", value: state)]

        let session = URLSession(configuration: .ephemeral, delegate: StopAtApp(), delegateQueue: nil)
        let (_, response) = try load(URLRequest(url: start.url!), with: session)
        guard let callback = (response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Location").flatMap(URLComponents.init(string:)),
              callback.queryItems?.first(where: { $0.name == "state" })?.value == state,
              let code = callback.queryItems?.first(where: { $0.name == "code" })?.value
        else { throw SignInFailed() }

        var redeem = URLRequest(url: url.appending(path: "api/v1/auth/device"))
        redeem.httpMethod = "POST"
        redeem.setValue("application/json", forHTTPHeaderField: "Content-Type")
        redeem.httpBody = try JSONSerialization.data(withJSONObject: ["code": code, "verifier": verifier, "platform": "ios", "device_name": "UI tests"])
        let (body, _) = try load(redeem, with: .shared)
        guard let token = (try JSONSerialization.jsonObject(with: body) as? [String: Any])?["token"] as? String else { throw SignInFailed() }
        return token
    }

    struct SignInFailed: Error {}

    /// One request, waited for: the tests drive the app step by step.
    private static func load(_ request: URLRequest, with session: URLSession) throws -> (Data, URLResponse?) {
        let done = DispatchSemaphore(value: 0)
        nonisolated(unsafe) var result: (Data?, URLResponse?, Error?)
        session.dataTask(with: request) { data, response, error in
            result = (data, response, error)
            done.signal()
        }.resume()
        done.wait()
        if let error = result.2 { throw error }
        return (result.0 ?? Data(), result.1)
    }

    /// Follows the instance's own redirects and stops at the one to the app's address.
    private final class StopAtApp: NSObject, URLSessionTaskDelegate {
        func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
            completionHandler(request.url?.scheme?.hasPrefix("http") == true ? request : nil)
        }
    }

    private static func random(_ bytes: Int) -> String {
        base64URL(Data((0..<bytes).map { _ in UInt8.random(in: 0...255) }))
    }

    private static func base64URL(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
