import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { FunctionalMetricLatest } from "@/lib/repositories";

interface FunctionalMetricRowProps {
  metric: FunctionalMetricLatest;
}

export function FunctionalMetricRow({ metric }: FunctionalMetricRowProps) {
  // Compute trend
  let changePercent: number | null = null;
  let trendDir: "up" | "down" | "flat" = "flat";
  let isImproving: boolean | null = null;

  if (metric.previous_value !== null && metric.previous_value !== 0) {
    changePercent = ((metric.value - metric.previous_value) / metric.previous_value) * 100;
    trendDir = Math.abs(changePercent) < 0.5 ? "flat" : changePercent > 0 ? "up" : "down";
    if (trendDir !== "flat") {
      isImproving = metric.lower_is_better
        ? metric.value < metric.previous_value
        : metric.value > metric.previous_value;
    }
  }

  // Progress: baseline -> current -> target
  let progressPct = 0;
  if (metric.baseline_value !== null && metric.target_value !== null) {
    const totalRange = metric.lower_is_better
      ? metric.baseline_value - metric.target_value
      : metric.target_value - metric.baseline_value;
    const traveled = metric.lower_is_better
      ? metric.baseline_value - metric.value
      : metric.value - metric.baseline_value;
    progressPct = totalRange === 0 ? 0 : (traveled / totalRange) * 100;
    progressPct = Math.max(0, Math.min(100, progressPct));
  }

  const TrendIcon =
    trendDir === "up" ? TrendingUp : trendDir === "down" ? TrendingDown : Minus;

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-body font-semibold text-foreground">{metric.metric_name}</span>
        <div className="flex items-center gap-2.5">
          <span className="text-lg font-extrabold tracking-tight tabular-nums">
            {formatValue(metric.value)}
          </span>
          <span className="text-caption text-muted-foreground">{metric.unit}</span>
          {changePercent !== null && trendDir !== "flat" && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-caption font-semibold",
                isImproving ? "text-success" : "text-danger"
              )}
            >
              <TrendIcon size={12} strokeWidth={2.5} />
              {Math.abs(changePercent).toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {metric.baseline_value !== null && metric.target_value !== null && (
        <>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-success/40 to-success rounded-full transition-all duration-1000"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-overline text-muted-foreground">
            <span>Baseline: {formatValue(metric.baseline_value)}</span>
            <span className="text-success font-bold">
              {progressPct.toFixed(0)}% to target
            </span>
            <span>Target: {formatValue(metric.target_value)}</span>
          </div>
        </>
      )}
    </div>
  );
}

function formatValue(v: number): string {
  // Trim trailing zeros for nicer display: 5.0 -> 5, 6.5 -> 6.5
  return Number.isInteger(v) ? v.toString() : v.toFixed(1);
}
