"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect } from "react";

// Sets a `dark` class on <html>. Styles in globals.css key off that class.
// Only Light and Dark exist; a device with no choice yet (or the old "system"
// choice) gets whichever its own setting shows right now, once.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      themes={["light", "dark"]}
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <PickFirstTheme />
      {children}
    </NextThemesProvider>
  );
}

function PickFirstTheme() {
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("theme");
    } catch {
      return;
    }
    if (stored === "light" || stored === "dark") return;
    const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setTheme(dark ? "dark" : "light");
  }, [theme, setTheme]);
  return null;
}
