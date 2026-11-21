import Foundation

extension OrbState {
    /// What the agent's orb shows for the step it is on, so the motion says what kind of work is happening:
    /// planning reads as solving, watching or checking as searching, making media as composing, writing a
    /// prompt as weaving. Between steps it breathes. The same mapping as the web's `agentOrbState`.
    init(step: AgentStep?) {
        guard let step else { self = .breathing; return }
        switch step.kind {
        case .plan: self = .solving
        case .review: self = .searching
        default:
            let app = step.app ?? ""
            func any(_ words: [String]) -> Bool { words.contains { app.contains($0) } }
            if any(["understanding", "detect", "segment", "caption", "transcri"]) {
                self = .searching
            } else if any(["to-video", "to-image", "image-edit", "video-edit", "music", "sfx", "tts", "speech", "audio", "3d", "upscale", "restyle"]) {
                self = .composing
            } else if any(["chat", "llm", "text"]) {
                self = .weaving
            } else {
                self = .working
            }
        }
    }
}
