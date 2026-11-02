"use client";

import { useEffect, useState } from "react";

import type { Share } from "@/domain/share";
import { useAuthStore } from "@/lib/auth-store";
import { shareRepository } from "@/lib/share-repository-instance";

// Live list of the trip's read-only links, newest first. Members only.
export function useShares(tripId: string | null): Share[] {
  const [shares, setShares] = useState<Share[]>([]);

  // A listener refused before sign-in would stay dead, so wait for it.
  const member = useAuthStore((s) => s.access === "member");

  useEffect(() => {
    if (!tripId || !member) return;
    return shareRepository.watchShares(
      tripId,
      (list) =>
        setShares(
          [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        ),
      () => setShares([]),
    );
  }, [tripId, member]);

  return shares;
}
