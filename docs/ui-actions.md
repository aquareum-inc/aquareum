# UI actions and their API functions

Every action a user can take maps to an API client function. Client-only actions (changing a draft, opening
a popover, switching theme) change local state and are not listed.

| Screen | Action | API function |
|--------|--------|--------------|
| Home | Load capability list for the picker | `listOfferings` |
| Home | Load starting points | `listPromptStarters` |
| Home | Load example gallery | `listShowcase` |
| Home | Send a request | `createConversation` |
| Shell | List recent conversations (open sidebar) | `listConversations` |
| Chat | Open a conversation | `getConversation` |
| Chat | Send a follow-up | `sendMessage` |
| Chat | Follow the agent's steps | `getConversation` |
| Chat | Follow a shot rendering | `getGeneration` |
| Chat | Open a shot in the studio | Navigation with the shot's prompt; `getGeneration` in the studio from slice (c). |
| Sign-in | Choose a method (Google, Apple, Discord, wallet, email, passkey), sign out | Auth provider (`authorizationUrl` with the method, `exchange`); see `apps/web/lib/auth`. |
| Shell | Show credit balance | `getCreditBalance` |
| Studio (video, image, audio) | Load capabilities for the medium and mode | `listOfferings` |
| Studio | Generate (once per variant) | `createGeneration` |
| Studio | Follow a render | `getGeneration` |
| Studio | Improve prompt, attach frames/references, download, open in chat | Not wired in the sample; `enhancePrompt`, `uploadMedia`, `getMediaUrl`, `createConversation` in slices (b)–(c). |
| Library | List, search by content, filter by type | `listMedia` |
| Library | Delete | `deleteMedia` |
| Library | Open in studio | Navigation with the item's prompt |
| Library | Ask about it | `createConversation` |
| Library | Convert or export | Opens the capability's run screen → `runCapability` |
| Characters | List mine and shared | `listCharacters` |
| Characters | Open one | `getCharacter` |
| Characters | Create | `createCharacter` |
| Characters | Start chatting | `createConversation` |
| Developers | List capabilities | `listOfferings` |
| Developers | Run a capability | `runCapability` |
| Developers | List, create, revoke keys | `listApiKeys`, `createApiKey`, `revokeApiKey` |
| Settings | Change a preference, confirm age, switch adult content | `updatePreferences` |
| Settings | See plan, packs and balance | `getAccount`, `getCreditBalance` |
| Settings | Add credits (a pack) | `buyCreditPack` |
| Settings | Add credits (an amount of their own, within the operator's limits) | `buyCredits` |
| Settings | Choose, switch or cancel a plan | `changePlan` |
| Settings | See usage | `getUsage` |
| Settings | Sign out | `POST /auth/sign-out` |
| Chat, Home | Attach a video from the library | `listMedia`, then `createConversation` / `sendMessage` with `attachment_ids` |
| Chat, Home | Pick the model that runs the agent | `listAgentModels`, then `createConversation` / `sendMessage` with `agent_model` |
| Chat, Home | Put a character in a video (cast picker in the composer) | `listCharacters` (own, then public; mature only if shown), then `createConversation` / `sendMessage` with `character_slug` |
| Characters | Make a video with this character (opens Home with `?with=<slug>`) | `getCharacter`, then `createConversation` with `character_slug` |
| Chat | Summarise, find moments, ask about a video | `sendMessage` (the agent calls a video understanding capability) |
| Chat | Open a found moment in the studio | Navigation with the moment as the prompt |
| Studio Live | Load looks and destinations | `listLiveLooks`, `listLiveDestinations` |
| Studio Live | Save a look | `saveLiveLook` |
| Studio Live | Add or remove a destination | `addLiveDestination`, `removeLiveDestination` |
| Studio Live | Go live, with recording on or off | `startLiveSession` |
| Studio Live | Change the look or prompt on air | `updateLiveSession` |
| Studio Live | Watch stream health | `getLiveHealth` |
| Studio Live | End the stream | `stopLiveSession` (a recorded session is saved to the library) |
| Characters | Call, end call | `startCall`, `endCall` |
| Developers | Run a video analysis in the playground | `analyseVideo` |
| Developers | Open and close a session in the playground | `startLiveSession`, `stopLiveSession` |
| Developers | Browse example apps | `listExampleApps` |
| Operator · Overview | See users, jobs, revenue, cost, margin, engine status | `getOverview`, `getEngineHealth`, `listJobs` |
| Operator · Users | List users with email, budget, spent, remaining, plan | `provider.identity.listUsers`, `listActors`, `provider.budgets.getAllocation`, `provider.plans.getUserPlan` |
| Operator · User | Suspend or resume | `setActorStatus` |
| Operator · User | Change role | `provider.identity.setUserRole` |
| Operator · User | Assign or remove a plan | `provider.plans.assignPlan` |
| Operator · User | Add credit (manual adjustment) | `provider.budgets.topUpAllocation` |
| Operator · User | See keys and usage | `listAccessKeys`, `provider.usage.listUsage` |
| Operator · Pricing | See provider and features, plans, packs, markup | `provider.features`, `provider.plans.listPlans`, `provider.plans.listCreditPacks` |
| Operator · Pricing | Create or edit a plan | `provider.plans.createPlan`, `provider.plans.updatePlan` |
| Operator · Pricing | Allow other amounts; set the minimum and maximum | `provider.plans.getTopUpRange`, `provider.plans.updateTopUpRange` |
| Operator · Billing | Connect a processor, tax setting | `getBillingSettings`, `updateBillingSettings` |
| Operator · Billing | See payments, invoices, failed payments; refund | `listPayments`, `refundPayment` |
| Operator · Costs | Retail against wholesale per capability, pending | `getCostSummary` |
| Operator · Jobs | List, filter, inspect attempts and failures | `listJobs` |
| Operator · Jobs | Retry | `retryJob` |
| Operator · Capabilities | See discovery; enable, set markup, override surfaces | `listOfferings`, `getCapabilitySetting`, `updateCapabilitySetting` |
| Operator · Compute | See operators that served jobs; allow or block | `listComputeOperators`, `setComputeOperatorBlocked` |
| Operator · Grants | List, create, add funding | `provider.budgets.listGrants`, `createGrant`, `fundGrant` |
| Operator · Settings | Name, domain, logo and symbol (upload, replace, remove; previewed in both themes; checked and cleaned on save by `lib/operator/logo.ts`), colours, sign-up, privacy, surfaces (app, API, MCP, reviewed before any is switched off; the console is shown on and disabled), content policy | Writes the instance config (`@aquareum/config` `validateConfig`) |
| Operator · Keys | List, issue, revoke | `listAccessKeys`, `issueAccessKey`, `revokeAccessKey` |
| Operator · System | Health, versions, doctor, data sources | `getEngineHealth`, doctor checks |
