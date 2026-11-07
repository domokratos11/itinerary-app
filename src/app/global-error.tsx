"use client";

import "./globals.css";

import { useEffect } from "react";

import { ErrorScreen } from "@/components/error-screen";
import { Button } from "@/components/ui/button";
import { getLocale, t } from "@/lib/i18n";

// Catches a crash in the root layout itself (sign-in gate, header, sidebar).
// It replaces the whole document, so it brings its own <html>, styles and
// theme: next-themes isn't running here.
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    try {
      if (localStorage.getItem("theme") === "dark")
        document.documentElement.classList.add("dark");
    } catch {
      // Blocked storage: the light theme is fine.
    }
  }, []);
  return (
    <html lang={getLocale()} className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <title>{t("error.title")}</title>
        <ErrorScreen error={error}>
          <Button onClick={() => retry()}>{t("error.retry")}</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t("error.reload")}
          </Button>
        </ErrorScreen>
      </body>
    </html>
  );
}
