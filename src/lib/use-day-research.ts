"use client";

import { useEffect, useState } from "react";

import type { DayResearch } from "@/domain/schemas";
import { useAuthStore } from "@/lib/auth-store";
import { dayResearchRepository } from "@/lib/day-research-repository-instance";

// Live research of the trip's days. Empty until a trip ID is known.
export function useDayResearch(tripId: string | null): DayResearch[] {
  const [rows, setRows] = useState<DayResearch[]>([]);

  // A listener refused before sign-in would stay dead, so wait for it.
  const member = useAuthStore((s) => s.access === "member");

  useEffect(() => {
    if (!tripId || !member) return;
    return dayResearchRepository.subscribe(tripId, setRows, () => setRows([]));
  }, [tripId, member]);

  return rows;
}
