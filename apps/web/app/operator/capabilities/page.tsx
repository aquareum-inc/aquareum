import { isCapabilityEnabled, placeCapability } from "@aquareum/config";
import { CapabilitiesView } from "@aquareum/operator-console";
import type { Metadata } from "next";

import { instance } from "@/lib/instance";
import { updateCapabilityAction } from "@/lib/operator/actions";
import { operatorApi, pricing } from "@/lib/operator/client";

export const metadata: Metadata = { title: "Capabilities" };

export default async function CapabilitiesPage() {
  const client = await operatorApi();
  const { capabilities, surfaces, mobile } = instance();
  const phones = surfaces.mobile === true && Boolean(mobile?.ios?.bundleId || mobile?.android?.applicationId);
  const offerings = await client.listOfferings();
  const rows = await Promise.all(
    offerings.data.map(async (offering) => {
      const placement = placeCapability(offering, capabilities?.overrides);
      return {
        offering,
        kind: placement.kind.replace(/-/g, " "),
        surfaces: placement.surfaces,
        // Blocked by a rule in the config file; the console's own switch is the exact entry, read as the setting.
        allowed: isCapabilityEnabled(offering.app, { ...capabilities, block: (capabilities?.block ?? []).filter((rule) => rule !== offering.app) }),
        setting: (await client.getCapabilitySetting(offering.app)).data,
      };
    }),
  );
  return (
    <CapabilitiesView
      rows={rows}
      defaultMarkup={pricing().default}
      update={updateCapabilityAction}
      placing={surfaces.app || phones}
      sources={[{ name: "listOfferings", source: offerings.source }, { name: "updateCapabilitySetting", source: "live" }]}
    />
  );
}
