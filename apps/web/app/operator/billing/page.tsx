import { BillingView } from "@livepeer/operator-console";
import type { Metadata } from "next";

import { refundPaymentAction, updateBillingAction } from "@/lib/operator/actions";
import { operatorApi } from "@/lib/operator/client";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const client = await operatorApi();
  const [settings, payments] = await Promise.all([client.getBillingSettings(), client.listPayments()]);
  return (
    <BillingView
      settings={settings.data}
      payments={payments.data}
      update={updateBillingAction}
      refund={refundPaymentAction}
      sources={[{ name: "getBillingSettings", source: settings.source }, { name: "listPayments", source: payments.source }]}
    />
  );
}
