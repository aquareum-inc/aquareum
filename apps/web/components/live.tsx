"use client";

import type { LiveDestination, LiveLook, Offering } from "@livepeer/api-client";
import { LiveScreen, StudioHeader } from "@livepeer/user-app";
import { useRouter } from "next/navigation";

import {
  addLiveDestinationAction,
  getLiveHealthAction,
  removeLiveDestinationAction,
  saveLiveLookAction,
  startLiveSessionAction,
  stopLiveSessionAction,
  updateLiveSessionAction,
} from "@/lib/actions";

export function Live({ offerings, looks, destinations }: { offerings: Offering[]; looks: LiveLook[]; destinations: LiveDestination[] }) {
  const router = useRouter();
  return (
    <LiveScreen
      header={<StudioHeader current="live" onChange={(tab) => router.push(`/studio/${tab}`)} />}
      offerings={offerings}
      initialLooks={looks}
      initialDestinations={destinations}
      saveLook={saveLiveLookAction}
      addDestination={addLiveDestinationAction}
      removeDestination={removeLiveDestinationAction}
      start={startLiveSessionAction}
      update={updateLiveSessionAction}
      stop={stopLiveSessionAction}
      getHealth={getLiveHealthAction}
    />
  );
}
