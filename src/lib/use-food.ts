"use client";

import { useEffect, useState } from "react";

import type { FoodCategory, FoodRepository, FoodSpot } from "@/domain/food";
import { useAuthStore } from "@/lib/auth-store";
import { foodRepository } from "@/lib/food-repository-instance";

export type FoodData = { categories: FoodCategory[]; spots: FoodSpot[] };

// The trip's saved food categories and spots, live. Null until both have
// answered, so a screen can tell "loading" from "none yet".
export function useFood(
  tripId: string | null,
  repository: FoodRepository = foodRepository,
): FoodData | null {
  const [categories, setCategories] = useState<FoodCategory[] | null>(null);
  const [spots, setSpots] = useState<FoodSpot[] | null>(null);
  // A listener refused before sign-in would stay dead, so wait for it.
  const member = useAuthStore((s) => s.access === "member");

  useEffect(() => {
    if (!tripId || !member) return;
    const stopCategories = repository.subscribeCategories(
      tripId,
      setCategories,
      () => setCategories([]),
    );
    const stopSpots = repository.subscribeSpots(tripId, setSpots, () =>
      setSpots([]),
    );
    return () => {
      stopCategories();
      stopSpots();
    };
  }, [tripId, member, repository]);

  return categories && spots ? { categories, spots } : null;
}
