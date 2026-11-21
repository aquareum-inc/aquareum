import Foundation
import Testing
@testable import Livepeer

/// The studio as the instance describes it, and its quotes.
struct StudioTests {
    private func fixture<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
        let fixtures = URL(filePath: #filePath).deletingLastPathComponent().appending(path: "../../../docs/mobile/fixtures").standardizedFileURL
        return try JSONDecoder().decode(type, from: Data(contentsOf: fixtures.appending(path: "\(name).json")))
    }

    @Test func mediumsDecodeWithTheirModes() throws {
        let mediums = try fixture("list_studio_mediums", as: [StudioMedium].self)
        #expect(mediums.map(\.kind) == [.video, .image, .audio])
        let video = try #require(mediums.first)
        // Modes that need an input to upload aren't offered on phones; what's left can still be written.
        let offered = video.modes.filter { !$0.needsInput }
        #expect(offered.map(\.value) == ["frames"])
        #expect(!(offered.first?.wordsPlaceholder.contains("frame") ?? true))
        #expect(mediums[1].maxVariants == 4)
    }

    @Test func aQuoteIsCredits() throws {
        #expect(try fixture("quote_generation", as: Quote.self).credits == 55)
    }
}
