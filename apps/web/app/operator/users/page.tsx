import { UsersView } from "@aquareum/operator-console";
import type { Metadata } from "next";

import { ConsoleLink } from "@/components/console";
import { operatorApi } from "@/lib/operator/client";
import { userRows } from "@/lib/operator/users";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const client = await operatorApi();
  const { rows, sources } = await userRows(client);
  return (
    <UsersView
      users={rows}
      Link={ConsoleLink}
      sources={sources}
    />
  );
}
