import Link from "next/link";
import { AlertTriangle, Users, CheckCircle, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/domain/metric-card";
import { requireRole } from "@/lib/supabase/auth";
import { coachingRepo, type PipelineRow } from "@/lib/repositories";

export default async function PipelinePage() {
  const coach = await requireRole("coach");
  const rows = await coachingRepo.listPipelineForCoach(coach.id);

  // Aggregate stats for the summary cards
  const totalClients = rows.length;
  const atRisk = rows.filter((r) => r.risk === "high").length;
  const avgCompliance =
    rows.length > 0
      ? Math.round(
          rows.reduce((acc, r) => acc + r.compliance_pct, 0) / rows.length
        )
      : 0;
  const overdueCheckIns = rows.filter(
    (r) => r.last_check_in_days !== null && r.last_check_in_days > 7
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="All clients"
        title="Pipeline"
        description="Every assigned client, sorted by attention needed. Tap a row to open their file."
      />

      {/* ─── Summary row ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Active clients"
          value={totalClients}
          icon={Users}
          accentColor="success"
        />
        <MetricCard
          label="At risk"
          value={atRisk}
          sub={atRisk > 0 ? "High-priority outreach" : "All clear"}
          icon={AlertTriangle}
          accentColor={atRisk > 0 ? "danger" : "success"}
        />
        <MetricCard
          label="Avg compliance"
          value={`${avgCompliance}%`}
          sub="Last 7 days"
          icon={CheckCircle}
          accentColor={avgCompliance >= 80 ? "success" : "warning"}
        />
        <MetricCard
          label="Overdue check-ins"
          value={overdueCheckIns}
          sub="Over 7 days quiet"
          icon={Clock}
          accentColor={overdueCheckIns > 0 ? "warning" : "success"}
        />
      </div>

      {/* ─── Pipeline table ─────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="text-body text-muted-foreground">
            No clients assigned yet.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-card/40">
                {[
                  "Client",
                  "Phase",
                  "Week",
                  "Compliance",
                  "Risk",
                  "Last check-in",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 overline first:pl-6"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <PipelineRowView key={row.client_id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── Row rendering ───────────────────────────────────────────

function PipelineRowView({ row }: { row: PipelineRow }) {
  const complianceColor =
    row.compliance_pct >= 80
      ? "bg-success"
      : row.compliance_pct >= 60
      ? "bg-warning"
      : "bg-danger";

  const riskBadge = {
    low: { label: "LOW", cls: "text-success bg-success/10 border-success/20" },
    medium: {
      label: "MED",
      cls: "text-warning bg-warning/10 border-warning/20",
    },
    high: { label: "HIGH", cls: "text-danger bg-danger/10 border-danger/20" },
  }[row.risk];

  const checkInText =
    row.last_check_in_days === null
      ? "—"
      : row.last_check_in_days === 0
      ? "Today"
      : row.last_check_in_days === 1
      ? "1 day ago"
      : `${row.last_check_in_days} days ago`;

  const checkInColor =
    row.last_check_in_days === null || row.last_check_in_days > 7
      ? "text-warning"
      : "text-muted-foreground";

  const initials = row.display_name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <tr className="border-b border-border last:border-0 hover:bg-card/60 transition-colors group">
      <td className="px-4 py-3 pl-6">
        <Link
          href={`/coach/clients/${row.client_id}`}
          className="flex items-center gap-3 min-w-0"
        >
          <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center text-success font-semibold text-xs shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {row.display_name}
            </div>
            <div className="text-caption text-muted-foreground truncate">
              {row.email}
            </div>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3">
        <span className="text-caption text-foreground">
          {row.phase_name ?? "—"}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-caption text-muted-foreground tabular-nums">
          {row.weeks_in_program !== null ? `W${row.weeks_in_program}` : "—"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 min-w-[120px]">
          <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className={`h-full ${complianceColor} transition-all`}
              style={{ width: `${row.compliance_pct}%` }}
            />
          </div>
          <span className="text-caption font-semibold tabular-nums w-9 text-right">
            {row.compliance_pct}%
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider border ${riskBadge.cls}`}
        >
          {riskBadge.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`text-caption ${checkInColor}`}>{checkInText}</span>
      </td>
      <td className="px-4 py-3 pr-6">
        <Link
          href={`/coach/clients/${row.client_id}`}
          className="text-caption text-success font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Open →
        </Link>
      </td>
    </tr>
  );
}
