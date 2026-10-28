"use client";

import { useCallback, useState } from "react";
import { OpportunityDiscovery, type OpportunityDiscoveryProps } from "./opportunity-discovery";
import { TrackedOpportunities } from "./tracked-opportunities";
import type { Tracking, TrackingMap } from "@/schemas/opportunity-tracking";
import { WorkspaceShell, type WorkspaceShellProps } from "@/components/workspace-shell";

type OpportunityWorkspaceProps = Omit<OpportunityDiscoveryProps, "trackingUpdates" | "onTrackingSaved"> &
  Pick<WorkspaceShellProps, "connection" | "profile" | "connectionStatus" | "initialView">;

export function OpportunityWorkspace({
  connection,
  profile,
  connectionStatus,
  initialView,
  ...props
}: OpportunityWorkspaceProps) {
  const [updates, setUpdates] = useState<TrackingMap>({});
  const [version, setVersion] = useState(0);

  // Keep discovery cards and the tracked list in sync after a tracking save.
  const saved = useCallback((tracking: Tracking) => {
    setUpdates((current) => ({ ...current, [tracking.opportunityId]: tracking }));
    setVersion((value) => value + 1);
  }, []);

  return (
    <WorkspaceShell
      initialView={initialView}
      connectionStatus={connectionStatus}
      discovery={<OpportunityDiscovery {...props} trackingUpdates={updates} onTrackingSaved={saved} />}
      tracking={<TrackedOpportunities changeVersion={version} updates={updates} onTrackingSaved={saved} />}
      connection={connection}
      profile={profile}
    />
  );
}
