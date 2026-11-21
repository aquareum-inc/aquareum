import Foundation
import SwiftUI
import Testing
@testable import Livepeer

/// The generated models against responses captured from a mock-only instance (docs/mobile/fixtures).
struct DecodingTests {
    private func fixture<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
        let fixtures = URL(filePath: #filePath).deletingLastPathComponent().appending(path: "../../../docs/mobile/fixtures").standardizedFileURL
        return try JSONDecoder().decode(type, from: Data(contentsOf: fixtures.appending(path: "\(name).json")))
    }

    @Test func instanceDescription() throws {
        let instance = try fixture("get_instance", as: InstanceDescription.self)
        #expect(instance.apiVersion == "1")
        #expect(!instance.name.isEmpty)
        #expect(instance.signIn.methods.contains(.email))
    }

    @Test func homeLists() throws {
        #expect(try !fixture("list_prompt_starters", as: [PromptStarter].self).isEmpty)
        #expect(try !fixture("list_showcase", as: [ShowcaseItem].self).isEmpty)
        #expect(try !fixture("list_agent_models", as: [AgentModel].self).isEmpty)
        #expect(try !fixture("list_capability_labels", as: [CapabilityLabel].self).isEmpty)
        #expect(try !fixture("list_capabilities", as: [Offering].self).isEmpty)
    }

    @Test func conversationTellsUserAndAgentMessagesApart() throws {
        for name in ["create_conversation", "get_conversation_working", "get_conversation_done"] {
            let conversation = try fixture(name, as: Conversation.self)
            guard case .user(let sent) = conversation.messages.first, case .agent(let turn) = conversation.messages.last else {
                Issue.record("\(name): expected a user message, then an agent turn")
                continue
            }
            #expect(!sent.text.isEmpty)
            #expect(turn.state != .unknown)
        }
    }

    @Test func generation() throws {
        let generation = try fixture("get_generation", as: Generation.self)
        #expect(generation.state != .unknown)
        #expect(generation.artwork.hues.count == 3)
    }

    @Test func aValueFromANewerInstanceDecodesAsUnknown() throws {
        let state = try JSONDecoder().decode(GenerationState.self, from: Data(#""paused""#.utf8))
        #expect(state == .unknown)
    }
}

struct DesignTests {
    @Test func hexColoursFromAnInstanceParse() {
        #expect(Color(hex: "#40BF86") != nil)
        #expect(Color(hex: "#40BF8680") != nil)
        #expect(Color(hex: "40BF86") != nil)
        #expect(Color(hex: "#40B") == nil)
        #expect(Color(hex: "primary") == nil)
    }

    @Test func themeOverridesReplaceOnlyTheTokensTheyName() {
        let palette = Palette.resolved(for: .dark, overrides: ["primary": "#FF0000", "not-a-token": "#00FF00"])
        #expect(palette.primary == Color(hex: "#FF0000"))
        #expect(palette.background == Palette.dark.background)
    }

    @Test func svgMarksBecomePaths() {
        let mark = VectorMark(svg: #"<svg viewBox="0 0 10 20"><path d="M0 0H10V20H0Z" /><path d="m1 1 2 2c1 0 2 1 2 2z"/></svg>"#)
        #expect(mark?.viewBox == CGRect(x: 0, y: 0, width: 10, height: 20))
        #expect(mark?.path.boundingRect == CGRect(x: 0, y: 0, width: 10, height: 20))
        #expect(VectorMark(svg: "<svg><circle r=\"4\"/></svg>") == nil)
    }
}
