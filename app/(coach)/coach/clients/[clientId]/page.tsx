import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Heart,
  Brain,
  Moon,
  TrendingDown,
  TrendingUp,
  Pill,
  MessageSquare,
  Calendar,
  Mail,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/supabase/auth";
import {
  coachingRepo,
  coachNotesRepo,
  supplementsRepo,
  programsRepo,
} from "@/lib/repositories";
import { CoachNote } from "@/components/domain/coach-note";
import { CoachNoteComposer } from "./note-composer";
import { recordClientViewAction } from "./actions";

interface PageProps {
  params: { clientId: string };
}

export default async function ClientDetailPage({ params }: PageProps) {
  const coach = await requireRole("coach");
  const clientId = params.clientId;

  // Fire-and-forget view audit. Runs on every render (refresh, nav back) which
  // is the correct behavior — we want a record of every inspection.
  recordClientViewAction(clientId).catch(() => {
    /* already logged inside the action */
  });

  const [summary, notes, supplements, enrollment] = await Promise.all([
    coachingRepo.clientDetailSummary(clientId),
    coachNotesRepo.listForClient(clientId, 10),
    supplementsRepo.listActiveForClient(clientId),
    programsRepo.activeEnrollmentDetails(clientId),
  ]);

  if (!summary) {
    notFound();
  }

  const sleepHours =
    summary.latest_sleep_min !== null
      ? (summary.latest_sleep_min / 60).toFixed(1)
      : null;
  const weightDeltaPositive =
    summary.weight_delta_lbs !== null && summary.weight_delta_lbs > 0;

  const lastCheckInDays =
    summary.last_check_in_at !== null
      ? Math.floor(
          (Date.now() - new Date(summary.last_check_in_at).getTime()) /
            (24 * 60 * 60 * 1000)
        )
      : null;

  return (
    <>
      {/* ─── Back link ──────────────────────────────────────── */}
      <Link
        href="/coach"
        className="inline-flex items-center gap-1.5 text-caption text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to pipeline
      </Link>

      {/* ─── Client header ──────────────────────────────────── */}
      <div className="flex items-start justify-between gap-6 mb-8 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-success/20 flex items-center justify-center text-success font-bold text-lg shrink-0">
            {summary.display_name
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div>
            <h1 className="text-h2">{summary.display_name}</h1>
            <div className="flex items-center gap-3 text-caption text-muted-foreground mt-1">
              <span className="inline-flex items-center gap-1.5">
                <Mail size={11} /> {summary.email}
              </span>
              {summary.phase_name && (
                <>
                  <span className="text-border">·</span>
                  <span>{summary.phase_name}</span>
                </>
              )}
              {summary.weeks_in_program !== null && (
                <>
                  <span className="text-border">·</span>
                  <span>Week {summary.weeks_in_program}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View-as-Client is wired in Phase 5B. Placeholder here for
              visual continuity but disabled until then. */}
          <button
            type="button"
            disabled
            title="Coming in Phase 5B"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-caption border border-border rounded-md text-muted-foreground opacity-50"
          >
            View as client
          </button>
        </div>
      </div>

      {/* ─── Status strip — compact vitals scan ─────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <VitalCell
          icon={Brain}
          label="HRV"
          value={
            summary.latest_hrv !== null
              ? Math.round(summary.latest_hrv)
              : "—"
          }
          unit="ms"
          tone="accent"
        />
        <VitalCell
          icon={Heart}
          label="Resting HR"
          value={
            summary.latest_rhr !== null
              ? Math.round(summary.latest_rhr)
              : "—"
          }
          unit="bpm"
          tone="danger"
        />
        <VitalCell
          icon={Moon}
          label="Sleep"
          value={sleepHours ?? "—"}
          unit="hrs"
          tone="info"
        />
        <VitalCell
          icon={weightDeltaPositive ? TrendingUp : TrendingDown}
          label="Weight"
          value={
            summary.latest_weight_lbs !== null
              ? summary.latest_weight_lbs.toFixed(1)
              : "—"
          }
          unit="lbs"
          sub={
            summary.weight_delta_lbs !== null
              ? `${summary.weight_delta_lbs > 0 ? "+" : ""}${summary.weight_delta_lbs.toFixed(1)}`
              : undefined
          }
          subTone={
            summary.weight_delta_lbs !== null && summary.weight_delta_lbs < 0
              ? "success"
              : "muted"
          }
          tone="success"
        />
        <VitalCell
          icon={Pill}
          label="Compliance"
          value={`${summary.compliance_pct}%`}
          sub="7d adherence"
          tone={summary.compliance_pct >= 80 ? "success" : summary.compliance_pct >= 60 ? "warning" : "danger"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Left: notes column (2/3) ─────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Note composer always at top — write-first command center */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare size={16} className="text-muted-foreground" />
                New coach note
              </CardTitle>
              <CardDescription>
                Visible to client by default. Toggle to keep internal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CoachNoteComposer
                clientId={clientId}
                defaultWeekNumber={summary.weeks_in_program}
              />
            </CardContent>
          </Card>

          {/* Recent notes feed */}
          <Card>
            <CardHeader>
              <CardTitle>Recent notes</CardTitle>
              <CardDescription>
                {notes.length === 0
                  ? "No notes yet — post the first one above."
                  : `Most recent ${notes.length} ${
                      notes.length === 1 ? "note" : "notes"
                    }.`}
              </CardDescription>
            </CardHeader>
            {notes.length > 0 && (
              <CardContent className="space-y-3">
                {notes.map((note) => (
                  <CoachNote key={note.id} note={note} />
                ))}
              </CardContent>
            )}
          </Card>
        </div>

        {/* ─── Right: protocol summary (1/3) ────────────────── */}
        <div className="space-y-6">
          {/* Check-in status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar size={16} className="text-muted-foreground" />
                Last check-in
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lastCheckInDays === null ? (
                <p className="text-body text-warning">No check-ins yet</p>
              ) : (
                <div>
                  <p className="text-body">
                    <span className="font-bold tabular-nums">
                      {lastCheckInDays === 0
                        ? "Today"
                        : lastCheckInDays === 1
                        ? "Yesterday"
                        : `${lastCheckInDays} days ago`}
                    </span>
                  </p>
                  {lastCheckInDays > 7 && (
                    <Badge variant="warning" className="mt-2">
                      Overdue — reach out
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active supplement protocol */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill size={16} className="text-muted-foreground" />
                Supplement protocol
              </CardTitle>
              <CardDescription>
                {supplements.length === 0
                  ? "None prescribed."
                  : `${supplements.length} active.`}
              </CardDescription>
            </CardHeader>
            {supplements.length > 0 && (
              <CardContent className="space-y-3">
                {supplements.map((s) => {
                  const pct = s.adherencePercent ?? 0;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-caption font-semibold truncate">
                          {s.supplement.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {s.dose} · {s.frequency}
                        </div>
                      </div>
                      <span
                        className={`text-caption font-bold tabular-nums ${
                          pct >= 80
                            ? "text-success"
                            : pct >= 60
                            ? "text-warning"
                            : "text-danger"
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>

          {/* Program phase progress */}
          {enrollment && enrollment.currentPhase && (() => {
            const phaseWithProgress = enrollment.phases.find(
              (p) => p.id === enrollment.currentPhase!.id
            );
            if (!phaseWithProgress) return null;
            const progressPct =
              phaseWithProgress.total_tasks > 0
                ? Math.round(
                    (phaseWithProgress.completed_tasks /
                      phaseWithProgress.total_tasks) *
                      100
                  )
                : 0;
            return (
              <Card>
                <CardHeader>
                  <CardTitle>Phase progress</CardTitle>
                  <CardDescription>
                    {enrollment.currentPhase.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-body font-bold tabular-nums">
                      {phaseWithProgress.completed_tasks}/
                      {phaseWithProgress.total_tasks}
                    </span>
                    <span className="text-caption text-muted-foreground">
                      {progressPct}% complete
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full bg-success transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      </div>
    </>
  );
}

// ─── Local tiny component for vital cells ───────────────────
function VitalCell({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  subTone,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  subTone?: "muted" | "success" | "warning" | "danger";
  tone: "success" | "warning" | "danger" | "info" | "accent";
}) {
  const toneCls = {
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    info: "text-info",
    accent: "text-accent",
  }[tone];
  const subCls =
    subTone === "success"
      ? "text-success"
      : subTone === "danger"
      ? "text-danger"
      : subTone === "warning"
      ? "text-warning"
      : "text-muted-foreground";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 overline mb-2">
        <Icon size={11} className={toneCls} />
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold tabular-nums">{value}</span>
        {unit && <span className="text-caption text-muted-foreground">{unit}</span>}
      </div>
      {sub && (
        <div className={`text-[10px] font-semibold tabular-nums mt-0.5 ${subCls}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
