import { Badge, Card } from "@aquareum/ui";

interface Tier {
  name: string;
  status?: string;
  summary: string;
  instance: string;
  compute: string;
}

const TIERS: Tier[] = [
  {
    name: "Default, on any instance",
    summary: "How a job is handled unless you choose otherwise.",
    instance: "Processes your prompt to send the job, but doesn't keep prompts or outputs on its servers. It knows who you are, because you're signed in.",
    compute: "Sees the content of the one job it runs. It doesn't see who sent it or anything else you've done; identity is stripped before the job leaves the instance.",
  },
  {
    name: "Self-hosted instance",
    summary: "You run the app yourself, so no outside app provider is involved.",
    instance: "That's you. Nobody else operates the app or can see what passes through it.",
    compute: "Same as the default: the content of the single job it runs, with no identity attached. Jobs still run on the network unless you route them elsewhere.",
  },
  {
    name: "Verified compute",
    status: "Planned, not available",
    summary: "Jobs would go only to compute operators running attested secure hardware.",
    instance: "Same as the default.",
    compute: "Would not be able to see content, because the job runs inside hardware that proves what it's running. This doesn't exist yet.",
  },
  {
    name: "Your own compute",
    status: "Advanced",
    summary: "A self-hosted instance routed only to GPUs you run.",
    instance: "You.",
    compute: "You. Nobody outside your organisation sees anything.",
  },
];

/** A plain account of who can see a job, per privacy tier. No claims beyond what is true today. */
export function PrivacySettings({ retainsChats }: { retainsChats: boolean }) {
  return (
    <>
      <div className="mb-6 max-w-[64ch] text-body text-muted-foreground">
        <p>
          Two parties can potentially see a job: the <strong className="font-medium text-foreground">instance operator</strong>, who runs this app, and the{" "}
          <strong className="font-medium text-foreground">compute operator</strong>, whose GPU on the network runs the job.
        </p>
        <p className="mt-2">
          This instance {retainsChats ? "keeps your prompts and outputs on its servers so you can return to them" : "does not keep your prompts or outputs on its servers"}. Compute operators are independent; they are not bound by a no-retention agreement, so treat a job's content as visible to the operator that runs it.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {TIERS.map((tier, index) => (
          <Card key={tier.name} className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-caption text-subtle-foreground">{index + 1}</span>
              <h2 className="text-body font-semibold">{tier.name}</h2>
              {tier.status ? <Badge>{tier.status}</Badge> : null}
            </div>
            <p className="mt-1 text-body text-muted-foreground">{tier.summary}</p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-caption font-medium text-subtle-foreground">Instance operator can see</dt>
                <dd className="mt-1 text-body text-foreground">{tier.instance}</dd>
              </div>
              <div>
                <dt className="text-caption font-medium text-subtle-foreground">Compute operator can see</dt>
                <dd className="mt-1 text-body text-foreground">{tier.compute}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
    </>
  );
}
