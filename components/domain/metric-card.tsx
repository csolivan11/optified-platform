import { type LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "flat";
  trendIsGood?: boolean;
  accentColor?: "success" | "info" | "warning" | "accent" | "danger";
  className?: string;
}

const ACCENT_MAP = {
  success: { bg: "bg-success/10", fg: "text-success", border: "border-success/20" },
  info: { bg: "bg-info/10", fg: "text-info", border: "border-info/20" },
  warning: { bg: "bg-warning/10", fg: "text-warning", border: "border-warning/20" },
  accent: { bg: "bg-accent/10", fg: "text-accent", border: "border-accent/20" },
  danger: { bg: "bg-danger/10", fg: "text-danger", border: "border-danger/20" },
};

export function MetricCard({
  label,
  value,
  unit,
  sub,
  icon: Icon,
  trend,
  trendIsGood,
  accentColor = "success",
  className,
}: MetricCardProps) {
  const accent = ACCENT_MAP[accentColor];
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend && trendIsGood !== undefined
      ? trendIsGood
        ? "text-success"
        : "text-danger"
      : "text-muted-foreground";

  return (
    <div
      className={cn(
        "flex-1 min-w-[160px] rounded-lg border border-border bg-card p-6 transition-all duration-200 hover:shadow-elevation-2",
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div
            className={cn(
              "w-9 h-9 rounded-md flex items-center justify-center border",
              accent.bg,
              accent.border
            )}
          >
            <Icon size={16} className={accent.fg} />
          </div>
        )}
        {trend && (
          <TrendIcon size={14} className={trendColor} strokeWidth={2.5} />
        )}
      </div>
      <div className="overline mb-2">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-extrabold tracking-tight tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="text-sm text-muted-foreground">{unit}</span>
        )}
      </div>
      {sub && (
        <div className="text-caption text-muted-foreground mt-1">{sub}</div>
      )}
    </div>
  );
}
