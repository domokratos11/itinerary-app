"use client";

import { create } from "zustand";

import { parseShareId, type Share } from "@/domain/share";
import { BASE_PATH } from "@/lib/base-path";

// Viewer mode: someone opened a read-only link (?share=). They aren't signed
// in, see the link's copy of the trip and can change nothing. "off" for
// everyone else, which keeps the app exactly as members know it.
export type ViewerStatus = "off" | "loading" | "active" | "closed" | "failed";

type ViewerState = {
  status: ViewerStatus;
  share: Share | null;
  setStatus: (status: ViewerStatus) => void;
  open: (share: Share) => void;
};

// Fed by use-share-sync.
export const useViewerStore = create<ViewerState>()((set) => ({
  status: "off",
  share: null,
  setStatus: (status) =>
    set((state) => ({
      status,
      share: status === "active" ? state.share : null,
    })),
  open: (share) => set({ status: "active", share }),
}));

// True for people on a read-only link. Screens hide every way to change
// something, and every amount, when it is.
export function useReadOnly(): boolean {
  return useViewerStore((s) => s.status !== "off");
}

export function isViewer(): boolean {
  return useViewerStore.getState().status !== "off";
}

// Kept for this tab only, so moving around the app and reloading stay on
// the link, and closing the tab forgets it.
const STORAGE_KEY = "share-id";

// The link this tab is viewing, if any. A ?share= link starts viewer mode;
// a ?trip= link leaves it.
export function viewerShareId(
  fromUrl: string | null,
  tripFromUrl: string | null,
): string | null {
  try {
    const share = parseShareId(fromUrl);
    if (share) {
      window.sessionStorage.setItem(STORAGE_KEY, share);
      return share;
    }
    if (tripFromUrl) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parseShareId(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return parseShareId(fromUrl);
  }
}

// The same answer without remembering anything, for code that runs before
// the app starts, such as the version check's reset on a first visit.
export function currentShareId(): string | null {
  const query = new URLSearchParams(window.location.search ?? "");
  const fromUrl = parseShareId(query.get("share"));
  if (fromUrl || query.has("trip")) return fromUrl;
  try {
    return parseShareId(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

// Back to the app as a member would see it, by a full page load so nothing
// from the link stays in memory.
export function leaveSharedView(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing kept.
  }
  window.location.href = new URL(`${BASE_PATH}/`, window.location.origin).href;
}

export function shareUrl(shareId: string): string {
  return new URL(
    `${BASE_PATH}/?share=${encodeURIComponent(shareId)}`,
    window.location.origin,
  ).href;
}
