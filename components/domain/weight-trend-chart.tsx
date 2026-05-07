"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  chartColors,
  chartAxisStyle,
  chartTooltipStyle,
  formatShortDate,
} from "./chart-theme";

interface WeightPoint {
  date: string; // YYYY-MM-DD
  weight: number;
}

interface WeightTrendChartProps {
  data: WeightPoint[];
  height?: number;
}

export function WeightTrendChart({ data, height = 180 }: WeightTrendChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-caption"
        style={{ height }}
      >
        No weight data logged yet.
      </div>
    );
  }

  const formatted = data.map((p) => ({
    date: formatShortDate(p.date),
    weight: p.weight,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formatted} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColors.success} stopOpacity={0.3} />
            <stop offset="100%" stopColor={chartColors.success} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={chartAxisStyle}
          axisLine={false}
          tickLine={false}
          minTickGap={32}
        />
        <YAxis
          domain={["dataMin - 2", "dataMax + 2"]}
          tick={chartAxisStyle}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip contentStyle={chartTooltipStyle} cursor={{ stroke: chartColors.grid }} />
        <Area
          type="monotone"
          dataKey="weight"
          stroke={chartColors.success}
          fill="url(#weightGrad)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: chartColors.success, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
