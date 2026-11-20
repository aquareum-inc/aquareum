import Foundation
import Testing
@testable import Aquareum

/// What the composer sends, and the responses its menus and trays read.
struct ComposerTests {
    private func fixture<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
        let fixtures = URL(filePath: #filePath).deletingLastPathComponent().appending(path: "../../../docs/mobile/fixtures").standardizedFileURL
        return try JSONDecoder().decode(type, from: Data(contentsOf: fixtures.appending(path: "\(name).json")))
    }

    @Test func anAttachmentAloneAsksForASummary() throws {
        let video = try #require(try fixture("search_library", as: [MediaItem].self).first)
        #expect(!Draft().canSend)
        var draft = Draft(attachments: [video])
        #expect(draft.canSend)
        #expect(draft.text == "Summarise this and list the key moments.")
        draft.prompt = "  Make it slower "
        #expect(draft.text == "Make it slower")
    }

    @Test func theModelAndTheCastCarryOn() {
        let cast = CharacterCast(slug: "mara", name: "Mara", image: nil)
        let carried = Draft(prompt: "On a rooftop", app: "image-to-video", cast: cast, model: "northlight/chat/gemma-3-27b").carriedOn
        #expect(carried.prompt.isEmpty)
        #expect(carried.cast == cast && carried.model == "northlight/chat/gemma-3-27b" && carried.app == "image-to-video")
        #expect(Draft(app: "text-to-video").carriedOn.app == nil)
    }

    @Test func menusAndTraysDecode() throws {
        let menu = try fixture("list_agent_model_menu", as: [AgentModelEntry].self)
        #expect(menu.count >= 2 && menu.allSatisfy { !$0.name.isEmpty && !$0.description.isEmpty })
        #expect(try !fixture("list_characters", as: [Character].self).isEmpty)
        #expect(try !fixture("list_conversations", as: [ConversationSummary].self).isEmpty)
        #expect(try fixture("search_library", as: [MediaItem].self).allSatisfy { $0.kind == .video })
    }
}
