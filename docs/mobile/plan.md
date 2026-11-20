# Native apps: plan

Native iOS (Swift, SwiftUI) at `apps/ios` and Android (Kotlin, Jetpack Compose) at `apps/android`, for the
user app only. The bar is the Linear mobile app: fast, fluid, idiomatic to each platform. Everything in
`CLAUDE.md` applies; this plan adds what mobile needs.

Status: **proposed, waiting for review.** Sections marked *Decision* need an answer before the slices
start. What exists today is in section 17. Facts about store rules and tools were checked on 19 November 2026 and change often; each is marked
*verify* where a decision depends on it.

## 1. Scope

| In | Slice |
|----|-------|
| Shell, instance description, sign-in, guest browsing | 1 |
| Home and chat (composer, starting points, gallery, agent steps, shots) | 2 |
| Studio: video, image, audio | 3 |
| Library | 4 |
| Characters, only when the instance enables them | 5 |
| Settings: profile, general, privacy, plan and balance, usage | 6 |

| Out | Why |
|-----|-----|
| Operator console, Developers section | A desk job; stays on the web. |
| Studio Live, character calls | Planned in section 10; built when live sessions are connected (engine request R2). |
| Buying credits, changing plan | Balance, plan and usage are shown. Purchasing waits on the decision in section 11. |
| `./aquareum mobile` | Designed in section 13; built once the apps work against the flagship. |

## 2. Toolchain

Checked on the project owner's Mac (Apple silicon, macOS 26.6.2) on 19 November 2026.

| Tool | State | Action |
|------|-------|--------|
| Xcode 27.1, Swift 6.4, iOS 26.5 simulators | Installed | None. |
| Metal toolchain (a separate Xcode component, for `Aurora.metal`) | Installed 20 November 2026 | `xcodebuild -downloadComponent MetalToolchain` on any machine that builds the iOS app. |
| Apple's Xcode MCP bridge (`xcrun mcpbridge`, and the headless `xcrun mcp-server`) | Shipped with Xcode, not registered | Xcode ▸ Settings ▸ Intelligence ▸ Model Context Protocol ▸ turn on **Xcode Tools**, then `claude mcp add --transport stdio xcode -- xcrun mcpbridge`. |
| XcodeBuildMCP | Not installed. Renamed **MobileBuildMCP**; the old site and repository redirect to it (*verify*) | `claude mcp add MobileBuildMCP -- npx -y mobilebuildmcp@latest mcp`. Optional: the desktop app's own simulator tools already build, launch, drive and screenshot. |
| Android Studio (Rabbit 2, 2026.2.2 Patch 1) | Not installed | `brew install --cask android-studio`, open it once and let the wizard install the SDK, platform tools and emulator. |
| Android SDK, emulator, an AVD | Not installed | Through the wizard, or `android sdk install platform-tools emulator platforms/android-36` and `android emulator create` (default profile `medium_phone`). |
| Google's Android CLI (1.0, May 2026) | Not installed | Download from developer.android.com/tools/agents (the page gives the macOS command), then `android init`. |
| JDK | Temurin 21 installed | None; Android Studio also bundles one. |
| Disk | **10 GB free** | Android Studio, the SDK and one emulator image need about 12–15 GB. Free space first. |
| XcodeGen | Not installed | Not needed: see section 3. |

## 3. Layout

```
apps/ios                     Xcode project, one app target, one test target, one UI test target
  Aquareum/                  App, Shell, Features/<Home|Chat|Studio|Library|Characters|Settings>, Design, API
  Aquareum/Generated/        API models and client, tokens (generated, committed)
  Config/Instance.xcconfig   Name, bundle identifier, instance URL (written by `./aquareum mobile`)
apps/android                 Gradle project, one `app` module
  app/src/main/kotlin/…      same feature folders
  app/src/main/kotlin/…/generated/
  instance.properties        Name, application id, instance URL
packages/mobile-codegen      OpenAPI → Swift and Kotlin generator, token generator (Node, no runtime deps)
docs/mobile                  This plan, the OpenAPI document, captured fixtures
docs/screenshots/mobile      Per-slice screenshots, both platforms, dark and light
```

- The Xcode project is committed as a normal `.xcodeproj` using folder references (synchronised groups),
  so adding a file needs no project edit and no project generator.
- `apps/ios` and `apps/android` are added to `.dockerignore`. The Dockerfile copies `apps`, so without that
  line they would bloat the image and break its cache. `pnpm-workspace.yaml` is unchanged: neither is a
  Node package.

## 4. API

The apps are clients of an instance's `/api/v1` and nothing else. No engine or provider call, and no
builder key, reader token or admin token on a device.

### 4.1 Operations to add

Compared `docs/ui-actions.md` with `apps/web/lib/public-api/operations.ts`. The mobile scope needs these,
each calling one existing API client function unless marked **new**.

| Operation | Method and path | API client function | Guest | Slice |
|-----------|-----------------|---------------------|-------|-------|
| `get_instance` | `GET /instance` | **new** `describeInstance` (config, no engine call) | yes | built |
| `list_capability_labels` | `GET /offerings/labels` | **new**, derived: `listOfferings`, runner models and the web's naming rules | yes | built |
| `get_me` | `GET /me` | session identity, plus `getCreditBalance` | | 1 |
| `list_devices`, `revoke_device` | `GET /devices`, `DELETE /devices/{id}` | **new**, device sessions (section 5) | | 1 |
| `list_prompt_starters` | `GET /starters` | `listPromptStarters` | yes | built |
| `list_showcase` | `GET /showcase` | `listShowcase` | yes | built |
| `list_agent_models` | `GET /agent-models` | `listAgentModels` | yes | built |
| `delete_conversation` | `DELETE /conversations/{id}` | `deleteConversation` | | 2 |
| `get_character` | `GET /characters/{slug}` | `getCharacter` | yes, public ones | 5 |
| `create_character` | `POST /characters` | `createCharacter` | | 5 |
| `report_character`, `block_character` | `POST /characters/{slug}/report`, `…/block` | **new** (section 12) | | 5 |
| `get_account` | `GET /account` (answers with `PlanAndCredits`) | `getAccount` | | 6 |
| `get_preferences`, `update_preferences` | `GET`, `PATCH /preferences` | `getPreferences`, `updatePreferences` | | 6 |
| `delete_account` | `DELETE /me` | **new**, provider identity (section 12, question Q14) | | 6 |

