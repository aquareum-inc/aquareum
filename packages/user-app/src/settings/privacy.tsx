import type { PrivacyDescription } from "@aquareum/api-client/types";
import { Badge, Card } from "@aquareum/ui";

/** A plain account of who can see a job, per privacy tier. No claims beyond what is true today. */
export function PrivacySettings({ description }: { description: PrivacyDescription }) {
  const { retains_chats: retainsChats, tiers } = description;
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
        {tiers.map((tier, index) => (
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
                <dd className="mt-1 text-body text-foreground">{tier.instance_sees}</dd>
              </div>
              <div>
                <dt className="text-caption font-medium text-subtle-foreground">Compute operator can see</dt>
                <dd className="mt-1 text-body text-foreground">{tier.compute_sees}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
    </>
  );
}
