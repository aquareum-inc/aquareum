import { KeysView } from "@livepeer/operator-console";
import type { Metadata } from "next";

import { issueKeyAction, revokeKeyAction } from "@/lib/operator/actions";
import { operatorApi } from "@/lib/operator/client";

export const metadata: Metadata = { title: "Keys" };

export default async function KeysPage() {
  const keys = await (await operatorApi()).listAccessKeys();
  return <KeysView keys={keys.data} issue={issueKeyAction} revoke={revokeKeyAction} sources={[{ name: "listAccessKeys", source: keys.source }]} />;
}
