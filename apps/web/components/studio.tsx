"use client";

import { quoteCredits, type AppModel, type Offering } from "@livepeer/api-client";
import { StudioScreen, type Medium } from "@livepeer/user-app";
import { useRouter } from "next/navigation";

import { createGenerationAction, getGenerationAction } from "@/lib/actions";

export function Studio({ medium, offerings, withdrawn, models, initialPrompt, signedIn }: { medium: Medium; offerings: Offering[]; withdrawn: string[]; models: AppModel[]; initialPrompt: string; signedIn: boolean }) {
  const router = useRouter();
  return (
    <StudioScreen
      key={medium}
      {...(signedIn ? {} : { signInHref: `/sign-in?next=/studio/${medium}` })}
      medium={medium}
      onTabChange={(next) => router.push(`/studio/${next}`)}
      offerings={offerings}
      withdrawn={withdrawn}
      models={models}
      initialPrompt={initialPrompt}
      quote={quoteCredits}
      createGeneration={createGenerationAction}
      getGeneration={getGenerationAction}
    />
  );
}
