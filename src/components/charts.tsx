"use client";

import type { ComponentType, ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  XAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { darkStep } from "@/domain/taxonomy";

export type Series = {
  key: string;
  label: string;
  value: number;
  color: string;
  icon?: ComponentType<{ className?: string; style?: React.CSSProperties }>;
};

function configFor(series: Pick<Series, "key" | "label" | "color">[]) {
  const config: ChartConfig = {};
  for (const s of series)
    config[s.key] = {
      label: s.label,
      theme: { light: s.color, dark: darkStep(s.color) },
    };
  return config;
}

// A label, its colour and value, so nothing is told by colour alone.
export function SeriesLegend({
  series,
  format = String,
}: {
  series: Series[];
  format?: (value: number) => string;
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
          <span className="text-muted-foreground tabular-nums">
            {format(value)}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Parts of a whole. Empty parts stay out of the ring and the legend.
export function DonutChart({
  series,
  center,
  centerLabel,
  label,
  format = String,
}: {
  series: Series[];
  center: string;
  centerLabel: string;
  label: string;
  format?: (value: number) => string;
}) {
  const shown = series.filter((s) => s.value > 0);
  return (
    <div className="grid items-center gap-4 sm:grid-cols-2">
      <ChartContainer
        config={configFor(shown)}
        role="img"
        aria-label={label}
        className="mx-auto aspect-square w-full max-w-52"
      >
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                nameKey="key"
                hideLabel
                formatter={(value, _name, item) => (
                  <span className="flex w-full justify-between gap-3">
                    <span>{item.payload.label}</span>
                    <span className="tabular-nums">
                      {format(Number(value))}
                    </span>
                  </span>
                )}
              />
            }
          />
          <Pie
            data={shown}
            dataKey="value"
            nameKey="key"
            innerRadius="62%"
            outerRadius="95%"
            stroke="var(--card)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {shown.map((s) => (
              <Cell key={s.key} fill={`var(--color-${s.key})`} />
            ))}
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox)) return null;
                return (
                  <text textAnchor="middle" dominantBaseline="middle">
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy}
                      className="fill-foreground text-lg font-semibold"
                    >
                      {center}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 20}
                      className="fill-muted-foreground text-xs"
                    >
                      {centerLabel}
                    </tspan>
                  </text>
                );
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>
      <SeriesLegend series={shown} format={format} />
    </div>
  );
}

// How much of the budget has gone, as one ring around the amount left.
export function BudgetGauge({
  percent,
  over,
  label,
  children,
}: {
  percent: number;
  over: boolean;
  label: string;
  children: ReactNode;
}) {
  const color = over ? "var(--destructive)" : "var(--primary)";
  return (
    <div className="relative mx-auto aspect-square w-full max-w-52">
      <ChartContainer
        config={{ spent: { label } }}
        role="img"
        aria-label={label}
        className="aspect-square w-full"
      >
        <RadialBarChart
          data={[{ key: "spent", value: Math.min(100, percent) }]}
          startAngle={90}
          endAngle={-270}
          innerRadius="78%"
          outerRadius="100%"
          barSize={14}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar
            dataKey="value"
            background
            cornerRadius={7}
            fill={color}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ChartContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

// Values over time on one axis, as thin bars with rounded ends.
export function ColumnChart({
  data,
  color,
  name,
  label,
  tick,
  format = String,
}: {
  data: { key: string; value: number }[];
  color: string;
  name: string;
  label: string;
  tick: (key: string) => string;
  format?: (value: number) => string;
}) {
  return (
    <ChartContainer
      config={{
        value: {
          label: name,
          theme: { light: color, dark: darkStep(color) },
        },
      }}
      role="img"
      aria-label={label}
      className="aspect-auto h-44 w-full"
    >
      <BarChart data={data} margin={{ left: 0, right: 0, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="key"
          tickLine={false}
          axisLine={false}
          minTickGap={16}
          tickFormatter={tick}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => tick(String(value))}
              formatter={(value) => (
                <span className="tabular-nums">{format(Number(value))}</span>
              )}
            />
          }
        />
        <Bar
          dataKey="value"
          fill="var(--color-value)"
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  );
}

// Each day's stops, stacked by city in the cities' own colours.
export function StackedColumnChart({
  data,
  series,
  label,
  tick,
}: {
  data: ({ key: string } & Record<string, number | string>)[];
  series: Pick<Series, "key" | "label" | "color">[];
  label: string;
  tick: (key: string) => string;
}) {
  return (
    <ChartContainer
      config={configFor(series)}
      role="img"
      aria-label={label}
      className="aspect-auto h-52 w-full"
    >
      <BarChart data={data} margin={{ left: 0, right: 0, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="key"
          tickLine={false}
          axisLine={false}
          minTickGap={16}
          tickFormatter={tick}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => tick(String(value))}
            />
          }
        />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="stops"
            fill={`var(--color-${s.key})`}
            stroke="var(--card)"
            strokeWidth={2}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

// Rows of labelled bars, against the largest value or a given maximum.
export function BarList({
  rows,
  max,
  format = String,
}: {
  rows: Series[];
  max?: number;
  format?: (value: number) => string;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-3 text-sm">
      {rows.map(({ key, label, value, color, icon: Icon }) => (
        <li key={key} className="flex flex-col gap-1">
          <span className="flex items-center gap-2">
            {Icon && <Icon className="size-4 shrink-0" style={{ color }} />}
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <span className="text-muted-foreground tabular-nums">
              {format(value)}
            </span>
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
