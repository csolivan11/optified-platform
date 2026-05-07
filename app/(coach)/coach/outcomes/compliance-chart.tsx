"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  chartColors,
  chartAxisStyle,
  chartTooltipStyle,
  formatShortDate,
} from "@/components/domain/chart-theme";

interface Point {
  week_start: string;
  compliance_pct: number;
}

interface Props {
  data: Point[];
  height?: number;
}

export function ComplianceTrendChart({ data, height = 220 }: Props) {
  const formatted = data.map((p) => ({
    week: formatShortDate(p.week_start),
    pct: p.compliance_pct,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={formatted}
        barSize={48}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
        <XAxis
          dataKey="week"
          tick={chartAxisStyle}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={chartAxisStyle}
          axisLine={false}
          tickLine={false}
          width={40}
          label={{
            value: "%",
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
          formatter={(value: number) => [`${value}%`, "Compliance"]}
        />
        <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
          {formatted.map((p, i) => (
            <Cell
              key={i}
              fill={
                p.pct >= 80
                  ? chartColors.success
                  : p.pct >= 60
                  ? chartColors.warn
                  : chartColors.danger
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
