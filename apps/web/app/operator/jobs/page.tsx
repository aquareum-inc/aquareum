import { JobsView } from "@livepeer/operator-console";
import type { Metadata } from "next";

import { retryJobAction } from "@/lib/operator/actions";
import { operatorApi } from "@/lib/operator/client";
import { actorNames } from "@/lib/operator/names";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage() {
  const client = await operatorApi();
  const [jobs, actors] = await Promise.all([client.listJobs(100), client.listActors()]);
  return (
    <JobsView
      jobs={jobs.data}
      names={await actorNames(client, actors.data)}
      retry={retryJobAction}
      sources={[{ name: "listJobs", source: jobs.source }, { name: "retryJob", source: "mock" }]}
    />
  );
}
