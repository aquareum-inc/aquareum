import SwiftUI

/// The instance's mark and CONSOLE in small mono capitals: the standing label that says this is not the user app.
struct ConsoleLabel: View {
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 8) {
            BrandSymbol().frame(width: 18, height: 18)
            Text("CONSOLE")
                .text(.caption, weight: .medium, mono: true)
                .tracking(1.6)
                .foregroundStyle(palette.mutedForeground)
        }
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Console")
        .accessibilityAddTraits(.isHeader)
    }
}

/// What every console root carries in its bar: the label where the user app has its title, and the way back
/// where the avatar sits. Bars don't grow with text size, so neither does this.
struct ConsoleToolbar: ToolbarContent {
    @Environment(ConsoleSession.self) private var session
    @Environment(\.palette) private var palette

    var body: some ToolbarContent {
        if #available(iOS 26, *) {
            ToolbarItem(placement: .topBarLeading) { label }.sharedBackgroundVisibility(.hidden)
        } else {
            ToolbarItem(placement: .topBarLeading) { label }
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button("Back to the app") { session.dismiss() }
                .text(.body, weight: .medium)
                .foregroundStyle(palette.foreground)
                .dynamicTypeSize(...DynamicTypeSize.xLarge)
        }
    }

    private var label: some View {
        ConsoleLabel().padding(.leading, 4).dynamicTypeSize(...DynamicTypeSize.xLarge)
    }
}

/// A state as a dot. Always beside the word for it, never the only sign.
struct StateDot: View {
    enum Tone { case good, bad, active, quiet }
    let tone: Tone
    var size: CGFloat = 8
    @Environment(\.palette) private var palette

    var body: some View {
        Circle()
            .fill(colour)
            .frame(width: size, height: size)
            .breathing(tone == .active)
            .accessibilityHidden(true)
    }

    private var colour: Color {
        switch tone {
        case .good: palette.brand
        case .bad: palette.destructive
        case .active: palette.foreground
        case .quiet: palette.subtleForeground
        }
    }
}

/// A titled group: a small heading over a card of rows.
struct ConsoleSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .text(.caption, weight: .medium)
                .foregroundStyle(palette.mutedForeground)
                .padding(.horizontal, 4)
                .accessibilityAddTraits(.isHeader)
            VStack(spacing: 0) { content }
                .background(palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(palette.hairline, lineWidth: 1))
        }
    }
}

/// The line between two rows of a card.
struct RowRule: View {
    @Environment(\.palette) private var palette
    var body: some View { Rectangle().fill(palette.hairline).frame(height: 1).padding(.leading, 16) }
}

/// One fact: what it is, then its value in mono. At the largest text sizes the value moves under its name.
/// A value that can be copied offers it on a long press.
struct FactRow<Accessory: View>: View {
    let name: String
    let value: String
    var copies = false
    @ViewBuilder var accessory: Accessory
    @Environment(\.palette) private var palette
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        Group {
            if typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 4) {
                    nameText
                    HStack(spacing: 8) { accessory; valueText.multilineTextAlignment(.leading) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 16) {
                    nameText.layoutPriority(1)
                    Spacer(minLength: 0)
                    HStack(alignment: .firstTextBaseline, spacing: 8) { accessory; valueText.multilineTextAlignment(.trailing) }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(minHeight: 48)
        .contentShape(Rectangle())
        .contextMenu {
            if copies {
                Button("Copy", systemImage: "doc.on.doc") { UIPasteboard.general.string = value }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var nameText: some View {
        Text(name).text(.body).foregroundStyle(palette.mutedForeground)
    }

    private var valueText: some View {
        Text(value).text(.body, mono: true).foregroundStyle(palette.foreground)
    }
}

extension FactRow where Accessory == EmptyView {
    init(name: String, value: String, copies: Bool = false) {
        self.init(name: name, value: value, copies: copies) { EmptyView() }
    }
}

/// A filter above a list. Selected is a filled chip with an ink edge; it is never the view's main action.
struct FilterChip: View {
    let label: String
    let selected: Bool
    let action: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        Button(action: action) {
            Text(label)
                .text(.body, weight: .medium)
                .foregroundStyle(selected ? palette.foreground : palette.mutedForeground)
                .padding(.horizontal, 16)
                .frame(minHeight: 36)
                .background(selected ? palette.active : palette.card, in: Capsule())
                .overlay(Capsule().strokeBorder(selected ? palette.foreground.opacity(0.5) : palette.hairline, lineWidth: 1))
                .frame(minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(PressStyle())
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}
