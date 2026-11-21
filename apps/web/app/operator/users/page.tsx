import { UsersView } from "@livepeer/operator-console";
import type { Metadata } from "next";

import { ConsoleLink } from "@/components/console";
import { operatorApi } from "@/lib/operator/client";
import { userRows } from "@/lib/operator/users";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const client = await operatorApi();
  const { people, unlinked, sources } = await userRows(client);
  return (
    <UsersView
      users={people}
      unlinkedAccounts={unlinked.filter((account) => account.status !== "revoked").length}
      Link={ConsoleLink}
      sources={sources}
    />
  );
}