Changes to existing operations:

- `create_conversation` and `send_message` gain `agent_model` and `character_slug`, which the API client
  already takes and the web already sends.
- `list_capabilities` and `list_characters` become available to guests (public characters only), as on
  the web.
- An operation gets a `public: true` flag. Without a caller it runs as the instance's default account,
  exactly as the web does for a guest. Everything else still answers 401.

**Names come from the instance.** How a capability or a model reads ("Text to image · FLUX.2 klein 4B") is
decided by rules in `packages/user-app/src/lib/capability-menu.ts`. The apps don't re-implement them in
Swift and Kotlin: `list_capability_labels` returns the result, and slice 2 adds the same for the agent's
model menu.

Not added, and why: `uploadMedia` and `getMediaUrl` don't exist in the API client yet (the web marks
them "not wired"), so attaching from Photos and saving a result to Photos are planned for when the media
store and real outputs exist. Until then mobile attaches from the library, as the web does.

### 4.2 Response schemas and the OpenAPI document

Operations describe inputs only. Proposed:

1. Each operation names its output: `output: "Conversation"`, `output: ["MediaItem"]`.
2. JSON Schemas for those names are generated from `packages/api-client/src/types.ts` with
   `ts-json-schema-generator` (a dev dependency, build time only), so the TypeScript types stay the single
   definition and "the real response wins" keeps holding.
3. `pnpm api:openapi` writes `docs/mobile/openapi.json` (OpenAPI 3.1) from the operations list: paths,
   inputs, outputs, the error envelope, which operations are public and which need the operator role.
   Operator operations are left out of the mobile clients.
4. A test runs every non-operator operation against a mock-only instance and validates the response
   against its schema. The captured responses are saved as `docs/mobile/fixtures/*.json`, and the native
   decoding tests read those same files.

### 4.3 Generated clients (*Decision*)

Recommended: **our own generator** in `packages/mobile-codegen`, a few hundred lines of Node that reads
`openapi.json` and writes `Codable` structs with a `URLSession` client, and `@Serializable` data classes
with an OkHttp client. Why: the document is small and regular (about 35 operations, plain objects, enums,
one tagged union for messages); both languages come from one script, so they can't drift apart; the
"generated code is current" check runs in the existing Node CI job with no Swift or JVM toolchain; and the
apps gain no third-party runtime.

The alternative is Apple's `swift-openapi-generator` (three packages and a build plugin) plus OpenAPI
Generator for Kotlin (a Java tool with its own runtime templates). More standard, but two tools, two
styles of output and extra dependencies in each app.

CI check: `pnpm api:openapi && pnpm mobile:generate && git diff --exit-code`.

### 4.4 The instance description

`GET /api/v1/instance`, no authentication:

```json
{
  "api_version": "1",
  "name": "Livepeer",
  "logo": { "symbol": "https://…/brand/symbol.svg", "wordmark": "…", "tint": true },
  "theme": { "dark": { "primary": "#EAEAEA" }, "light": { "primary": "#18181B" } },
  "surfaces": { "app": true, "api": true, "mcp": true, "mobile": true },
  "mobile": {
    "ios": { "bundle_id": "org.livepeer.app", "minimum_version": "1.0.0" },
    "android": { "application_id": "org.livepeer.app", "minimum_version": null }
  },
  "sign_in": { "methods": ["apple", "google", "email", "passkey"], "sign_up": "open" },
  "content": { "characters": true, "adult_content": false },
  "home": { "background_image": "https://…", "background_video": null, "aurora": true }
}
```

- Theme overrides are any CSS colour in the config. The instance resolves them to sRGB hex before
  sending, with the same conversion code the token generator uses, so the apps never parse CSS.
- URLs are absolute. Logos are sent as the config has them; the apps render SVG and raster marks and apply
  the tint.
- The apps fetch it at launch, cache it, and re-fetch on foreground. A cached copy shows at once, so the
  theme never flashes.
- `mobile` names the apps built for the instance (config `mobile.ios.bundleId`, `mobile.android.applicationId`).
  Sign-in returns only to these, so an app that isn't listed shows "not on phones" instead of a sign-in that
  can't finish. `minimum_version` lets an instance ask an old build to update after a breaking API change.

### 4.5 `surfaces.mobile`

Add `mobile: boolean` to `surfaces` in the instance schema, both presets (`false` in `headless`; *Decision*
on `full`, recommended `false` so mobile is opt-in) and the console's Surfaces switches. With it off the
instance issues no device sessions, refuses requests that carry one with 403 and code `mobile_off`, and
`get_instance` says so, so an installed app shows "This service doesn't offer its app on phones right now."

## 5. Sign-in (*Decision*; built in slice 1 once approved)

The starting point holds up. Proposed flow:

1. The app shows a native sign-in screen with the methods from `get_instance`.
2. On a choice, the app makes a PKCE verifier and challenge and opens
   `/auth/start?method=<m>&client=<ios|android>&challenge=<c>&state=<s>` in the system auth session:
   `ASWebAuthenticationSession` on iOS, an Auth Tab (Custom Tabs) on Android. Never a webview.
3. The instance runs its normal flow with the identity provider. The provider's redirect URI stays the
   instance's own `https://…/auth/callback`, so **the provider needs nothing new for mobile**.
4. At the callback, for a native flow the instance sets no cookie. It mints a one-time code (sealed,
   60 seconds, bound to the challenge) and redirects to the app: `<bundle id>://auth?code=…&state=…`.
   It redirects only to the identifiers listed in the instance config (`mobile.ios.bundleId`,
   `mobile.android.applicationId`).
