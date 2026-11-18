import { isCapabilityEnabled, placeCapability } from "@aquareum/config";
import { CapabilitiesView } from "@aquareum/operator-console";
import type { Metadata } from "next";

import { instance } from "@/lib/instance";
import { updateCapabilityAction } from "@/lib/operator/actions";
import { operatorApi, pricing } from "@/lib/operator/client";

export const metadata: Metadata = { title: "Capabilities" };

export default async function CapabilitiesPage() {
  const client = await operatorApi();
  const { capabilities } = instance();
  const offerings = await client.listOfferings();
  const rows = await Promise.all(
    offerings.data.map(async (offering) => {
      const placement = placeCapability(offering, capabilities?.overrides);
      return {
        offering,
        kind: placement.kind.replace(/-/g, " "),
        surfaces: placement.surfaces,
        allowed: isCapabilityEnabled(offering.app, capabilities),
        setting: (await client.getCapabilitySetting(offering.app)).data,
      };
    }),
  );
  return (
    <CapabilitiesView
      rows={rows}
      defaultMarkup={pricing().default}
      update={updateCapabilityAction}
      sources={[{ name: "listOfferings", source: offerings.source }, { name: "updateCapabilitySetting", source: "mock" }]}
    />
  );
}
