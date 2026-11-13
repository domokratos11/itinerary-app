"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// The small round + in a gap of the day's line, on the rail. It opens the
// quick add sheet for exactly that gap. On phones it's always visible with a
// 44px touch target; from lg it's quiet until hovered or focused. It stays in
// the layout (just hidden) while a stop is dragged, so nothing jumps.
export function GapRow({
  onAdd,
  hidden,
  rail,
}: {
  onAdd: () => void;
  hidden: boolean;
  // Whether the day's line runs through this gap (not on an empty day).
  rail: boolean;
}) {
  return (
    <li
      className={cn(
        "relative h-11 md:h-8",
        rail &&
          "before:absolute before:inset-y-0 before:left-[12.5px] before:w-[3px] before:bg-(--day-line)",
        hidden && "invisible",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        aria-label={t("quickAdd.addHere")}
        onClick={onAdd}
        className="group/plus absolute top-1/2 -left-2 size-11 -translate-y-1/2 rounded-full p-0 hover:bg-transparent md:left-0 md:size-7"
      >
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-full border bg-background text-foreground shadow-xs transition-opacity md:size-6 lg:text-muted-foreground lg:opacity-60 lg:group-hover/plus:opacity-100 lg:group-focus-visible/plus:opacity-100"
        >
          <Plus className="size-4" />
        </span>
      </Button>
    </li>
  );
}
