import SwiftUI

/// The instance's night-sky photograph with a live aurora drawn over it (`Aurora.metal`), as the web's
/// `AuroraSky` does. On the light theme the same aurora tints a pale sky. With Reduce Motion or Low Power
/// Mode on it holds still: the dimmed photograph on the dark theme, the pale page on the light. It pauses
/// whenever the app isn't in front.
struct AuroraSky: View {
    let url: URL
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var start = Date.now
    @State private var lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled

    var body: some View {
        GeometryReader { geometry in
            let size = geometry.size
            AsyncImage(url: url, transaction: Transaction(animation: .easeOut(duration: 0.8))) { phase in
                if let picture = phase.image {
                    if reduceMotion || lowPower {
                        if scheme == .dark { photo(picture, size: size, drift: .zero).brightness(-0.56) }
                    } else {
                        TimelineView(.animation(paused: scenePhase != .active)) { context in
                            let time = context.date.timeIntervalSince(start)
                            // The photo drifts very slowly behind the sky, as on the web.
                            let drift = CGSize(width: size.width * 0.022 * sin(time * 0.011), height: size.height * 0.022 * cos(time * 0.008))
                            photo(picture, size: size, drift: drift)
                                .layerEffect(
                                    ShaderLibrary.auroraSky(.float2(size), .float(time), .float(scheme == .light ? 1 : 0)),
                                    maxSampleOffset: CGSize(width: 7, height: 7)
                                )
                        }
                        .transition(.opacity)
                    }
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)) { _ in
            lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
        }
        .accessibilityHidden(true)
    }

    private func photo(_ picture: Image, size: CGSize, drift: CGSize) -> some View {
        picture
            .resizable()
            .scaledToFill()
            .frame(width: size.width, height: size.height)
            .scaleEffect(1.06)
            .offset(drift)
            .frame(width: size.width, height: size.height)
            .clipped()
    }
}
