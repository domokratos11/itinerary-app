"use client";

import { useState, type ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatUsd, formatYen, YEN_PER_USD } from "@/domain/budget";
import { t } from "@/lib/i18n";

export function usdHint(yen: number): string {
  return t("budget.usdHint", { usd: formatUsd(yen), rate: YEN_PER_USD });
}

// For charts and lists that show yen: the amount, with dollars as the hint.
export const YEN_VALUES = { format: formatYen, hint: usdHint };

// An amount in yen, with its rough value in dollars on hover. Phones have no
// hover, so a tap opens it too (preventDefault keeps the tooltip's own click
// handler from closing it again).
export function Yen({ yen, children }: { yen: number; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="cursor-help"
            onClick={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
          >
            {children ?? formatYen(yen)}
          </span>
        </TooltipTrigger>
        <TooltipContent>{usdHint(yen)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
