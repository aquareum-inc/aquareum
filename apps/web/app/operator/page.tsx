import { OverviewView } from "@aquareum/operator-console";

import { operatorApi } from "@/lib/operator/client";
import { actorNames } from "@/lib/operator/names";

export default async function OverviewPage() {
  const client = await operatorApi();
  const [stats, health, jobs, actors] = await Promise.all([client.getOverview(), client.getEngineHealth(), client.listJobs(8), client.listActors()]);
  return (
    <OverviewView
      stats={stats.data}
      health={health.data}
      recent={jobs.data}
      names={await actorNames(client, actors.data)}
      sources={[
        { name: "getEngineHealth", source: health.source },
        { name: "listJobs", source: jobs.source },
        { name: "getOverview (revenue)", source: stats.source },
      ]}
    />
  );
}
