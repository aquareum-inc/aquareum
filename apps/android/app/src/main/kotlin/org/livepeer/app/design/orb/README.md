# Thinking orb (ported)

A Kotlin and Compose port of [thinking orbs](https://libraries.dev/orbs) by Jakub Antalik, MIT (see `LICENSE`).

- Transcribed from the SwiftUI port vendored at `apps/ios/Livepeer/Vendor/ThinkingOrbs` (Libraries.dev commit
  `14ae9d2dad18fcee251f4b06333b492a2a41d2ed`), which follows the npm package `thinking-orbs` 0.3.2 the web uses.
- Only the six states the app shows (working, searching, solving, weaving, composing, breathing) at the 20-point
  design. The formulas and constants are unchanged; `OrbTest` checks the frames match the library's shape.

When the iOS copy is updated, carry the same changes here.
