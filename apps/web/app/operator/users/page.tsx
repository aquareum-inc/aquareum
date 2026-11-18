import { UsersView } from "@aquareum/operator-console";
import type { Metadata } from "next";

import { ConsoleLink } from "@/components/console";
import { operatorApi } from "@/lib/operator/client";
import { userRows } from "@/lib/operator/users";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const client = await operatorApi();
  const { rows, live } = await userRows(client);
  return (
    <UsersView
      users={rows}
      Link={ConsoleLink}
      sources={[
        { name: "listActors", source: live ? "live" : "mock" },
        { name: "budgets.getAllocation", source: client.provider.id === "mock" ? "mock" : "live" },
        { name: "plans.getUserPlan", source: "mock" },
      ]}
    />
  );
}
