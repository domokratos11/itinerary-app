"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

const ORDER = ["system", "light", "dark"] as const;
const ICON = { system: Monitor, light: Sun, dark: Moon } as const;

// next-themes only knows the chosen theme after mount, so the button renders
// a neutral state on the server and the first client render.
const noop = () => () => {};

// Cycles Match phone → Light → Dark. `compact` shows only the icon.
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme = "system", setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  const current =
    mounted && ORDER.includes(theme as (typeof ORDER)[number])
      ? (theme as (typeof ORDER)[number])
      : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = ICON[current];

  return (
    <Button
      variant={compact ? "ghost" : "outline"}
      size={compact ? "icon-sm" : "sm"}
      onClick={() => setTheme(next)}
      aria-label={t("theme.aria", {
        current: t(`theme.${current}`),
        next: t(`theme.${next}`),
      })}
    >
      <Icon />
      {!compact && (mounted ? t(`theme.${current}`) : t("theme.theme"))}
    </Button>
  );
}
