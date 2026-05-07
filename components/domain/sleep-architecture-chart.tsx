"use client";

import {
  BarChart,
  Bar,
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
} from "./chart-theme";

interface SleepPoint {
  day: string;   // "Mon"
  deep: number;  // minutes
  rem: number;
  light: number;
}

interface SleepArchitectureChartProps {
  data: SleepPoint[];
  height?: number;
}

export function SleepArchitectureChart({
  data,
  height = 220,
}: SleepArchitectureChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-caption"
        style={{ height }}
      >
        No sleep data yet.
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          barSize={28}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tick={chartAxisStyle}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={chartAxisStyle}
            axisLine={false}
            tickLine={false}
            width={40}
            label={{
              value: "minutes",
              angle: -90,
              position: "insideLeft",
              fill: chartColors.muted,
              fontSize: 10,
              offset: 12,
            }}
          />
          <Tooltip
            contentStyle={chartTooltipStyle}
            cursor={{ fill: chartColors.grid }}
          />
          <Bar dataKey="deep" stackId="sleep" fill={chartColors.deep} name="Deep" />
          <Bar dataKey="rem" stackId="sleep" fill={chartColors.purple} name="REM" />
          <Bar
            dataKey="light"
            stackId="sleep"
            fill={chartColors.info}
            name="Light"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex items-center justify-center gap-5 mt-3">
        {[
          { label: "Deep", color: chartColors.deep },
          { label: "REM", color: chartColors.purple },
          { label: "Light", color: chartColors.info },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: item.color }}
            />
            <span className="text-caption text-muted-foreground">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
