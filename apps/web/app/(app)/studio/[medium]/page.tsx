import { DataSourceBadge, isMedium } from "@aquareum/user-app";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Studio } from "@/components/studio";
import { api } from "@/lib/api";
import { getSession } from "@/lib/auth/session";
import { isDev } from "@/lib/env";
import { appModels } from "@/lib/models";

export const metadata: Metadata = { title: "Studio" };

export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ medium: string }>;
  searchParams: Promise<{ prompt?: string }>;
}) {
  const [{ medium }, { prompt }] = await Promise.all([params, searchParams]);
  if (!isMedium(medium)) notFound();
  const [offerings, session] = await Promise.all([(await api()).listOfferings(), getSession()]);
  const models = await appModels(offerings.data);
  return (
    <>
      <Studio medium={medium} offerings={offerings.data} models={models.data} initialPrompt={prompt ?? ""} signedIn={session !== null} />
      {isDev ? (
        <DataSourceBadge
          sources={[
            { name: "listOfferings", source: offerings.source },
            { name: "listRunners (models)", source: models.source },
            { name: "createGeneration", source: "mock" },
          ]}
        />
      ) : null}
    </>
  );
}
