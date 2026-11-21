import SwiftUI

/// One studio draft: the words, the mode and the settings for one medium.
struct StudioDraft: Equatable {
    var mode: String
    var prompt = ""
    var aspect: String?
    var durationSeconds: Double?
    var resolution: String?
    var variants = 1

    var canGenerate: Bool { !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
}

/// The studio: one medium at a time, a draft for each, and what each has made, newest first.
///
/// Which mediums and modes exist, and what each runs, comes from the instance (`list_studio_mediums`),
/// which reads the web's own studio. Modes that only make sense with an input to upload aren't offered
/// until the apps can send one.
@Observable
final class StudioModel {
    enum Phase { case loading, loaded, failed }

    private(set) var phase = Phase.loading
    private(set) var mediums: [StudioMedium] = []
    var kind: MediaKind = .video
    private(set) var drafts: [MediaKind: StudioDraft] = [:]
    private(set) var made: [MediaKind: [Generation]] = [:]
    /// What one result of the current draft costs, once quoted.
    private(set) var quote: Int?
    private(set) var generating = false
    /// Why the last Generate didn't start, in words for the person.
    var error: String?
    private let api: API

    init(api: API) { self.api = api }

    var medium: StudioMedium? { mediums.first { $0.kind == kind } }

    /// The modes the apps can offer: those that don't need an input to upload.
    var modes: [StudioMode] { medium?.modes.filter { !$0.needsInput } ?? [] }

    var draft: StudioDraft {
        get { drafts[kind] ?? fresh(for: kind) }
        set { drafts[kind] = newValue }
    }

    var mode: StudioMode? { modes.first { $0.value == draft.mode } ?? modes.first }
    var results: [Generation] { made[kind] ?? [] }
    var cost: Int? { quote.map { $0 * draft.variants } }

    func load() async {
        do {
            mediums = try await api.listStudioMediums()
            // The operator may have taken a medium out of the studio: open one that's offered.
            if !mediums.contains(where: { $0.kind == kind }), let first = mediums.first { kind = first.kind }
            // A draft opened with words before the studio loaded gets this medium's defaults now.
            for (kind, draft) in drafts where draft.mode.isEmpty {
                var fresh = fresh(for: kind)
                fresh.prompt = draft.prompt
                drafts[kind] = fresh
            }
            phase = .loaded
            await requote()
        } catch {
            if mediums.isEmpty { phase = .failed }
        }
    }

    /// Opens a medium with words to start from, as "Open in the studio" does from a conversation.
    func open(_ kind: MediaKind, prompt: String) {
        // Once loaded, a medium the instance doesn't offer keeps the studio on the one it's showing.
        if phase != .loaded || mediums.contains(where: { $0.kind == kind }) { self.kind = kind }
        var draft = self.draft
        draft.prompt = prompt
        self.draft = draft
    }

    /// Changes mode, keeping the words and the shape.
    func choose(mode value: String) {
        guard let next = modes.first(where: { $0.value == value }) else { return }
        var draft = self.draft
        draft.mode = value
        if let durations = next.durations, !durations.contains(draft.durationSeconds ?? -1) { draft.durationSeconds = durations.first }
        if next.durations == nil { draft.durationSeconds = nil }
        self.draft = draft
    }

    /// Reads the price of one result again, after anything that changes it.
    func requote() async {
        guard let mode else { quote = nil; return }
        let draft = self.draft
        quote = (try? await api.quoteGeneration(kind: kind.rawValue, app: mode.app, durationSeconds: draft.durationSeconds, resolution: draft.resolution)).map { Int($0.credits) }
    }

    /// Starts the draft, once per variant. Each result appears at once and renders in place.
    func generate() async -> Bool {
        guard let mode, mode.available, draft.canGenerate, !generating else { return false }
        generating = true
        error = nil
        defer { generating = false }
        let draft = self.draft
        let kind = self.kind
        do {
            let started = try await withThrowingTaskGroup(of: Generation.self) { group in
                for _ in 0..<draft.variants {
                    group.addTask { [api] in
                        try await api.createGeneration(kind: kind.rawValue, app: mode.app, prompt: draft.prompt.trimmingCharacters(in: .whitespacesAndNewlines), aspect: draft.aspect, durationSeconds: draft.durationSeconds, resolution: draft.resolution)
                    }
                }
                var all: [Generation] = []
                for try await generation in group { all.append(generation) }
                return all
            }
            made[kind, default: []].insert(contentsOf: started, at: 0)
            return true
        } catch {
            self.error = "That didn’t start. Nothing was charged — try again."
            return false
        }
    }

    /// True while something here is still rendering.
    var rendering: Bool { made.values.joined().contains { $0.state == .queued || $0.state == .running } }

    /// Follows what is rendering until it finishes: quick at first, then backing off.
    func follow() async {
        let started = ContinuousClock.now
        while !Task.isCancelled, rendering {
            let elapsed = ContinuousClock.now - started
            try? await Task.sleep(for: elapsed < .seconds(10) ? .milliseconds(700) : elapsed < .seconds(30) ? .milliseconds(1500) : elapsed < .seconds(90) ? .seconds(3) : .seconds(5))
            for (kind, generations) in made {
                for (index, generation) in generations.enumerated() where generation.state == .queued || generation.state == .running {
                    if let fresh = try? await api.getGeneration(id: generation.id) { made[kind]?[index] = fresh }
                }
            }
        }
    }

    /// Puts a result's words back in the draft, to change and try again.
    func reuse(_ generation: Generation) {
        var draft = self.draft
        draft.prompt = generation.request.prompt
        self.draft = draft
    }

    private func fresh(for kind: MediaKind) -> StudioDraft {
        let medium = mediums.first { $0.kind == kind }
        let mode = medium?.modes.first { !$0.needsInput }
        return StudioDraft(
            mode: mode?.value ?? "",
            aspect: medium?.aspects?.first?.rawValue,
            durationSeconds: mode?.durations?.first,
            resolution: medium?.resolutions?.first?.rawValue
        )
    }
}
