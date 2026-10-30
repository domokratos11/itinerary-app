"use client";

import { useEffect, useState } from "react";

import type { Activity } from "@/domain/activity";
import { activityRepository } from "@/lib/activity-repository-instance";
import { useAuthStore } from "@/lib/auth-store";

// The newest activity entries, only while `enabled` (the sheet is open), so
// the log costs no reads when nobody is looking at it.
export function useActivity(
  tripId: string | null,
  enabled: boolean,
  limit = 50,
): { entries: Activity[]; error: string | null } {
  const [state, setState] = useState<{
    entries: Activity[];
    error: string | null;
  }>({ entries: [], error: null });

  // A listener refused before sign-in would stay dead, so wait for it.
  const member = useAuthStore((s) => s.access === "member");

  useEffect(() => {
    if (!tripId || !enabled || !member) return;
    return activityRepository.subscribe(
      tripId,
      limit,
      (entries) => setState({ entries, error: null }),
      (error) => setState({ entries: [], error: error.message }),
    );
  }, [tripId, enabled, limit, member]);

  return state;
}
