import { ComputeView } from "@aquareum/operator-console";
import type { Metadata } from "next";

import { setOperatorBlockedAction } from "@/lib/operator/actions";
import { operatorApi } from "@/lib/operator/client";

export const metadata: Metadata = { title: "Compute" };

export default async function ComputePage() {
  const operators = await (await operatorApi()).listComputeOperators();
  return (
    <ComputeView
      operators={operators.data}
      setBlocked={setOperatorBlockedAction}
      sources={[{ name: "listComputeOperators (from listJobs)", source: operators.source }, { name: "setComputeOperatorBlocked", source: "mock" }]}
    />
  );
}
