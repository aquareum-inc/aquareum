# ThinkingOrbs (vendored)

The SwiftUI port of [thinking orbs](https://libraries.dev/orbs) by Jakub Antalik, MIT (see `LICENSE`).

- Source: `packages/thinking-orbs/ports/ios/ThinkingOrbsKit/Sources/ThinkingOrbsKit` in
  github.com/Jakubantalik/Libraries.dev, at commit `14ae9d2dad18fcee251f4b06333b492a2a41d2ed` (19 November 2026).
- Vendored rather than added through SwiftPM: the package is installed from that repository's `main` branch,
  and the repository is 284 MB for these nine files. `Snapshot.swift` (the author's snapshot-test harness) is
  left out; nothing else is changed.
- The web uses the same library from npm (`thinking-orbs`, pinned in `packages/user-app/package.json`), so the
  two draw the same frames.

To update: copy the same files from a newer commit, record it here, and check the agent's orb on Home and in a
conversation in both themes.
