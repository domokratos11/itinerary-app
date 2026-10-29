"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Sets a `dark` class on <html>. Styles in globals.css key off that class.
// Starts on "system", which follows the phone's setting.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
