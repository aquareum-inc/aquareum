import SwiftUI

struct ConversationView: View {
    @State private var model: ConversationModel
    @FocusState private var composing: Bool
    @Environment(\.palette) private var palette
    @Environment(\.scenePhase) private var scenePhase

    init(api: API, conversation: Conversation) {
        _model = State(initialValue: ConversationModel(api: api, conversation: conversation))
    }

    /// The shape the user asked for, so a shot's tile is right before its job has been read.
    private var aspect: String { model.draft.aspect }

    var body: some View {
        ScrollViewReader { scroll in
            ScrollView {
                if model.loadFailed {
                    LoadFailure(message: "This conversation didn't load.") { Task { await model.follow() } }
                        .padding(.top, 80)
                } else {
                    LazyVStack(alignment: .leading, spacing: 24) {
                        ForEach(model.conversation.messages, id: \.id) { message in
                            switch message {
                            case .user(let sent): UserBubble(message: sent)
                            case .agent(let turn): AgentTurnView(turn: turn, generations: model.generations, labels: model.labels, aspect: aspect)
                            }
                        }
                        Color.clear.frame(height: 1).id("end")
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 20)
                    .padding(.bottom, 16)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            // Keep the newest thing in view: a new message, and a shot's tile when it first appears.
            .onChange(of: model.conversation.messages.count) { withAnimation(.enter) { scroll.scrollTo("end", anchor: .bottom) } }
            .onChange(of: model.generations.count) { withAnimation(.enter) { scroll.scrollTo("end", anchor: .bottom) } }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: 6) {
                if let error = model.sendError {
                    Text(error).text(.caption).foregroundStyle(palette.destructive)
                }
                Composer(draft: $model.draft, placeholder: "Ask for a change, or describe the next shot…", sending: model.sending, focused: $composing) {
                    Task { await model.send() }
                }
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 8)
        }
        .background(palette.background)
        .navigationTitle(model.conversation.title)
        .navigationBarTitleDisplayMode(.inline)
        // Follows while on screen and in the foreground; a new message or coming back starts it again.
        .task(id: FollowKey(active: scenePhase == .active, messages: model.conversation.messages.count)) {
            guard scenePhase == .active else { return }
            await model.follow()
        }
    }

    private struct FollowKey: Equatable {
        let active: Bool
        let messages: Int
    }
}

extension Message {
    var id: String {
        switch self {
        case .user(let message): message.id
        case .agent(let message): message.id
        }
    }
}

private struct UserBubble: View {
    let message: UserMessage
    @Environment(\.palette) private var palette

    var body: some View {
        Text(message.text)
            .text(.lead)
            .foregroundStyle(palette.foreground)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(palette.hairline, lineWidth: 1))
            .frame(maxWidth: .infinity, alignment: .trailing)
            .padding(.leading, 48)
            .textSelection(.enabled)
    }
}
