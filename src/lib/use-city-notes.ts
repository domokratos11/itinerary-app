"use client";

import { useEffect, useState } from "react";

import type { CityNotes, CityNotesRepository } from "@/domain/city-notes";
import { useAuthStore } from "@/lib/auth-store";
import { cityNotesRepository } from "@/lib/city-notes-repository-instance";

// Live notes on the trip's cities, by city id. Null until the first answer,
// so a screen can tell "loading" from "none yet".
export function useCityNotes(
  tripId: string | null,
  repository: CityNotesRepository = cityNotesRepository,
): Map<string, CityNotes> | null {
  const [rows, setRows] = useState<Map<string, CityNotes> | null>(null);
  // A listener refused before sign-in would stay dead, so wait for it.
  const member = useAuthStore((s) => s.access === "member");

  useEffect(() => {
    if (!tripId || !member) return;
    return repository.subscribe(
      tripId,
      (list) => setRows(new Map(list.map((row) => [row.cityId, row]))),
      () => setRows(new Map()),
    );
  }, [tripId, member, repository]);

  return rows;
}
