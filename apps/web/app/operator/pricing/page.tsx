import { PricingView } from "@aquareum/operator-console";
import type { Metadata } from "next";

import { saveCreditPackAction, savePlanAction, saveTopUpRangeAction } from "@/lib/operator/actions";
import { operatorApi, pricing } from "@/lib/operator/client";

export const metadata: Metadata = { title: "Pricing and plans" };

export default async function PricingPage() {
  const { provider } = await operatorApi();
  const [plans, packs, topUp] = await Promise.all([provider.plans.listPlans(), provider.plans.listCreditPacks(), provider.plans.getTopUpRange()]);
  const source = provider.id === "mock" ? "mock" : "live";
  return (
    <PricingView
      provider={{ name: provider.name, features: provider.features }}
      plans={plans}
      packs={packs}
      topUp={topUp}
      markup={pricing()}
      savePlan={savePlanAction}
      savePack={saveCreditPackAction}
      saveTopUp={saveTopUpRangeAction}
      sources={[{ name: "plans.listPlans", source }, { name: "plans.listCreditPacks", source }, { name: "plans.getTopUpRange", source }]}
    />
  );
}