5. The app posts the code and its verifier to `POST /api/v1/auth/device`, with a device name. The instance
   returns a **device session token** and the user's name.
6. The app stores the token in the Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`) or in
   Android Keystore-encrypted storage, and sends it as `Authorization: Bearer aqd_…`.

**The token.** 32 random bytes, shown once. The instance stores only its SHA-256, with the user id, name,
email, device name, platform, created and last-used times, and the user's builder key sealed with
`SESSION_SECRET`. `authenticate()` accepts it after the operator token and API keys. A device session
always has the `user` role: operator work stays on the web, so a lost phone can't administer an instance.

**Lifetime and revocation.**

- Sliding expiry: 90 days without use. No refresh token; the token is the session.
- Sign-out calls `DELETE /api/v1/auth/device`, which deletes the record, then wipes the Keychain entry.
- Settings ▸ Devices, on mobile and web, lists a user's devices and revokes any of them.
- Suspending a user in the console revokes their device sessions. Rotating `SESSION_SECRET` ends all of
  them, as it does for web sessions.
- A 401 on any call returns the app to the guest state with "You've been signed out."

**Where sessions are stored.** Revocation needs state, and the instance has no database yet. Proposed: a
`DeviceSessionStore` interface with a file-backed implementation in the instance's data volume now, and
the database implementation when the instance database lands. It holds sessions only, never balances.
(*Decision*: or build the database foundation first and skip the file store.)

**Guests** look around as on the web: Home, the studio composer, public characters, an empty library.
Anything that spends asks them to sign in, in a tray, and returns them to what they were doing.

**Callback: custom scheme or universal link.** Recommended for the first release: the custom scheme with
PKCE, which needs no domain files. Universal Links and App Links (an `https` callback that only the real
app can claim) are stronger and are the follow-up; the instance would serve
`apple-app-site-association` and `assetlinks.json` from its config.

**What the identity provider must support** (questions Q12–Q14 go in `docs/engine-requests.md`):

- Nothing new for the redirect. Its login pages must work in a system browser session, which rules out
  providers that require their own embedded page.
- **Apple's rule 4.8** (*verify*): an app offering third-party social sign-in must also offer an
  equivalent privacy-preserving option, in practice Sign in with Apple. An operator publishing to the App
  Store with Google or Discord enabled needs `apple` in `auth.methods`. `./aquareum mobile` will check.
- Passkeys work in the system session for the provider's own domain. Wallet sign-in hands off to a wallet
  app and back, which is unreliable inside an auth session; mobile hides `wallet` and `coinbase` until
  tested against the real provider (Q12).
- Can the provider tell the instance when a user is disabled or deleted (back-channel logout or a
  webhook), so device sessions end promptly (Q13)?
- Can the provider delete a user on request? Apple requires in-app account deletion (Q14, section 12).

## 6. Following work in progress

The web polls every 700 ms.

**Built for the first release (slice 2): polling with backoff, on the existing operations.** While a turn or a
render is working: every 700 ms for the first 10 seconds, then 1.5 s, then 3 s, capped at 5 s. Polling
stops when the app leaves the foreground and resumes with one immediate read when it returns. Responses
carry an `ETag`; an unchanged poll answers 304 with no body, so a long render costs almost nothing.

**Next: server-sent events**, shared with the web: `GET /conversations/{id}/events` and
`GET /generations/{id}/events` send the same objects as they change. Both platforms read SSE with
first-party networking (`URLSession.bytes`, OkHttp's SSE module). It is worth building when the engine's
events feed exists (R2); before that the instance would only be polling on the app's behalf.

**"Your video is ready" notifications need, on the server:**

- something that learns a render finished when no client is asking: the engine's events feed (R2), or a
  server-side watcher;
- a store for push tokens per device session (the same store as section 5) and a `register_push_token`
  operation;
- each publisher's own APNs key and Firebase Cloud Messaging credentials, as environment variables;
- a notification preference per user, and a deep link from the notification to the conversation or tile.

Not built until R2 lands. The apps will ask for notification permission only at the moment a user starts
a long render and leaves, never at launch.

## 7. Design

`docs/design-brief.md` and `docs/design-proposals.md` hold: one ink action per view, green never on a
control, mono for facts, a result is one tile from request to finish, the composer is one object that
travels, numbers roll only changed digits, reduced motion becomes a short fade. Each decision below is
logged in `docs/design-proposals.md` as it is built.

**What the sidebar becomes.**

- Its destinations become the system tab bar: **Home, Studio, Library, Characters** (the last only when
  the instance enables characters). `TabView` on iOS, which takes the system's glass on iOS 26 and later;
  `NavigationBar` on Android.
- Its recent conversations become a **history** button at the top left of Home, opening the list as a
  pushed screen with search and swipe-to-delete.
- Its account foot becomes an **avatar at the top right** of each tab's root, opening the account tray:
  name and credits, plan, settings, who can see what, theme, sign out; for a guest, "Sign in or sign up".
- A conversation pushes onto Home's stack and hides the tab bar; the composer docks above the keyboard.

**System behaviour, not the web at 375 px.** Navigation stacks with edge-swipe back and predictive back on
Android; pull to refresh on lists; context menus on tiles (long press); the share sheet for results; drag
to dismiss for media; haptics on send, on a finished render (once, with the green settle) and on
destructive confirms.

**Trays** follow the rules in `docs/research/benji-taylor-notes.md` §1.1, which were written for mobile: a
tray starts from a user action, has a fixed header with a title and one icon (close for the first step,
back within a sequence), holds one thing, keeps the screen behind it visible and dimmed, and each step in
a sequence has a different height. Sequences are one surface that resizes, never stacked cards. Trays are
used for the model picker, parameters, sign-in prompts, confirmations and the account menu; anything that
persists is a full screen. Built on the system sheet with custom detents on iOS and `ModalBottomSheet` on
Android, inset from the edges with the 28 pt sheet radius.

**The composer travels** from the centre of Home to the foot of the conversation as one object: a zoom
navigation transition with a matched source on iOS 18 and later, a shared-element transition in Compose.

**Tokens.** `packages/mobile-codegen/tokens.mjs` reads `packages/ui/src/styles/tokens.css` and
`packages/ui/src/lib/motion.ts` and writes `Tokens.generated.swift` and `Tokens.generated.kt`: both
themes' colours, radii, type sizes, durations, the curve and the layout spring. It resolves `var()` and
`color-mix(in oklch, …)`, converts oklch through OKLab to sRGB with gamut clipping, and keeps alpha. The
conversion is tested against known values. No value is retyped by hand, and the same check that guards
the API client fails CI when the output is stale. Instance theme overrides apply on top at run time.

**Type** (*Decision*, with a sample of each in the design sample):

| Option | For | Against |
|--------|-----|---------|
| A. System text (SF Pro, Roboto) with Geist Mono bundled for facts | Native feel, best Dynamic Type behaviour, smallest app | Loses Inter's `cv11` and `ss01` character |
| B. Inter and Geist Mono bundled | Identical voice to the web | About 1 MB; variable-font scaling needs care on both platforms |

Recommended: **A**. Mono is where the product's voice is most distinct, and "mono for facts" survives.

**Accessibility from the first slice.** Dynamic Type and Android font scaling up to the largest
accessibility sizes without clipping (layouts reflow, chips wrap); VoiceOver and TalkBack labels, traits
and a sensible order on every screen; 44 pt and 48 dp targets; both themes, following the system unless
the user chooses; Reduce Motion swaps movement for a 120 ms fade.

**Copy** matches the web's words and rules: real copy, no category labels.

## 8. Stack

First-party and boring.

| | iOS | Android |
|---|-----|---------|
| UI | SwiftUI | Jetpack Compose, Material 3 as the base, our tokens on top |
| State | `@Observable`, Swift concurrency | `ViewModel`, `StateFlow`, coroutines |
| Network | `URLSession` with the generated client | OkHttp with the generated client |
| JSON | `Codable` | kotlinx.serialization |
| Images | `AsyncImage` plus a small cache; SVG marks drawn natively | Coil (see below) |
| Storage | Keychain; `UserDefaults` for cached instance description | Keystore-backed DataStore |
| Tests | Swift Testing, XCUITest | JUnit, Compose UI tests |
| Minimum OS | **iOS 18.0** | **Android 10 (API 29)**, targeting the current API level Play requires |

- iOS 18 gives `@Observable`, zoom transitions and the current sheet APIs with no fallbacks, and covers
  the three newest versions (18, 26, 27).
- Android 10 covers well over 90% of active devices and has system dark theme and gesture navigation.

Third-party dependencies, each justified:

| Dependency | Platform | Why |
|------------|----------|-----|
| OkHttp | Android | The platform's de facto HTTP client; named in the brief. |
| kotlinx.serialization, kotlinx.coroutines | Android | JetBrains' own; the standard for Kotlin. |
| AndroidX (Compose, Navigation, Lifecycle, Browser, DataStore) | Android | Google's own. |
| Coil | Android | Compose has no image loader of its own; Coil is the one Google's documentation uses. |
| Thinking orbs (vendored in `apps/ios/Aquareum/Vendor/ThinkingOrbs`, MIT) | iOS | The agent's working indicator, the same drawing as the web's `thinking-orbs` package. Vendored from a pinned commit rather than SwiftPM: the package tracks a branch of a 284 MB repository. |
| Material icons (extended) | Android | The platform's own icon set as Compose vectors. Unused icons are stripped from release builds. |
| None | iOS | Everything is in the SDK. |

## 9. Slices

For each: iOS first, then Android from the same spec with the iOS build as a behavioural reference, not a
transliteration. Then run both, screenshot every screen in dark and light into
`docs/screenshots/mobile/`, review against the design brief, consult the advisor, commit.

| Slice | Screens | Server work |
|-------|---------|-------------|
| 0. Design sample (before review) | Home, one conversation | `get_instance`, the Home operations, guest access, tokens and client generation |
| 1. Shell and sign-in | Tabs, account tray, sign-in, signed-out states, "update required", "not offered on phones" | Device sessions, `surfaces.mobile`, `get_me`, devices |
| 2. Home and chat | Home, history, conversation, agent steps, shots, model picker, cast picker, attach from library | `delete_conversation`, `agent_model`, `character_slug`, ETags |
| 3. Studio | Video, image, audio composers, stage, variants | None expected |
| 4. Library | Grid, search, filters, item, delete, ask about it, open in studio | None expected |
| 5. Characters | Mine and public, detail, create, start chatting, report, block | Character operations, reports |
| 6. Settings | Profile, general, privacy, plan and balance, usage, devices, delete account | Account, preferences, account deletion |

**The design sample signs in with a demo key.** Sign-in isn't approved yet, and a conversation needs a
caller. In mock-only mode only, the mock's key check accepts one documented demo key, which debug builds
send. It is refused outside `MOCK_ONLY=1` and is removed from the apps in slice 1.

## 10. Planned, not built: Studio Live and character calls

Both wait on live sessions (R2). What they need natively:

- **Capture.** Camera and microphone through AVFoundation and CameraX, with usage strings in each
  platform's manifest; screen capture through ReplayKit's broadcast extension and MediaProjection, each a
  separate component with its own review considerations.
- **Transport.** Whatever the engine's sessions speak. If that is WebRTC, both platforms need a WebRTC
  library, which is the one large third-party dependency this plan foresees (Q15: which transport, and is
  there a recommended client?).
- **While live.** An audio session that survives the lock screen, a foreground service on Android,
  thermal and battery handling, interruption handling (a phone call arrives), and a visible on-air state
  the whole time.
- **Calls.** Echo cancellation and voice processing, speaker and Bluetooth routing, a proximity sensor
  for voice calls. CallKit and Android's Telecom integration are not needed for calls the user starts.
- **Billing by the second** makes "end" the most important control: one red button, and the session
  closes when the app is killed (the server needs a heartbeat timeout).

## 11. Purchasing (*Decision*; nothing is built until then)

The apps show balance, plan and usage. Credits and plans are digital goods, so the stores have rules.
All *verify* at decision time.

| Option | What it is | Cost and risk |
|--------|------------|---------------|
| A. Show only | No buying and no pointer to buying in the apps. People top up on the web. | No fee. Review risk on iOS: an app whose paid features can't be bought in it may be asked to add in-app purchase. |
| B. In-app purchase and Play Billing | Credit packs as consumables, plans as subscriptions, through StoreKit 2 and Play Billing. The instance verifies each purchase with the store and tops up the allocation. | 15–30% to the store. Prices follow store tiers. Each publisher creates their own products. Needs a way for the provider to record a top-up paid elsewhere (Q16). |
| C. Link out | A link from the app to the instance's web Plan page. | Allowed only in some regions and programmes (the United States and the EU on iOS, with conditions; Google's user-choice and external-offers programmes). Rules have changed several times since 2025. |

Recommended: ship **A** for TestFlight and internal testing, and decide between B and C before the first
public store release, per store. Each publisher makes this choice for their own app; the flagship's
choice is the default in the template.

## 12. Characters and adult content (*verify* each rule at submission)

**What the stores require.**

- **Age rating.** Both stores ask a questionnaire and assign the rating; the answers must match what the
  app can show. User-created characters and generated media push the rating up.
- **User-generated content.** Apple (guideline 1.2) and Google (the UGC policy) both require: terms the
  user accepts, a way to **report** content, a way to **block** an abusive user or their content, action
  on reports within a stated time, and published contact details. Google's policy on generated content
  also requires in-app reporting of offensive generated results.
- **Mature content.** Neither store accepts an app whose purpose is pornographic material. Apple allows
  incidental mature content in a user-generated-content app only if it is hidden by default and the user
  turns it on **on the website**, not in the app.
- **Account deletion.** Apple requires that an app which supports account creation lets the user delete
  their account from inside the app.

**How the apps follow the instance's settings within those rules.**

- Characters appear only when `content.characters` is on, as on the web.
- Adult content on mobile needs all three: the instance allows it (`content.adultContent`), the instance
  allows it **on mobile** (new `content.mobileAdultContent`, default `false`), and the user has confirmed
  their age and switched it on **on the web**. The apps show the state of that setting and where to change
  it; they never offer the switch. An operator who turns the mobile flag on is declaring it in their store
  rating; the documentation says so.
- Public characters marked mature are filtered on the server for mobile callers unless all three hold, so
  an app never receives what it must not show. *Built in slice 5 as the strict case:* `list_characters` and
  `get_character` never return a character for adults only, and `create_character` never makes one. The
  `content.mobileAdultContent` flag isn't built; it relaxes this when it is.
- Every public character has **Report** (a reason, sent to the operator) and **Block** (hides that
  character and its author for this user). *Built in slice 5:* `report_character`, `block_character`, a
  store in `apps/web/lib/moderation`, and the console's Reports page, where an operator keeps a character up
  or takes it down for everyone.
- Settings has **Delete account**, behind a confirmation tray, calling `delete_account`.

## 13. Self-hosters: `./aquareum mobile` (designed now, built after the apps work)

Mobile is opt-in and never part of `./aquareum setup`. An operator who wants apps builds and publishes
their own, under their own developer accounts. The flagship app is produced by this same path.

```
./aquareum mobile init [--platform ios|android|all] [--json]
./aquareum mobile doctor [--json]
```

`init` reads `instance.config.json` and writes each platform's build config and nothing else:

| Build-time value | From | Written to |
|------------------|------|------------|
| App name | `name` | `Instance.xcconfig`, `instance.properties` |
| Instance URL | `domain` | same |
| Bundle identifier, application id | new `mobile.ios.bundleId`, `mobile.android.applicationId` | same |
| Icon | new `mobile.icon` (a 1024 px image), else the logo symbol on the panel colour | the asset catalogue, adaptive icon resources |

Everything else (theme, sign-in methods, enabled features, content settings) comes from `get_instance` at
run time, so an operator changes it without resubmitting to the stores.

`doctor` checks: `surfaces.mobile` is on, the domain serves `get_instance` over https, the identifiers are
set, Sign in with Apple is offered when rule 4.8 requires it, push credentials are present if
notifications are on, and the toolchain is installed.

CI templates in `deploy/templates/`: one workflow per platform that runs `mobile init`, builds, signs and
uploads to TestFlight and to Play's internal track, with signing material from the publisher's own
secrets. The repository's own release uses the same templates.

Documented in `deploy/README.md` and `AGENTS.md`: a publisher needs an Apple Developer account and a Mac
(or a macOS runner) for iOS, a Play Console account, signing keys, push credentials if they want
notifications, their own purchasing and content choices, and time for store review.

## 14. Tests, CI and docs

- **Tests.** Model decoding against the captured fixtures; the sign-in flow against the mock provider
  (code exchange, storage, 401 handling, sign-out); UI tests of the main flows on both platforms against a
  local mock-only instance (the Android emulator reaches the host at `10.0.2.2`).
- **No mock layer in the apps.** Development, tests and CI use a build pointed at an instance started
  with `MOCK_ONLY=1`.
- **CI.** Two new jobs, `ios` (macOS runner) and `android` (Linux runner), each started only when its
  paths, `packages/mobile-codegen` or `docs/mobile/openapi.json` change. Each starts a mock-only instance,
  builds and runs its tests. The existing `check` and `install` jobs are unchanged, apart from the
  generated-code check added to `check`. The new jobs are not required status checks until they are
  stable.
- **Docs.** `CLAUDE.md` (mobile rules), `README.md` (folders, how to run each app, mobile is opt-in),
  `AGENTS.md` (non-interactive build and test commands), `docs/ui-actions.md` and `docs/data-sources.md`
  with a mobile column, `docs/design-proposals.md` with each mobile decision.

## 15. Needed from the project owner (none of it blocks the slices)

- Android Studio, the SDK and an emulator installed, with disk space freed (section 2).
- An Apple Developer Program team and a Play Console account, when signing and distribution start.
- Bundle identifiers for the flagship (proposed `org.livepeer.app`; *verify* who owns the name).
- An app icon for the flagship, or approval to derive one from the symbol.
- Push credentials (an APNs key, a Firebase project), when notifications are built.

## 16. Open questions

For the project owner:

Decided with the approval of the design sample (the recommended option in each case):

1. **Generator**: our own (4.3). Built.
2. **`surfaces.mobile` in the `full` preset**: off (4.5). Built.
3. **Device session store**: a file store now (5). Built.
4. **Callback**: custom scheme with PKCE for the first release (5). Built; universal links are the follow-up.
5. **Type**: system text with Geist Mono (7).
6. **Minimum OS**: iOS 18 and Android 10 (8).
9. **Operator role on phones**: device sessions are always `user`. Built.

Still open:

7. **Purchasing**: A for testing, then B or C per store? (11)
8. **Adult content on mobile**: the three-part rule in section 12?

For the engine and provider (added to `docs/engine-requests.md`):

- Q12: Do the provider's wallet and Coinbase sign-in flows complete inside a system browser session on a
  phone?
- Q13: Can the provider notify the instance when a user is disabled or deleted?
- Q14: Can the provider delete a user and their data on request, for in-app account deletion?
- Q15: Which transport will live sessions use, and is there a recommended native client?
- Q16: Can the provider record a top-up or a plan paid through Apple or Google?

## 17. What exists today

### Polish pass (20 November 2026)

- **The live aurora.** Home's night sky is now the web's shader on both phones: `Aurora.metal` as a SwiftUI
  layer effect on iOS, AGSL through `RenderEffect` on Android 13 and later. The photo's own glow is taken
  out, stars twinkle, and curtains are drawn over it; on the light theme the same aurora tints a pale sky
  under a 15% veil. It holds still with Reduce Motion or Remove animations, and in Low Power Mode or
  Battery Saver, and pauses when the app isn't in front. Sixteen ray steps instead of the web's 24, and
  Android draws it at half resolution, as the web caps its pixel ratio. The iOS backdrop is now as tall as
  the web's (86% of the screen, up to 820 pt). Not measured on real devices: the emulator is too slow to
  judge either way. Screenshots: `docs/screenshots/mobile/{ios,android}-home-aurora-{dark,light}.jpg`.
- **Screen readers.** Every tappable element on Android's main screens has a name (checked from the
  accessibility tree of each screen, signed out and in); every icon-only button on iOS has a label.
- **Largest text.** Android at font scale 2.0: tab labels shrink to one line instead of breaking mid-word,
  tile titles keep to one line so they never run into the length badge, a character's rating and the
  Home gallery's hint move to their own line, and Settings rows and the account tray put their numbers under
  the name. iOS at the largest accessibility size scales and scrolls as it should.

- **The agent's orb.** From libraries.dev, only thinking orbs met the brief (monochrome ink, motion only
  while something is happening, a still frame for reduced motion); border beam, metal, gooey, the image
  loader and bot avatars didn't, and the voice pieces wait for character calls. While the agent works, the
  orb replaces the instance's mark beside the step and shows the kind of work (`agentOrbState`: planning
  solves, watching searches, making media composes, writing a prompt weaves); when it's done the mark comes
  back. Web: `thinking-orbs` 0.3.2 from npm (7 KB gzipped, no dependencies, no install scripts). iOS: the
  SwiftUI port vendored at commit `14ae9d2`. Android has no Compose version yet, so it keeps the mark and the
  breathing step title. Screenshot: `docs/screenshots/mobile/ios-chat-orb-dark.jpg`.

Not done in the polish pass: a Compose port of the orb, a real-device performance check of the aurora, and an automated accessibility
audit in a UI test target (`performAccessibilityAudit`), which the project doesn't have yet.

### Slice 6: Settings (20 November 2026)

- **Server.** `get_account` (its type renamed `PlanAndCredits`, so it can't be confused with who is signed
  in), `get_preferences`, `update_preferences` (adult content and the age confirmation are refused from a
  device session with `web_only`), `get_privacy` (the web's privacy tiers, now shared through
  `@aquareum/user-app/privacy`), and `delete_account`: the provider deletes the user
  (`identity.deleteUser`, new; Batteries answers 501, Q14), every device session ends, and the person's
  blocks are forgotten while their reports stay, unattributed. Left out of MCP.
- **Web.** Settings ▸ Devices lists the phones and tablets signed in and signs any out; Settings ▸ Profile
  has Delete account, confirmed in a sheet.
- **Both apps.** Settings opens from the account tray: who you are, then Plan and credits (balance and plan,
  nothing to buy), Usage (totals, by capability, recent jobs), Preferences (shape, length, saving
  conversations, asking before spending; adult content shown as On or Off with where to change it, never
  switched), Devices (sign out any other phone), Privacy, and Delete account. iOS 22 tests, Android 27 unit
  tests.
- **Run on both** against a mock-only instance: every page in dark and light; a preference changed and read
  back from the API; another device signed out; the account deleted on each, which signed every device out
  with "Your account was deleted." Screenshots:
  `docs/screenshots/mobile/{ios,android}-settings{,-plan,-usage,-preferences,-devices,-privacy,-delete}-{dark,light}.jpg`.
- **Found while running it.** On iOS the switches were white on white in the dark theme: they took the
  foreground colour as their tint. On Android the delete dialog closed when the activity was recreated.

Not done in slice 6, and why:

- **Buying credits or a plan.** Option A of section 11 until the store decision is made: the apps show the
  balance and plan and say nothing about buying.
- **Notifications when a render finishes,** and **Enter sends**: the first needs push, which isn't built; the
  second is a keyboard setting for the web.
- **The preferred shape and length don't yet set the composer's starting values** on any surface; they are
  saved to the account for when they do.

### Slice 5: Characters (20 November 2026)

- **Server.** `get_character`; `list_characters` and `get_character` open to guests (shared characters only);
  `create_character` (private unless shared, never for adults only); `report_character` and
  `block_character`, kept in `DATA_DIR/moderation.json` by `apps/web/lib/moderation` behind a `StateStore`
  that device sessions now share (`apps/web/lib/data`). Everything that reads characters, on the API and on
  the web, leaves out what the operator took down and what the person blocked. The console has a Reports
  page: open reports first, then decided ones, with Keep it up and Take it down (confirmed).
- **Both apps.** The Characters tab: yours (or the way to make your first), then shared by others, with
  search; guests see the shared ones. A character's page: portrait, who they are, how they open, and Cast
  them in a scene, which puts them in Home's composer. Someone else's character has Report (a reason and a
  note, in a tray) and Block (confirmed; it and everything by its author leave at once). New character is a
  form: name, one line, who they are, how they open, and Share with everyone here. iOS 20 tests, Android 25
  unit tests.
- **Run on both** against a mock-only instance: browsed, searched, reported Mara, blocked her, created Wren,
  cast Wren in a scene; the report showed in the console and taking Mara down removed her for guests too.
  Screenshots:
  `docs/screenshots/mobile/{ios,android}-{characters,characters-yours,character,character-report,character-block,character-new}-{dark,light}.jpg`.
- **Web.** A character's page has the same Report and Block, in a ⋯ menu beside the name, in sheets; a guest
  is sent to sign in first.
- **Found while running it.** Android couldn't send a POST with no inputs: OkHttp refuses a bodiless POST,
  so Block never left the phone. The transport now sends an empty object. On the web, a new server action
  isn't registered until the dev server restarts.

Not done in slice 5, and why:

- **Talking to a character.** The web's Start chatting sends the message as an ordinary request: the
  conversation API has no way to answer in character, and `character_slug` means "put them on screen". The
  apps lead with Cast in a scene and leave talking out until conversations can answer in character (calls,
  section 10, are the other half of it).
- **Editing or deleting a character,** and a portrait for a new one: the API client has neither yet.

### Slice 4: Library (20 November 2026)

- **Both apps.** The Library tab searches by what is on screen (`search_library` with `query` and `kind`),
  with a search field that is always visible, All, Video, Image and Audio chips, and a two-column masonry
  grid with each item's type and length. An item opens a tray: the still, what's in it, its tags, Open in the
  studio, Ask about it (a conversation with the item attached, asking for a summary and the key moments), and
  Delete, confirmed. Loading, failure, empty and no-match states. iOS 17 tests, Android 21 unit tests.
- **Run on both** against a mock-only instance: searched, filtered, opened an item, asked about it (the
  conversation came back with its moments), opened it in the studio, deleted it with confirmation. Screenshots:
  `docs/screenshots/mobile/{ios,android}-library{,-search,-item,-no-match}-{dark,light}.jpg`.
- **Found while running it.** Opening the studio with words before it had loaded left the draft with no
  mode or length ("0s"), on both apps, from slice 3. A draft made before the studio loads now gets the
  medium's defaults when it loads, keeping the words.

Not done in slice 4, and why:

- **Convert or export** opens the Developers pages, which stay on the web.
- **Adding to the library from the phone** (camera roll, files) needs uploads (`uploadMedia`), as the
  studio's References and Edit do.

### Slice 3: Studio (20 November 2026)

- **Server.** `list_studio_mediums`, the web's studio (`describeStudio` in `mediums.ts`) resolved against
  the network, with a words-only placeholder for clients that can't add inputs and a `needs_input` flag;
  `quote_generation`, the web studio's quote. The web's empty-stage copy no longer says "on the left".
- **Both apps.** A Studio tab with Video, Image and Audio, a draft for each, the settings each medium and
  mode have, Generate with its cost, a guest asked to sign in, up to four variants rendering in place and
  followed with backoff, "Use these words again" on a result, and "Open in the studio" from a finished shot
  or a found moment. iOS 16 tests, Android 18 unit tests.
- **Run on both** against a mock-only instance: a video and four images generated and finished; Audio's two
  modes; opened from a conversation. Screenshots:
  `docs/screenshots/mobile/{ios,android}-studio-{video,image,audio}-{dark,light}.jpg`,
  `ios-studio-rendering-*.jpg`, `android-studio-rendering-*.jpg`.
- **Found while running it.** Android read every reply on the main thread after the request returned; a
  reply still arriving (four images at once) threw, and Generate said it hadn't started. Replies are now read
  on the IO dispatcher. This was very likely slice 2's unreproduced "library didn't load" too. On iOS the
  prompt box needed the same tap-anywhere fix as the composer.

Not done in slice 3, and why:

- **References, Edit and first and last frames** need uploads, which the API client doesn't have yet
  (`uploadMedia`).
- **The live aurora** stays a still photograph. It's a design port (Metal and AGSL) with no flow behind it;
  it moves to a polish pass after the slices rather than holding up Library.

### Slice 2: Home and chat (20 November 2026)

- **Server.** `delete_conversation`; `list_agent_model_menu`, the agent's model menu named by the web's own
  rules; `list_capability_labels` names the agent's models too, so a step the agent planned reads "Gemma 3
  27B" and not the app's path; `send_message` takes the shot's capability, shape and length; every read
  answers with an `ETag` and 304 while nothing changed.
- **Both apps.** The composer's + menu (attach from the library, put a character in it, the agent's model),
  chips for what is chosen, the attach and cast trays, the model and cast carrying on through a
  conversation, "With Mara" on sent messages, History with search and swipe to delete, conversations opened
  by id, and ETags in the transport (checked in the server log: repeat reads come back 304). iOS 14 tests,
  Android 15 unit tests.
- **Run on both** against a mock-only instance: cast Mara and send (the agent casts her, the shot renders,
  she stays cast); attach a library video and send with no words (a summary and its moments come back);
  delete from History; open an older conversation. Screenshots:
  `docs/screenshots/mobile/{ios,android}-{home-cast,cast,attach,chat-cast,history}-{dark,light}.jpg`,
  `ios-chat-attached-*.jpg`, `android-menu-*.jpg`.
- **Found while running it.** On iOS a tap on the second line of a wrapped placeholder missed the field
  (now the whole field focuses it); the swipe-to-delete action took the app's tint instead of red; an
  agent step named the chosen model by its app path.

Not done in slice 2, and why:

- **Opening a shot or a found moment in the studio** waits for the studio (slice 3).
- **The live aurora** on Home (a Metal and AGSL port of the web's shader) is still a still photograph.
  It's design work of its own and doesn't block any flow (see slice 3).
- **Server-sent events** wait for the engine's events feed (R2), as planned.
- **Not reproduced at the time:** once on Android the attach tray said the library didn't load, while the
  server had answered 200. Found and fixed in slice 3 (replies read on the main thread).

### Slice 1: shell and sign-in (20 November 2026)

- **Server.** Device sessions (`apps/web/lib/devices`): the native branch of `/auth/start` and
  `/auth/callback`, the one-time code, `create_device_session`, `end_device_session`, `get_me`,
  `list_devices`, `revoke_device`, and `authenticate()` accepting `aqd_` tokens. `surfaces.mobile` and the
  `mobile` block in the schema, presets, `get_instance`, the console's Phone apps switch and the proxy (the
  API and the sign-in flow are served to the apps even with the API surface off). A stable `code` on API
  errors (`signed_out`, `mobile_off`, `account_required`, `sign_in_expired`). Suspending a user ends their
  device sessions. `DATA_DIR`, the `app-data` volume, and `docs/mobile/dev.instance.config.json`, a mock-only
  config with the apps switched on. The demo key is gone from both apps.
- **iOS.** `ASWebAuthenticationSession` with PKCE, the token in the Keychain (this device only, after first
  unlock), 401 returning to signed out with "You've been signed out.", `mobile_off` and old builds handled by
  the availability gate. Tabs (Home, Library, Characters), the account button and tray, the sign-in tray,
  signed-out and empty states, and simple Library and Characters lists. 11 tests pass.
- **Android.** The same, with an Auth Tab (falling back to a Custom Tab and the app's own scheme), the token
  encrypted with an Android Keystore key, Material navigation bar and bottom sheets. 12 unit tests pass.
- **Run on both** against a mock-only instance: guest → sign in → send → the conversation opens; sign out
  ends the session on the server; a session revoked from another device returns the app to signed out;
  switching the apps off shows "Not on phones right now". Screenshots in dark and light:
  `docs/screenshots/mobile/{ios,android}-{home-guest,home-signed-in,sign-in,account,account-guest,library,library-guest,characters,not-offered}-{dark,light}.jpg`.
- **Checked at the largest text size on iOS**: Home's headline now scales, and trays scroll when taller than
  the screen. Android follows the font scale through `sp` sizes; not yet checked at 200%.
- **Found while running it.** The sign-in callback was built from the server's idea of its own address, so
  the Android emulator (which reaches the host at `10.0.2.2`) was sent to `localhost`. Sign-in addresses now
  come from the configured domain, or the address the request came in on.

Not done in slice 1, and why:

- **Settings ▸ Devices screens** on mobile and web: the API exists; the screens are slice 6 with the rest of
  settings.
- **Universal Links and App Links**: the custom scheme ships first, as decided.
- **A screen reader pass** on both platforms, and Android at the largest font scale: labels and traits are
  set, but neither has been walked through end to end.

### The design sample

Built and run on 19 November 2026 against a mock-only instance:

- **Server.** `get_instance`, the Home reads and `list_capability_labels`, open to guests; `agent_model`
  and `character_slug` on conversations; each operation's `output`; `docs/mobile/openapi.json`; the
  mock-only demo key.
- **Generation.** `packages/mobile-codegen` writes Swift and Kotlin design tokens (35 colours in both
  themes, radii, type sizes, motion) from `tokens.css` and `motion.ts`, and the Swift and Kotlin models and
  clients (53 types, 22 operations each) from the OpenAPI document. CI fails when they are stale.
- **iOS.** Home and a conversation, in dark and light, with Dynamic Type, VoiceOver labels and Reduce
  Motion: `docs/screenshots/mobile/ios-*.jpg`. Eight tests pass, decoding the captured responses in
  `docs/mobile/fixtures/`.
- **Android.** The same two screens in Compose, run on the API 37 emulator in dark and light:
  `docs/screenshots/mobile/android-*.jpg`. Nine unit tests pass against the same fixtures. Two things
  running it turned up: from Android 17 an app needs `ACCESS_LOCAL_NETWORK` to reach a private address such
  as the emulator's host, so debug builds declare it (release builds don't); and the instance now builds
  its absolute URLs from the address the client used, not its own idea of its origin.

Not done, and why:

- **Not yet checked on either platform:** the largest font sizes, a screen reader pass, animations
  switched off, and the composer's shared transition on Android beyond seeing it run. Slice 1 starts with
  those checks.
- **Android has no backdrop blur.** Compose can't blur what is behind a control on every supported
  version, so glass there is a more opaque fill with the same edge.
- **Type option B (Inter bundled): no sample.** Inter isn't in the repository as a font file the app can
  bundle (the web loads it as WOFF2). It needs a download of Inter's own TTF, which needs a yes. The
  sample shows option A: system text with Geist Mono for facts.
- **The live aurora** on Home is a WebGL shader on the web. The sample shows the instance's still
  photograph on the dark theme and a plain page on the light theme; a Metal and AGSL port is slice 2 work.
- **A logo in more than one colour** (`logo.tint: false`) can't be drawn from path data alone, and iOS has
  no SVG image decoder. Proposed: the instance serves a PNG rendition of each mark for clients that ask.
  Until then such an instance shows its name in type on mobile.
- **Tabs, the account tray, sign-in and trays** are slice 1, after the sign-in proposal is approved.
