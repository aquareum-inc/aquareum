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
| `get_account` | `GET /account` | `getAccount` | | 6 |
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
  "sign_in": { "methods": ["apple", "google", "email", "passkey"], "sign_up": "open" },
  "content": { "characters": true, "adult_content": false },
  "home": { "background_image": "https://…", "background_video": null, "aurora": true },
  "minimum_app_version": { "ios": "1.0.0", "android": "1.0.0" }
}
```

- Theme overrides are any CSS colour in the config. The instance resolves them to sRGB hex before
  sending, with the same conversion code the token generator uses, so the apps never parse CSS.
- URLs are absolute. Logos are sent as the config has them; the apps render SVG and raster marks and apply
  the tint.
- The apps fetch it at launch, cache it, and re-fetch on foreground. A cached copy shows at once, so the
  theme never flashes.
- `minimum_app_version` lets an instance ask an old build to update after a breaking API change.

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

**Proposed for the first release: polling with backoff, on the existing operations.** While a turn or a
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
  an app never receives what it must not show.
- Every public character has **Report** (a reason, sent to the operator) and **Block** (hides that
  character and its author for this user). Reports need an operator queue in the console and a store,
  which is new work on the web side in slice 5.
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

1. **Generator**: our own (recommended) or the two standard tools? (4.3)
2. **`surfaces.mobile` in the `full` preset**: off (recommended) or on? (4.5)
3. **Device session store**: a file store now (recommended), or the database foundation first? (5)
4. **Callback**: custom scheme with PKCE for the first release (recommended), or universal links now? (5)
5. **Type**: system text with Geist Mono (recommended), or bundle Inter as well? (7)
6. **Minimum OS**: iOS 18 and Android 10? (8)
7. **Purchasing**: A for testing, then B or C per store? (11)
8. **Adult content on mobile**: the three-part rule in section 12?
9. **Operator role on phones**: device sessions are always `user` (recommended)?

For the engine and provider (added to `docs/engine-requests.md`):

- Q12: Do the provider's wallet and Coinbase sign-in flows complete inside a system browser session on a
  phone?
- Q13: Can the provider notify the instance when a user is disabled or deleted?
- Q14: Can the provider delete a user and their data on request, for in-app account deletion?
- Q15: Which transport will live sessions use, and is there a recommended native client?
- Q16: Can the provider record a top-up or a plan paid through Apple or Google?

## 17. What exists today (the design sample)

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

Not done, and why:

- **Android sample: written and compiled, not yet run.** Android Studio's SDK (platform 37.0) and an
  emulator were installed on 19 November. `apps/android` builds (`./gradlew :app:assembleDebug`) and its 9
  unit tests pass, decoding the same fixtures as iOS. The emulator has not started: it needs about 7.4 GB
  of free disk even with a 2 GB data partition, and the Mac has 6.2 GB. So Home and the conversation on
  Android have not been seen running, and there are no Android screenshots yet. Nothing about how it looks
  or behaves is claimed until it has run.
- **Type option B (Inter bundled): no sample.** Inter isn't in the repository as a font file the app can
  bundle (the web loads it as WOFF2). It needs a download of Inter's own TTF, which needs a yes. The
  sample shows option A: system text with Geist Mono for facts.
- **The live aurora** on Home is a WebGL shader on the web. The sample shows the instance's still
  photograph on the dark theme and a plain page on the light theme; a Metal and AGSL port is slice 2 work.
- **A logo in more than one colour** (`logo.tint: false`) can't be drawn from path data alone, and iOS has
  no SVG image decoder. Proposed: the instance serves a PNG rendition of each mark for clients that ask.
  Until then such an instance shows its name in type on mobile.
- **Tabs, the account tray, sign-in and trays** are slice 1, after the sign-in proposal is approved.
