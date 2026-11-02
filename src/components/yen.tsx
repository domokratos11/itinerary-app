"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatUsd,
  formatYen,
  HIDDEN_AMOUNT,
  YEN_PER_USD,
} from "@/domain/budget";
import { setHideAmounts, useHideAmounts } from "@/lib/hide-amounts";
import { t } from "@/lib/i18n";

export function usdHint(yen: number): string {
  return t("budget.usdHint", { usd: formatUsd(yen), rate: YEN_PER_USD });
}

// For charts and lists that show yen: the amount, with dollars as the hint.
const YEN_VALUES = { format: formatYen, hint: usdHint };
// No hint while hidden: the dollars would give the amount away.
const HIDDEN_VALUES = { format: () => HIDDEN_AMOUNT, hint: undefined };

const AmountsHidden = createContext(false);

// Amounts inside this follow the eye button. It wraps only the screens that
// have one, so a price elsewhere is never hidden with no way to bring it back.
export function MoneyScope({ children }: { children: ReactNode }) {
  const hidden = useHideAmounts((s) => s.hidden);
  return (
    <AmountsHidden.Provider value={hidden}>{children}</AmountsHidden.Provider>
  );
}

export function useAmountsHidden(): boolean {
  return useContext(AmountsHidden);
}

// How to word an amount here. Charts still draw from the real numbers, so their
// shapes stay true; they have no value axis to read an amount from.
export function useYenValues() {
  return useAmountsHidden() ? HIDDEN_VALUES : YEN_VALUES;
}

// An open eye shows the amounts, a closed one hides them.
export function HideAmountsButton() {
  const hidden = useAmountsHidden();
  return (
    <Button
      variant="outline"
      size="icon"
      aria-pressed={hidden}
      aria-label={hidden ? t("budget.showAmounts") : t("budget.hideAmounts")}
      onClick={() => setHideAmounts(!hidden)}
    >
      {hidden ? <EyeOff /> : <Eye />}
    </Button>
  );
}

// An amount in yen, with its rough value in dollars on hover. Phones have no
// hover, so a tap opens it too (preventDefault keeps the tooltip's own click
// handler from closing it again). While amounts are hidden there's no hint, and
// any `children` must already be worded with useYenValues.
export function Yen({ yen, children }: { yen: number; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const hidden = useAmountsHidden();
  if (hidden) return <span>{children ?? HIDDEN_AMOUNT}</span>;
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
