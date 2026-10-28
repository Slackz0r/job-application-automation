"use client";

import { useCallback, useState } from "react";
import { OpportunityDiscovery, type OpportunityDiscoveryProps } from "./opportunity-discovery";
import { TrackedOpportunities } from "./tracked-opportunities";
import type { Tracking, TrackingMap } from "@/schemas/opportunity-tracking";

export function OpportunityWorkspace(
  props: Omit<OpportunityDiscoveryProps, "trackingUpdates" | "onTrackingSaved">,
) {
  const [updates, setUpdates] = useState<TrackingMap>({});
  const [version, setVersion] = useState(0);

  // Keep discovery cards and the tracked list in sync after a tracking save.
  const saved = useCallback((tracking: Tracking) => {
    setUpdates((current) => ({ ...current, [tracking.opportunityId]: tracking }));
    setVersion((value) => value + 1);
  }, []);

  return (
    <>
      <OpportunityDiscovery {...props} trackingUpdates={updates} onTrackingSaved={saved} />

      <TrackedOpportunities changeVersion={version} updates={updates} onTrackingSaved={saved} />
    </>
  );
}
