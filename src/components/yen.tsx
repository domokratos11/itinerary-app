"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DollarSign, Eye, EyeOff, JapaneseYen } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatUsdAt,
  formatYen,
  HIDDEN_AMOUNT,
  YEN_PER_USD,
} from "@/domain/budget";
import {
  setDisplayCurrency,
  useDisplayCurrency,
  type DisplayCurrency,
} from "@/lib/display-currency";
import { setHideAmounts, useHideAmounts } from "@/lib/hide-amounts";
import { t } from "@/lib/i18n";
import { loadUsdRate, useUsdRate } from "@/lib/usd-rate";
import { useReadOnly } from "@/lib/viewer-store";

const roundRate = (rate: number) => Math.round(rate * 100) / 100;

export function usdHint(yen: number, rate: number = YEN_PER_USD): string {
  return t("budget.usdHint", {
    usd: formatUsdAt(yen, rate),
    rate: roundRate(rate),
  });
}

type Money = {
  hidden: boolean;
  currency: DisplayCurrency;
  rate: number;
};

const MoneyContext = createContext<Money>({
  hidden: false,
  currency: "JPY",
  rate: YEN_PER_USD,
});

// Amounts inside this follow the eye and currency buttons. It wraps only the
// screens that have them, so a price elsewhere is never hidden or converted
// with no way to bring it back.
export function MoneyScope({ children }: { children: ReactNode }) {
  const hidden = useHideAmounts((s) => s.hidden);
  const currency = useDisplayCurrency((s) => s.currency);
  const rate = useUsdRate((s) => s.rate);
  useEffect(() => {
    if (currency === "USD") void loadUsdRate();
  }, [currency]);
  const value = useMemo(
    () => ({ hidden, currency, rate }),
    [hidden, currency, rate],
  );
  return (
    <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>
  );
}

export function useAmountsHidden(): boolean {
  return useContext(MoneyContext).hidden;
}

// How to word an amount here: yen with dollars as the hint, or the other way
// round when shown in dollars. Charts still draw from the real numbers, so
// their shapes stay true; they have no value axis to read an amount from.
export function useYenValues(): {
  format: (yen: number) => string;
  hint: ((yen: number) => string) | undefined;
} {
  const { hidden, currency, rate } = useContext(MoneyContext);
  return useMemo(() => {
    // No hint while hidden: it would give the amount away.
    if (hidden) return { format: () => HIDDEN_AMOUNT, hint: undefined };
    if (currency === "USD")
      return {
        format: (yen: number) => formatUsdAt(yen, rate),
        hint: (yen: number) =>
          t("budget.yenHint", { yen: formatYen(yen), rate: roundRate(rate) }),
      };
    return {
      format: formatYen,
      hint: (yen: number) => usdHint(yen, rate),
    };
  }, [hidden, currency, rate]);
}

// An open eye shows the amounts, a closed one hides them.
export function HideAmountsButton() {
  const hidden = useAmountsHidden();
  // A read-only link has no amounts to show or hide.
  const readOnly = useReadOnly();
  if (readOnly) return null;
  return (
    <Button
      variant="outline"
      size="icon"
      aria-pressed={hidden}
      aria-label={hidden ? t("budget.showAmounts") : t("budget.hideAmounts")}
      title={hidden ? t("budget.showAmounts") : t("budget.hideAmounts")}
      onClick={() => setHideAmounts(!hidden)}
    >
      {hidden ? <EyeOff /> : <Eye />}
    </Button>
  );
}

// Switches the amounts between yen and dollars. The icon is the currency
// shown now.
export function CurrencyButton() {
  const { currency } = useContext(MoneyContext);
  const readOnly = useReadOnly();
  if (readOnly) return null;
  const usd = currency === "USD";
  const label = usd ? t("budget.showInYen") : t("budget.showInUsd");
  return (
    <Button
      variant="outline"
      size="icon"
      aria-pressed={usd}
      aria-label={label}
      title={label}
      onClick={() => setDisplayCurrency(usd ? "JPY" : "USD")}
    >
      {usd ? <DollarSign /> : <JapaneseYen />}
    </Button>
  );
}

// An amount, with its value in the other currency on hover. Phones have no
// hover, so a tap opens it too (preventDefault keeps the tooltip's own click
// handler from closing it again). While amounts are hidden there's no hint,
// and any `children` must already be worded with useYenValues.
export function Yen({ yen, children }: { yen: number; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const hidden = useAmountsHidden();
  const money = useYenValues();
  // Never an amount on a read-only link, not even a hidden one.
  const readOnly = useReadOnly();
  if (readOnly) return null;
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
            {children ?? money.format(yen)}
          </span>
        </TooltipTrigger>
        <TooltipContent>{money.hint?.(yen)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
