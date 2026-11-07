"use client";

// The charts drawn with recharts. Screens load them through charts-lazy.tsx,
// so the library stays out of the first page load.

import type { ReactNode } from "react";
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
import { SeriesLegend, type Series } from "@/components/chart-parts";
import { darkStep } from "@/domain/taxonomy";

function configFor(series: Pick<Series, "key" | "label" | "color">[]) {
  const config: ChartConfig = {};
  for (const s of series)
    config[s.key] = {
      label: s.label,
      theme: { light: s.color, dark: darkStep(s.color) },
    };
  return config;
}

// Parts of a whole. Empty parts stay out of the ring and the legend.
export function DonutChart({
  series,
  center,
  hint,
  centerLabel,
  label,
  format = String,
}: {
  series: Series[];
  center: string;
  hint?: (value: number) => string;
  centerLabel: string;
  label: string;
  format?: (value: number) => string;
}) {
  const shown = series.filter((s) => s.value > 0);
  return (
    <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
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
                      {hint && ` · ${hint(Number(value))}`}
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
      <SeriesLegend series={shown} format={format} hint={hint} />
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
  hint,
}: {
  data: { key: string; value: number }[];
  color: string;
  name: string;
  label: string;
  tick: (key: string) => string;
  format?: (value: number) => string;
  hint?: (value: number) => string;
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
                <span className="tabular-nums">
                  {format(Number(value))}
                  {hint && ` · ${hint(Number(value))}`}
                </span>
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
