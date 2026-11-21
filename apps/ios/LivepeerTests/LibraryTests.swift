import Foundation
import Testing
@testable import Livepeer

/// What the library opens in the studio, and its items as fixtures have them.
struct LibraryTests {
    private func fixture<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
        let fixtures = URL(filePath: #filePath).deletingLastPathComponent().appending(path: "../../../docs/mobile/fixtures").standardizedFileURL
        return try JSONDecoder().decode(type, from: Data(contentsOf: fixtures.appending(path: "\(name).json")))
    }

    @Test func theStudioStartsFromWhatMadeIt() throws {
        var item = try #require(try fixture("search_library", as: [MediaItem].self).first)
        item.prompt = "A slow push along a harbour"
        #expect(LibraryModel.studioPrompt(for: item) == "A slow push along a harbour")
        item.prompt = nil
        #expect(LibraryModel.studioPrompt(for: item) == item.description)
    }
}
