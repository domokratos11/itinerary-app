"use client";

import type { ComponentType } from "react";

import { Tip } from "@/components/tip";
import { Progress } from "@/components/ui/progress";

// The chart pieces drawn without recharts, so screens can show them before
// the charting library has loaded (charts-lazy.tsx).

export type Series = {
  key: string;
  label: string;
  value: number;
  color: string;
  icon?: ComponentType<{ className?: string; style?: React.CSSProperties }>;
};

function ChartValue({
  value,
  format,
  hint,
}: {
  value: number;
  format: (value: number) => string;
  hint?: (value: number) => string;
}) {
  const shown = (
    <span className="text-muted-foreground tabular-nums">{format(value)}</span>
  );
  return hint ? <Tip label={hint(value)}>{shown}</Tip> : shown;
}

// A label, its colour and value, so nothing is told by colour alone.
export function SeriesLegend({
  series,
  format = String,
  hint,
}: {
  series: Series[];
  format?: (value: number) => string;
  hint?: (value: number) => string;
}) {
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {series.map(({ key, label, value, color, icon: Icon }) => (
        <li key={key} className="flex items-center gap-2">
          {Icon ? (
            <Icon className="size-4 shrink-0" style={{ color }} />
          ) : (
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
          )}
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <ChartValue value={value} format={format} hint={hint} />
        </li>
      ))}
    </ul>
  );
}

// Rows of labelled bars, against the largest value or a given maximum.
export function BarList({
  rows,
  max,
  format = String,
  hint,
}: {
  rows: Series[];
  max?: number;
  format?: (value: number) => string;
  hint?: (value: number) => string;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-3 text-sm">
      {rows.map(({ key, label, value, color, icon: Icon }) => (
        <li key={key} className="flex flex-col gap-1">
          <span className="flex items-center gap-2">
            {Icon && <Icon className="size-4 shrink-0" style={{ color }} />}
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <ChartValue value={value} format={format} hint={hint} />
          </span>
          <Progress
            value={Math.min(100, (value / top) * 100)}
            color={color}
            className="h-2"
            aria-label={label}
          />
        </li>
      ))}
    </ul>
  );
}
