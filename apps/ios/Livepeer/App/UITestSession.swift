#if DEBUG
import Foundation

/// How UI tests start the app signed in or signed out. A test signs in through the instance's real native flow
/// and passes the device session it was given; `signed-out` clears any session left from an earlier run. Only a
/// Debug build reads this, so a release build can't be handed a session this way.
enum UITestSession {
    static func apply(to vault: TokenVault) {
        guard let session = ProcessInfo.processInfo.environment["LIVEPEER_UI_TEST_SESSION"] else { return }
        vault.set(session == "signed-out" ? nil : session)
    }
}
#endif
