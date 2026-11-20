import SwiftUI

@main
struct AquareumApp: App {
    private let api: API
    @State private var instance: InstanceStore

    init() {
        let api = API(transport: APITransport(baseURL: BuildConfig.instanceURL, token: { BuildConfig.demoKey }))
        self.api = api
        _instance = State(initialValue: InstanceStore(api: api))
    }

    var body: some Scene {
        WindowGroup {
            RootView(api: api)
                .environment(instance)
                .task { await instance.refresh() }
        }
    }
}

/// Where a pushed screen goes.
enum Route: Hashable {
    case conversation(Conversation)
}

struct RootView: View {
    let api: API
    @Environment(InstanceStore.self) private var instance
    @Environment(\.colorScheme) private var systemScheme
    @Environment(\.scenePhase) private var scenePhase
    /// "dark" or "light" pins the theme; anything else follows the system.
    @AppStorage("theme") private var theme = "system"
    @State private var path: [Route] = []
    @Namespace private var travel

    private var scheme: ColorScheme { theme == "dark" ? .dark : theme == "light" ? .light : systemScheme }

    var body: some View {
        let palette = instance.palette(for: scheme)
        NavigationStack(path: $path) {
            HomeView(api: api, travel: travel) { conversation in path.append(.conversation(conversation)) }
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .conversation(let conversation):
                        ConversationView(api: api, conversation: conversation)
                            .navigationTransition(.zoom(sourceID: "composer", in: travel))
                    }
                }
        }
        .environment(\.palette, palette)
        .tint(palette.foreground)
        .preferredColorScheme(theme == "dark" ? .dark : theme == "light" ? .light : nil)
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await instance.refresh() } }
        }
    }
}
