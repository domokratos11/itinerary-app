"use client";

import { useSyncExternalStore } from "react";

// Reads Japanese aloud with the device's own voice, the way the phrasebook's
// Listen buttons do: ja-JP, a little slower than normal.

export function canSpeakJapanese(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

export function speakJapanese(text: string): void {
  if (!canSpeakJapanese()) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  } catch {
    // No voice after all; the text is still on screen.
  }
}

const noChange = () => () => {};

// False on the server and the first render, so the static HTML never shows
// a Listen button the device can't use.
export function useCanSpeakJapanese(): boolean {
  return useSyncExternalStore(noChange, canSpeakJapanese, () => false);
}
