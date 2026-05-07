/**
 * Shared chart theme values.
 *
 * Recharts doesn't read Tailwind, so color tokens are duplicated here
 * as hex strings. Kept in one file so a brand-color change is a single
 * edit across every chart.
 */

export const chartColors = {
  foreground: "#EDEFF7",        // cloud
  muted: "#9DA2B3",             // space
  border: "#2A3F60",            // navy-500
  grid: "rgba(180, 193, 221, 0.08)",
  success: "#10B981",
  successGlow: "rgba(16, 185, 129, 0.25)",
  warn: "#F59E0B",
  danger: "#EF4444",
  info: "#60A5FA",
  purple: "#A78BFA",
  deep: "#6366F1",              // indigo for deep-sleep bars
};

export const chartAxisStyle = {
  fill: chartColors.muted,
  fontSize: 11,
  fontWeight: 500,
};

export const chartTooltipStyle = {
  background: "#192C4C",        // navy-600 card
  border: `1px solid ${chartColors.border}`,
  borderRadius: 10,
  color: chartColors.foreground,
  fontSize: 12,
  padding: "8px 12px",
  boxShadow: "0 12px 32px -8px rgba(9, 20, 37, 0.4)",
};

/**
 * Format a YYYY-MM-DD date as "Mar 21" for chart axis ticks.
 */
export function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
