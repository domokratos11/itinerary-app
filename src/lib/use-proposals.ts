"use client";

import { useEffect, useState } from "react";

import type { Proposal } from "@/domain/schemas";
import { useAuthStore } from "@/lib/auth-store";
import { proposalRepository } from "@/lib/proposal-repository-instance";

// Live list of research proposals for the trip. Empty until a trip ID is known.
export function useProposals(tripId: string | null): Proposal[] {
  const [proposals, setProposals] = useState<Proposal[]>([]);

  // A listener refused before sign-in would stay dead, so wait for it.
  const member = useAuthStore((s) => s.access === "member");

  useEffect(() => {
    if (!tripId || !member) return;
    return proposalRepository.subscribe(tripId, setProposals, () =>
      setProposals([]),
    );
  }, [tripId, member]);

  return proposals;
}
