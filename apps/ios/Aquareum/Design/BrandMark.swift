import SwiftUI

/// An instance's mark, drawn from its SVG path data so it scales and tints like type. Handles what logo
/// marks are made of: absolute and relative move, line, horizontal, vertical, cubic and close commands.
struct VectorMark: Equatable, Sendable {
    let viewBox: CGRect
    let path: Path

    init?(svg: String) {
        guard let box = Self.attribute("viewBox", in: svg)?.split(whereSeparator: { $0 == " " || $0 == "," }).compactMap({ Double($0) }), box.count == 4 else { return nil }
        viewBox = CGRect(x: box[0], y: box[1], width: box[2], height: box[3])
        var combined = Path()
        var found = false
        for match in svg.matches(of: /<path[^>]*\sd="([^"]+)"/) {
            guard let part = Self.path(from: String(match.1)) else { return nil }
            combined.addPath(part)
            found = true
        }
        guard found else { return nil }
        path = combined
    }

    private static func attribute(_ name: String, in svg: String) -> String? {
        guard let match = try? Regex("\(name)=\"([^\"]+)\"").firstMatch(in: svg), let value = match.output[1].substring else { return nil }
        return String(value)
    }

    private static func path(from data: String) -> Path? {
        var path = Path()
        var numbers: [Double] = []
        var command: Swift.Character? // `Character` alone is the API model of that name.
        var current = CGPoint.zero
        var start = CGPoint.zero

        func flush() -> Bool {
            guard let command else { return numbers.isEmpty }
            let relative = command.isLowercase
            func point(_ x: Double, _ y: Double) -> CGPoint { relative ? CGPoint(x: current.x + x, y: current.y + y) : CGPoint(x: x, y: y) }
            var values = numbers[...]
            numbers = []
            switch command.uppercased() {
            case "M":
                guard values.count >= 2, values.count % 2 == 0 else { return false }
                current = point(values.removeFirst(), values.removeFirst())
                start = current
                path.move(to: current)
                while values.count >= 2 { current = point(values.removeFirst(), values.removeFirst()); path.addLine(to: current) }
            case "L":
                guard !values.isEmpty, values.count % 2 == 0 else { return false }
                while values.count >= 2 { current = point(values.removeFirst(), values.removeFirst()); path.addLine(to: current) }
            case "H":
                guard !values.isEmpty else { return false }
                for x in values { current = CGPoint(x: relative ? current.x + x : x, y: current.y); path.addLine(to: current) }
            case "V":
                guard !values.isEmpty else { return false }
                for y in values { current = CGPoint(x: current.x, y: relative ? current.y + y : y); path.addLine(to: current) }
            case "C":
                guard !values.isEmpty, values.count % 6 == 0 else { return false }
                while values.count >= 6 {
                    let first = point(values.removeFirst(), values.removeFirst())
                    let second = point(values.removeFirst(), values.removeFirst())
                    let end = point(values.removeFirst(), values.removeFirst())
                    path.addCurve(to: end, control1: first, control2: second)
                    current = end
                }
            case "Z":
                path.closeSubpath()
                current = start
            default:
                return false
            }
            return true
        }

        // Numbers run together in path data ("0-1.5.5"), so read them with a pattern, not by splitting.
        let token = /([MmLlHhVvCcZzSsQqTtAa])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/
        for match in data.matches(of: token) {
            if let letter = match.1?.first {
                guard flush() else { return nil }
                command = letter
            } else if let number = match.2.flatMap({ Double($0) }) {
                numbers.append(number)
            }
        }
        return flush() ? path : nil
    }
}

/// Draws a vector mark to fit, in the current foreground style.
struct VectorMarkView: View {
    let mark: VectorMark

    var body: some View {
        GeometryReader { proxy in
            let scale = min(proxy.size.width / mark.viewBox.width, proxy.size.height / mark.viewBox.height)
            mark.path
                .applying(CGAffineTransform(translationX: -mark.viewBox.minX, y: -mark.viewBox.minY).scaledBy(x: 1, y: 1))
                .applying(CGAffineTransform(scaleX: scale, y: scale))
                .offset(x: (proxy.size.width - mark.viewBox.width * scale) / 2, y: (proxy.size.height - mark.viewBox.height * scale) / 2)
        }
        .aspectRatio(mark.viewBox.width / mark.viewBox.height, contentMode: .fit)
    }
}

/// The instance's square mark: its own symbol when there is one, the first letter of its name otherwise.
struct BrandSymbol: View {
    @Environment(InstanceStore.self) private var instance
    @Environment(\.palette) private var palette

    var body: some View {
        Group {
            if let mark = instance.symbol {
                VectorMarkView(mark: mark)
            } else {
                Text(String(instance.name.prefix(1))).font(.system(size: 13, weight: .semibold))
            }
        }
        .foregroundStyle(palette.foreground)
        .accessibilityHidden(true)
    }
}
