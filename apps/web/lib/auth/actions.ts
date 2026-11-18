"use server";

import { revalidatePath } from "next/cache";

import { isDev } from "../env";
import { getSession, writeSession } from "./session";
import type { Role } from "./types";

/** Development only: change the signed-in role. Refused outside development. */
export async function switchRoleAction(role: Role): Promise<void> {
  if (!isDev) throw new Error("The role switcher is only available in development.");
  const session = await getSession();
  if (!session) return;
  await writeSession({ ...session, role });
  revalidatePath("/", "layout");
}
