"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

const ORDER = ["light", "dark"] as const;
const ICON = { light: Sun, dark: Moon } as const;

// next-themes only knows the chosen theme after mount, so the button renders
// a neutral state on the server and the first client render.
const noop = () => () => {};

// Switches between Light and Dark.
export function ThemeToggle() {
  const { theme = "light", setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  const current: (typeof ORDER)[number] = theme === "dark" ? "dark" : "light";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = ICON[current];

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setTheme(next)}
      aria-label={t("theme.aria", {
        current: t(`theme.${current}`),
        next: t(`theme.${next}`),
      })}
    >
      {mounted ? <Icon /> : <Sun />}
      {mounted ? t(`theme.${current}`) : t("theme.theme")}
    </Button>
  );
}
