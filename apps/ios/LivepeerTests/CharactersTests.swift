import Foundation
import Testing
@testable import Livepeer

/// Characters as the instance sends them, what a new one needs, and what a report and a block send back.
struct CharactersTests {
    private func fixture<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
        let fixtures = URL(filePath: #filePath).deletingLastPathComponent().appending(path: "../../../docs/mobile/fixtures").standardizedFileURL
        return try JSONDecoder().decode(type, from: Data(contentsOf: fixtures.appending(path: "\(name).json")))
    }

    @Test func aCharacterNeedsANameWhoTheyAreAndHowTheyOpen() {
        #expect(!CharacterDraft(name: "Wren").canCreate)
        #expect(!CharacterDraft(name: "  ", description: "x", greeting: "y").canCreate)
        #expect(CharacterDraft(name: "Wren", description: "A sound recordist.", greeting: "Quiet on set.").canCreate)
    }

    @Test func aReportAndABlockDecode() throws {
        let report = try fixture("report_character", as: CharacterReport.self)
        #expect(report.reason == .spam)
        #expect(report.state == .open)
        #expect(try fixture("block_character", as: CharacterBlock.self).author == "relay-club")
        #expect(try fixture("get_character", as: Character.self).name == "Mara")
    }

    @Test func everyReasonHasItsOwnWords() {
        #expect(Set(ReportReason.offered.map(\.label)).count == ReportReason.offered.count)
        #expect(ReportReason.offered.count == ReportReason.allCases.count - 1)
    }
}
