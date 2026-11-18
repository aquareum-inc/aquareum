import "server-only";

import type { ApiClient } from "@aquareum/api-client";

import { getSession } from "./auth/session";
import { instance } from "./instance";

/** Adult content is shown only when the operator offers it and a signed-in user has switched it on. */
export async function adultContent(client: ApiClient): Promise<{ offered: boolean; shown: boolean }> {
  const offered = instance().content?.adultContent ?? false;
  if (!offered || !(await getSession())) return { offered, shown: false };
  const { data } = await client.getPreferences();
  return { offered, shown: data.ageConfirmed && data.adultContent };
}

export function charactersEnabled(): boolean {
  return instance().content?.characters ?? true;
}
