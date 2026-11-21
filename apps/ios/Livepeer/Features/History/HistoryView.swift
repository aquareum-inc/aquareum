import SwiftUI

/// The person's conversations: search by title, open one, swipe to delete.
struct HistoryView: View {
    let open: (ConversationSummary) -> Void
    @State private var model: HistoryModel
    @State private var search = ""
    @State private var deleting: ConversationSummary?
    @Environment(\.palette) private var palette

    init(api: API, open: @escaping (ConversationSummary) -> Void) {
        self.open = open
        _model = State(initialValue: HistoryModel(api: api))
    }

    var body: some View {
        Group {
            switch model.phase {
            case .loading:
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity).accessibilityLabel("Loading your conversations")
            case .failed:
                LoadFailure(message: "Your conversations didn't load. Check your connection and try again.") { Task { await model.load() } }
                    .frame(maxHeight: .infinity)
            case .loaded where model.conversations.isEmpty:
                EmptyState(symbol: "bubble.left.and.text.bubble.right", title: "No conversations yet", message: "What you ask for on Home starts one, and it shows up here.")
            case .loaded:
                let shown = model.matching(search)
                List {
                    if let error = model.deleteError {
                        Text(error).text(.body).foregroundStyle(palette.destructive).listRowBackground(Color.clear)
                    }
                    ForEach(shown, id: \.id) { summary in
                        Button { open(summary) } label: {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(summary.title).text(.body, weight: .medium).foregroundStyle(palette.foreground).lineLimit(2)
                                Text(Self.when(summary.updatedAt)).text(.caption, mono: true).foregroundStyle(palette.subtleForeground)
                            }
                            .padding(.vertical, 4)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(Color.clear)
                        .listRowSeparatorTint(palette.hairline)
                        .swipeActions {
                            Button("Delete", systemImage: "trash", role: .destructive) { deleting = summary }
                                .tint(palette.destructiveFill)
                        }
                        .contextMenu {
                            Button("Delete", systemImage: "trash", role: .destructive) { deleting = summary }
                        }
                    }
                    if shown.isEmpty {
                        Text("Nothing matches “\(search)”.").text(.body).foregroundStyle(palette.mutedForeground).listRowBackground(Color.clear)
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .refreshable { await model.load() }
            }
        }
        .background(palette.background)
        .navigationTitle("Conversations")
        .searchable(text: $search, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search by title")
        .task { await model.load() }
        .alert("Delete this conversation?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), presenting: deleting) { summary in
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) { Task { await model.delete(summary) } }
        } message: { _ in
            Text("Its shots stay in your library. This can't be undone.")
        }
        .sensoryFeedback(.warning, trigger: deleting?.id) { _, new in new != nil }
    }

    /// "Today, 14:05", "Yesterday", "12 Nov": when it last changed, in the person's own format.
    private static func when(_ stamp: String) -> String {
        guard let date = try? Date(stamp, strategy: .iso8601.year().month().day().time(includingFractionalSeconds: true)) ?? Date(stamp, strategy: .iso8601) else { return "" }
        if Calendar.current.isDateInToday(date) { return "Today, " + date.formatted(date: .omitted, time: .shortened) }
        if Calendar.current.isDateInYesterday(date) { return "Yesterday" }
        return date.formatted(.dateTime.day().month(.abbreviated))
    }
}
