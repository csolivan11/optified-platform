import { cn } from "@/lib/utils/cn";

interface ScoreRingProps {
  score: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}

/**
 * Premium composite score display. Returns "—" gracefully when score is null
 * (no data yet) so the UI doesn't render a misleading 0.
 *
 * Color bands:
 *   80-100 = success (green)
 *   60-79  = warning (amber)
 *   0-59   = danger (red)
 *   null   = muted (no data)
 */
export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 6,
  label,
  sublabel,
  className,
}: ScoreRingProps) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = score ?? 0;
  const offset = circumference - (clamped / 100) * circumference;

  let color = "hsl(var(--muted-foreground))";
  if (score !== null) {
    color =
      score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444";
  }

  const fontSize = size * 0.26;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5",
        className
      )}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          style={{ transform: "rotate(-90deg)" }}
          className="overflow-visible"
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          {score !== null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{
                transition: "stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
                filter: `drop-shadow(0 0 6px ${color}40)`,
              }}
            />
          )}
        </svg>
        {/* Center text — absolutely positioned so we don't fight SVG rotation */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-extrabold tracking-tight text-foreground tabular-nums"
            style={{ fontSize }}
          >
            {score !== null ? score : "—"}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-sm font-semibold text-foreground tracking-tight">
          {label}
        </span>
      )}
      {sublabel && (
        <span className="text-overline text-muted-foreground">{sublabel}</span>
      )}
    </div>
  );
}
