"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  readAmount,
  type AmountEntry,
  type EntryCurrency,
} from "@/domain/amount";
import { formatYen } from "@/domain/budget";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useCurrentUsdRate } from "@/lib/usd-rate";

const roundRate = (rate: number) => String(Math.round(rate * 100) / 100);

// An amount in yen, or in dollars converted to yen at a rate that can be
// changed. Everything is saved and counted in yen; the dollars and the rate
// are kept beside it to show where the yen came from.
export function AmountInput({
  id,
  value,
  onChange,
  large = false,
  autoFocus = false,
  required = false,
}: {
  id: string;
  value: AmountEntry;
  onChange: (value: AmountEntry) => void;
  large?: boolean;
  autoFocus?: boolean;
  required?: boolean;
}) {
  const { rate, live } = useCurrentUsdRate();
  const usd = value.currency === "USD";
  const result = readAmount(value);

  function setCurrency(currency: EntryCurrency) {
    if (currency === value.currency) return;
    // A new switch to dollars starts from today's rate.
    onChange({
      currency,
      amount: "",
      rate: currency === "USD" ? roundRate(rate) : value.rate,
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <span
            className={cn(
              "pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground",
              large && "text-2xl",
            )}
          >
            {usd ? "$" : "¥"}
          </span>
          <Input
            id={id}
            autoFocus={autoFocus}
            required={required}
            inputMode={usd ? "decimal" : "numeric"}
            enterKeyHint="done"
            autoComplete="off"
            value={value.amount}
            onChange={(e) => onChange({ ...value, amount: e.target.value })}
            className={cn(
              "pl-7 tabular-nums",
              large && "h-14 pl-9 text-2xl font-semibold md:text-2xl",
            )}
          />
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          value={value.currency}
          onValueChange={(v) => v && setCurrency(v as EntryCurrency)}
          aria-label={t("amount.currency")}
          className={cn(large && "h-14")}
        >
          <ToggleGroupItem
            value="JPY"
            aria-label={t("amount.inYen")}
            className={cn(large && "h-14 px-4")}
          >
            ¥
          </ToggleGroupItem>
          <ToggleGroupItem
            value="USD"
            aria-label={t("amount.inUsd")}
            className={cn(large && "h-14 px-4")}
          >
            $
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {usd && (
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1 rounded-md bg-muted/60 p-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-rate`} className="text-xs">
              {t("amount.rate")}
            </Label>
            <Input
              id={`${id}-rate`}
              inputMode="decimal"
              value={value.rate}
              onChange={(e) => onChange({ ...value, rate: e.target.value })}
              className="h-8 w-28 tabular-nums"
            />
          </div>
          <p className="min-w-0 flex-1 pb-1.5 text-sm">
            {result ? (
              <span className="font-medium tabular-nums">
                {t("amount.equals", { yen: formatYen(result.amountJPY) })}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {t("amount.typeUsd")}
              </span>
            )}
          </p>
          <p className="w-full text-xs text-muted-foreground">
            {live
              ? t("amount.liveRate", { rate: roundRate(rate) })
              : t("amount.fixedRate", { rate: roundRate(rate) })}
          </p>
        </div>
      )}
    </div>
  );
}
