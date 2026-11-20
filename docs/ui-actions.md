# UI actions and their API functions

Every action a user can take maps to an API client function. Client-only actions (changing a draft, opening
a popover, switching theme) change local state and are not listed.

The **Mobile** column says where the native apps stand on each action (`docs/mobile/plan.md`). The apps reach
every function through the instance's `/api/v1`, so an action is only possible on mobile once its operation is
in `apps/web/lib/public-api/operations.ts`.

| Screen | Action | API function | Mobile |
|--------|--------|--------------|--------|
| Home | Load capability list for the picker | `listOfferings` | Not on mobile: the agent picks; casting reads `list_capability_labels` to know image to video is on offer |
| Home | Load starting points | `listPromptStarters` | Built (iOS sample) |
| Home | Load example gallery | `listShowcase` | Built (iOS sample) |
| Home | Send a request | `createConversation` | Built (iOS sample) |
| Shell | List recent conversations (open sidebar) | `listConversations` | Built (slice 2): History, from Home, with search by title |
| Chat | Open a conversation | `getConversation` | Built (iOS sample); from History by its id in slice 2 |
| Chat | Send a follow-up | `sendMessage` | Built (iOS sample) |
| Chat | Follow the agent's steps | `getConversation` | Built (iOS sample) |
| Chat | Follow a shot rendering | `getGeneration` | Built (iOS sample) |
| Chat | Open a shot in the studio | Navigation with the shot's prompt; `getGeneration` in the studio from slice (c). | Slice 3, with the studio |
| Sign-in | Choose a method (Google, Apple, Discord, wallet, email, passkey), sign out | Auth provider (`authorizationUrl` with the method, `exchange`); see `apps/web/lib/auth`. On mobile: the same flow in the system auth session, then `create_device_session`; sign out is `end_device_session`. Wallet and Coinbase aren't offered on phones yet (engine question Q12). | Built (slice 1) |
| Shell (mobile) | Open the account tray: name, email, credits | `get_me` (session identity and `getCreditBalance`) | Built (slice 1) |
| Shell (mobile) | Choose the theme (system, dark, light) | Kept on the device; no API function | Built (slice 1) |
| History (mobile) | Delete a conversation (swipe, then confirm) | `deleteConversation` (`delete_conversation`) | Built (slice 2) |
| Settings · Devices | List signed-in phones and tablets, sign one out | `list_devices`, `revoke_device` (device sessions, `apps/web/lib/devices`) | API built in slice 1; screens in slice 6 |
| Shell | Show credit balance | `getCreditBalance` | Built (slice 1): the account tray, through `get_me` |
| Studio (video, image, audio) | Load capabilities for the medium and mode | `listOfferings` | Slice 3 |
| Studio | Generate (once per variant) | `createGeneration` | Slice 3 |
| Studio | Follow a render | `getGeneration` | Slice 3 |
| Studio | Improve prompt, attach frames/references, download, open in chat | Not wired in the sample; `enhancePrompt`, `uploadMedia`, `getMediaUrl`, `createConversation` in slices (b)–(c). | Slice 3 |
| Library | List, search by content, filter by type | `listMedia` | List built (slice 1); search and filters slice 4 |
| Library | Delete | `deleteMedia` | Slice 4 |
| Library | Open in studio | Navigation with the item's prompt | Slice 4 |
| Library | Ask about it | `createConversation` | Slice 4 |
| Library | Convert or export | Opens the capability's run screen → `runCapability` | Slice 4 |
| Characters | List mine and shared | `listCharacters` | List built (slice 1); the rest slice 5 |
| Characters | Open one | `getCharacter` | Slice 5 |
| Characters | Create | `createCharacter` | Slice 5 |
| Characters | Start chatting | `createConversation` | Slice 5 |
| Developers | List capabilities | `listOfferings` | Not on mobile |
| Developers | Run a capability | `runCapability` | Not on mobile |
| Developers | List, create, revoke keys | `listApiKeys`, `createApiKey`, `revokeApiKey` | Not on mobile |
| Settings | Change a preference, confirm age, switch adult content | `updatePreferences` | Slice 6 |
| Settings | See plan, packs and balance | `getAccount`, `getCreditBalance` | Slice 6 |
| Settings | Add credits (a pack) | `buyCreditPack` | Not yet: purchasing is undecided |
| Settings | Add credits (an amount of their own, within the operator's limits) | `buyCredits` | Not yet: purchasing is undecided |
| Settings | Choose, switch or cancel a plan | `changePlan` | Not yet: purchasing is undecided |
| Settings | See usage | `getUsage` | Slice 6 |
| Settings | Sign out | `POST /auth/sign-out` | Slice 6 |
| Chat, Home | Attach a video from the library | `listMedia`, then `createConversation` / `sendMessage` with `attachment_ids` | Built (slice 2) |
| Chat, Home | Pick the model that runs the agent | `listAgentModels`, then `createConversation` / `sendMessage` with `agent_model` | Built (slice 2): `list_agent_model_menu`, the same rows as the web |
| Chat, Home | Put a character in a video (cast picker in the composer) | `listCharacters` (own, then public; mature only if shown), then `createConversation` / `sendMessage` with `character_slug` | Built (slice 2); mature characters aren't listed on phones (section 12 of the plan) |
| Characters | Make a video with this character (opens Home with `?with=<slug>`) | `getCharacter`, then `createConversation` with `character_slug` | Slice 5 |
| Chat | Summarise, find moments, ask about a video | `sendMessage` (the agent calls a video understanding capability) | Built (slice 2) |
| Chat | Open a found moment in the studio | Navigation with the moment as the prompt | Slice 3, with the studio |
| Studio Live | Load looks and destinations | `listLiveLooks`, `listLiveDestinations` | Planned, after live sessions |
| Studio Live | Save a look | `saveLiveLook` | Planned, after live sessions |
| Studio Live | Add or remove a destination | `addLiveDestination`, `removeLiveDestination` | Planned, after live sessions |
| Studio Live | Go live, with recording on or off | `startLiveSession` | Planned, after live sessions |
| Studio Live | Change the look or prompt on air | `updateLiveSession` | Planned, after live sessions |
| Studio Live | Watch stream health | `getLiveHealth` | Planned, after live sessions |
| Studio Live | End the stream | `stopLiveSession` (a recorded session is saved to the library) | Planned, after live sessions |
| Characters | Call, end call | `startCall`, `endCall` | Planned, after live sessions |
| Developers | Run a video analysis in the playground | `analyseVideo` | Not on mobile |
| Developers | Open and close a session in the playground | `startLiveSession`, `stopLiveSession` | Not on mobile |
| Developers | Browse example apps | `listExampleApps` | Not on mobile |
| Operator · Overview | See users, jobs, revenue, cost, margin, engine status | `getOverview`, `getEngineHealth`, `listJobs` | Not on mobile |
| Operator · Users | List users with email, budget, spent, remaining, plan | `provider.identity.listUsers`, `listActors`, `provider.budgets.getAllocation`, `provider.plans.getUserPlan` | Not on mobile |
| Operator · User | Suspend or resume | `setActorStatus` | Not on mobile |
| Operator · User | Change role | `provider.identity.setUserRole` | Not on mobile |
| Operator · User | Assign or remove a plan | `provider.plans.assignPlan` | Not on mobile |
| Operator · User | Add credit (manual adjustment) | `provider.budgets.topUpAllocation` | Not on mobile |
| Operator · User | See keys and usage | `listAccessKeys`, `provider.usage.listUsage` | Not on mobile |
| Operator · Pricing | See provider and features, plans, packs, markup | `provider.features`, `provider.plans.listPlans`, `provider.plans.listCreditPacks` | Not on mobile |
| Operator · Pricing | Create or edit a plan | `provider.plans.createPlan`, `provider.plans.updatePlan` | Not on mobile |
| Operator · Pricing | Add a credit pack; change its credits or price, highlight it, stop offering it | `provider.plans.createCreditPack`, `provider.plans.updateCreditPack` | Not on mobile |
| Operator · Pricing | Allow other amounts; set the minimum and maximum | `provider.plans.getTopUpRange`, `provider.plans.updateTopUpRange` | Not on mobile |
| Operator · Billing | Connect a processor, tax setting | `getBillingSettings`, `updateBillingSettings` | Not on mobile |
| Operator · Billing | See payments, invoices, failed payments; refund | `listPayments`, `refundPayment` | Not on mobile |
| Operator · Costs | Retail against wholesale per capability, pending | `getCostSummary` | Not on mobile |
| Operator · Jobs | List, filter, inspect attempts and failures | `listJobs` | Not on mobile |
| Operator · Jobs | Retry | `retryJob` | Not on mobile |
| Operator · Capabilities | See discovery; enable, set markup, override surfaces | `listOfferings`, `getCapabilitySetting`, `updateCapabilitySetting` | Not on mobile |
| Operator · Compute | See operators that served jobs; allow or block | `listComputeOperators`, `setComputeOperatorBlocked` | Not on mobile |
| Operator · Grants | List, create, add funding | `provider.budgets.listGrants`, `createGrant`, `fundGrant` | Not on mobile |
| Operator · Settings | Name, domain, logo and symbol (upload, replace, remove; previewed in both themes; checked and cleaned on save by `lib/operator/logo.ts`), colours, sign-up, privacy, surfaces (app, API, MCP, phone apps, reviewed before any is switched off; the console is shown on and disabled), content policy | Writes the instance config (`@aquareum/config` `validateConfig`) | Not on mobile |
| Operator · Keys | List, issue, revoke | `listAccessKeys`, `issueAccessKey`, `revokeAccessKey` | Not on mobile |
| Operator · System | Health, versions, doctor, data sources | `getEngineHealth`, doctor checks | Not on mobile |
| Shell (mobile) | Learn the instance's name, marks, theme, surfaces, sign-in methods and content settings | `get_instance` (the instance config; no engine call) | Built (iOS sample) |
| Chat (mobile) | Name the capability behind each of the agent's steps | `list_capability_labels` (`listOfferings`, runner models, `capability-menu.ts`) | Built (iOS sample) |
