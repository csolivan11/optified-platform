"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  chartColors,
  chartAxisStyle,
  chartTooltipStyle,
  formatShortDate,
} from "./chart-theme";

interface HrvPoint {
  date: string;
  hrv?: number;
  rhr?: number;
}

interface HrvChartProps {
  data: HrvPoint[];
  height?: number;
}

export function HrvChart({ data, height = 240 }: HrvChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-caption"
        style={{ height }}
      >
        No wearable data yet. Connect your Oura ring to start tracking.
      </div>
    );
  }

  const formatted = data.map((p) => ({
    date: formatShortDate(p.date),
    hrv: p.hrv,
    rhr: p.rhr,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={formatted} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={chartAxisStyle}
          axisLine={false}
          tickLine={false}
          minTickGap={32}
        />
        <YAxis
          yAxisId="hrv"
          tick={chartAxisStyle}
          axisLine={false}
          tickLine={false}
          width={40}
          label={{
            value: "HRV (ms)",
            angle: -90,
            position: "insideLeft",
            fill: chartColors.muted,
            fontSize: 10,
            offset: 12,
          }}
        />
        <YAxis
          yAxisId="rhr"
          orientation="right"
          tick={chartAxisStyle}
          axisLine={false}
          tickLine={false}
          width={40}
          label={{
            value: "RHR (bpm)",
            angle: 90,
            position: "insideRight",
            fill: chartColors.muted,
            fontSize: 10,
            offset: 12,
          }}
        />
        <Tooltip contentStyle={chartTooltipStyle} cursor={{ stroke: chartColors.grid }} />
        <Legend
          wrapperStyle={{ paddingTop: 8, fontSize: 12, color: chartColors.muted }}
          iconType="circle"
        />
        <Line
          yAxisId="hrv"
          type="monotone"
          dataKey="hrv"
          stroke={chartColors.purple}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: chartColors.purple, strokeWidth: 0 }}
          name="HRV"
        />
        <Line
          yAxisId="rhr"
          type="monotone"
          dataKey="rhr"
          stroke={chartColors.danger}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: chartColors.danger, strokeWidth: 0 }}
          name="Resting HR"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
