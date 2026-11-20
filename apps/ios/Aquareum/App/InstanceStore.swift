import SwiftUI

/// The instance this build belongs to, as it describes itself: name, marks, theme, what it serves.
/// Shown from the last copy at once, then refreshed, so the theme never flashes.
@Observable
final class InstanceStore {
    private(set) var description: InstanceDescription?
    private(set) var symbol: VectorMark?
    private let api: API
    private let defaults: UserDefaults
    private static let cacheKey = "instance.description"
    private static let symbolKey = "instance.symbol.svg"

    init(api: API, defaults: UserDefaults = .standard) {
        self.api = api
        self.defaults = defaults
        if let data = defaults.data(forKey: Self.cacheKey) {
            description = try? JSONDecoder().decode(InstanceDescription.self, from: data)
        }
        if let svg = defaults.string(forKey: Self.symbolKey) { symbol = VectorMark(svg: svg) }
    }

    /// The instance's name; before the first answer, the name the app was built with.
    var name: String {
        description?.name ?? (Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String) ?? ""
    }

    func palette(for scheme: ColorScheme) -> Palette {
        let overrides = scheme == .dark ? description?.theme.dark : description?.theme.light
        return .resolved(for: scheme, overrides: overrides ?? [:])
    }

    /// Reads the description again. A failure keeps the last copy: the app stays usable offline.
    func refresh() async {
        guard let fresh = try? await api.getInstance() else { return }
        description = fresh
        defaults.set(try? JSONEncoder().encode(fresh), forKey: Self.cacheKey)
        await loadSymbol(from: fresh.logo.symbol)
    }

    private func loadSymbol(from address: String?) async {
        guard let address, let url = URL(string: address), url.pathExtension.lowercased() == "svg",
              let (data, _) = try? await URLSession.shared.data(from: url),
              let svg = String(data: data, encoding: .utf8), let mark = VectorMark(svg: svg)
        else {
            symbol = nil
            defaults.removeObject(forKey: Self.symbolKey)
            return
        }
        symbol = mark
        defaults.set(svg, forKey: Self.symbolKey)
    }
}
