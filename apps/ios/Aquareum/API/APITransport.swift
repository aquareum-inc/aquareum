import Foundation

/// What the instance said when it refused or failed a request.
struct APIError: Error, Equatable, LocalizedError {
    let status: Int
    let message: String

    var errorDescription: String? { message }
    /// The session is missing, expired or revoked.
    var isSignedOut: Bool { status == 401 }
}

/// Sends requests to one instance's `/api/v1`. The generated `API` calls this; nothing else does.
struct APITransport: Sendable {
    let baseURL: URL
    /// The bearer token to send, if the caller has one. Guests send none.
    let token: @Sendable () -> String?
    var session: URLSession = .shared

    private struct Envelope: Decodable {
        struct Body: Decodable { let status: Int; let message: String }
        let error: Body
    }

    func send<Output: Decodable>(_ method: String, _ path: String, query: [String: JSONValue?], body: [String: JSONValue?]?) async throws -> Output {
        var components = URLComponents(url: baseURL.appending(path: "api/v1" + path), resolvingAgainstBaseURL: false)!
        let items = query.compactMap { key, value in value?.queryText.map { URLQueryItem(name: key, value: $0) } }.sorted { $0.name < $1.name }
        if !items.isEmpty { components.queryItems = items }

        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = token() { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body.compactMapValues { $0 })
        }

        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let message = (try? JSONDecoder().decode(Envelope.self, from: data))?.error.message
            throw APIError(status: status, message: message ?? "The request failed.")
        }
        return try JSONDecoder().decode(Output.self, from: data)
    }

    /// A value as one path segment.
    static func escape(_ segment: String) -> String {
        segment.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(CharacterSet(charactersIn: "/"))) ?? segment
    }
}
