"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuthStore } from "@/lib/auth-store";
import { useAuthSync } from "@/lib/use-auth-sync";
import { useTripId } from "@/lib/use-trip-id";
import { usePlanSync } from "@/lib/use-plan-sync";
import { useShareSync } from "@/lib/use-share-sync";
import { useTripSync } from "@/lib/use-trip-sync";
import { watchStartupWrites } from "@/lib/tracked-firestore";
import { viewerShareId } from "@/lib/viewer-store";

// Mounted once in the root layout, so the trip and its plan stay live on
// every page. Must be used inside a Suspense boundary. Someone on a
// read-only link gets the link's copy instead and never touches sign-in.
export function PlanSync() {
  const params = useSearchParams();
  const [shareId] = useState(() =>
    viewerShareId(params.get("share"), params.get("trip")),
  );
  return shareId ? (
    <ViewerSync shareId={shareId} />
  ) : (
    <MemberSync fromUrl={params.get("trip")} />
  );
}

// The listeners open only for a signed-in member; until then the rules
// would refuse them.
function MemberSync({ fromUrl }: { fromUrl: string | null }) {
  useAuthSync(fromUrl);
  const tripId = useTripId();
  const member = useAuthStore((s) => s.access === "member");
  const liveTripId = member ? tripId : null;
  usePlanSync(liveTripId);
  useTripSync(liveTripId);
  // Edits queued offline before a reload show as "sending" until they go.
  useEffect(() => {
    if (liveTripId) watchStartupWrites();
  }, [liveTripId]);
  return null;
}

function ViewerSync({ shareId }: { shareId: string }) {
  useShareSync(shareId);
  return null;
}
