import type { PrivacyDescription, PrivacyTier } from "@aquareum/api-client/types";

const TIERS: PrivacyTier[] = [
  {
    name: "Default, on any instance",
    status: null,
    summary: "How a job is handled unless you choose otherwise.",
    instance_sees: "Processes your prompt to send the job, but doesn't keep prompts or outputs on its servers. It knows who you are, because you're signed in.",
    compute_sees: "Sees the content of the one job it runs. It doesn't see who sent it or anything else you've done; identity is stripped before the job leaves the instance.",
  },
  {
    name: "Self-hosted instance",
    status: null,
    summary: "You run the app yourself, so no outside app provider is involved.",
    instance_sees: "That's you. Nobody else operates the app or can see what passes through it.",
    compute_sees: "Same as the default: the content of the single job it runs, with no identity attached. Jobs still run on the network unless you route them elsewhere.",
  },
  {
    name: "Verified compute",
    status: "Planned, not available",
    summary: "Jobs would go only to compute operators running attested secure hardware.",
    instance_sees: "Same as the default.",
    compute_sees: "Would not be able to see content, because the job runs inside hardware that proves what it's running. This doesn't exist yet.",
  },
  {
    name: "Your own compute",
    status: "Advanced",
    summary: "A self-hosted instance routed only to GPUs you run.",
    instance_sees: "You.",
    compute_sees: "You. Nobody outside your organisation sees anything.",
  },
];

/** A plain account of who can see a job, per privacy tier, for this instance. No claims beyond what is true today. */
export function describePrivacy(retainsChats: boolean): PrivacyDescription {
  return { retains_chats: retainsChats, tiers: TIERS.map((tier) => ({ ...tier })) };
}
