import { DataSourceBadge, PlanSettings, SettingsLayout } from "@livepeer/user-app";
import type { Metadata } from "next";

import { buyCreditPackAction, buyCreditsAction, changePlanAction } from "@/lib/actions";
import { api } from "@/lib/api";
import { isDev } from "@/lib/env";

export const metadata: Metadata = { title: "Plan and credits" };

export default async function PlanPage() {
  const client = await api();
  const [account, balance] = await Promise.all([client.getAccount(), client.getCreditBalance()]);
  return (
    <SettingsLayout current="/settings/plan">
      <PlanSettings account={account.data} balance={balance.data} buyPack={buyCreditPackAction} buyCredits={buyCreditsAction} changePlan={changePlanAction} />
      {isDev ? <DataSourceBadge sources={[{ name: "getAccount", source: account.source }, { name: "getCreditBalance", source: balance.source }]} /> : null}
    </SettingsLayout>
  );
}
