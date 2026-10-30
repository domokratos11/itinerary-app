"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

const ORDER = ["system", "light", "dark"] as const;
const LABEL = { system: "Match phone", light: "Light", dark: "Dark" } as const;
const ICON = { system: Monitor, light: Sun, dark: Moon } as const;

// next-themes only knows the chosen theme after mount, so the button renders
// a neutral state on the server and the first client render.
const noop = () => () => {};

// Cycles Match phone → Light → Dark.
export function ThemeToggle() {
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
      variant="outline"
      size="sm"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${LABEL[current]}. Switch to ${LABEL[next]}`}
    >
      <Icon />
      {mounted ? LABEL[current] : "Theme"}
    </Button>
  );
}
