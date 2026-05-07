import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhaseTimeline } from "@/components/domain/phase-timeline";
import { TaskChecklist } from "@/components/domain/task-checklist";
import { CoachNote } from "@/components/domain/coach-note";
import { requireClientContext } from "@/lib/supabase/auth";
import { programsRepo, coachNotesRepo } from "@/lib/repositories";
import { toggleTaskAction } from "./actions";

export default async function ProgramPage() {
  const ctx = await requireClientContext();
  const clientId = ctx.effectiveClientId;

  const [enrollmentDetails, notes] = await Promise.all([
    programsRepo.activeEnrollmentDetails(clientId),
    coachNotesRepo.listForClient(clientId, 5),
  ]);

  if (!enrollmentDetails) {
    return (
      <>
        <PageHeader
          eyebrow="12-Month Journey"
          title="Your Program"
          description="Phase progression, task checklists, and coach notes."
        />
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-body text-muted-foreground">
              You&apos;re not yet enrolled in a program. Your coach will set this up shortly.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  const { enrollment, program, phases, currentPhase, currentPhaseTasks, weekNumber } =
    enrollmentDetails;

  const phaseProgressPct =
    currentPhase && currentPhase.id
      ? (() => {
          const cp = phases.find((p) => p.id === currentPhase.id);
          if (!cp || cp.total_tasks === 0) return 0;
          return Math.round((cp.completed_tasks / cp.total_tasks) * 100);
        })()
      : 0;

  return (
    <>
      <PageHeader
        eyebrow="Your Journey"
        title={program.name}
        description={`${program.description ?? ""}`}
      >
        <Badge variant="success">
          Week {weekNumber} of {program.duration_weeks}
        </Badge>
      </PageHeader>

      {/* ─── Phase Timeline ────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Program Phases</CardTitle>
          <CardDescription>
            Your journey from intake through long-term sustainability.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PhaseTimeline phases={phases} currentPhaseId={currentPhase?.id ?? null} />
        </CardContent>
      </Card>

      {/* ─── Current Phase Tasks ───────────────────────────── */}
      {currentPhase && (
        <Card className="mb-6 border-success/30">
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="overline text-success mb-1">Current Phase</div>
                <CardTitle>{currentPhase.name}</CardTitle>
                {currentPhase.description && (
                  <CardDescription className="mt-1.5">
                    {currentPhase.description}
                  </CardDescription>
                )}
              </div>
              <div className="text-right">
                <div className="text-3xl font-extrabold tracking-tight text-success tabular-nums">
                  {phaseProgressPct}%
                </div>
                <div className="text-overline text-muted-foreground">complete</div>
              </div>
            </div>
            {/* Linear progress bar */}
            <div className="mt-4 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-success/40 to-success rounded-full transition-all duration-1000"
                style={{ width: `${phaseProgressPct}%` }}
              />
            </div>
          </CardHeader>
          <CardContent>
            <TaskChecklist
              enrollmentId={enrollment.id}
              tasks={currentPhaseTasks}
              onToggle={toggleTaskAction}
            />
          </CardContent>
        </Card>
      )}

      {/* ─── Coach Notes ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Coach Notes</CardTitle>
          <CardDescription>
            Most recent observations and adjustments from your coach.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-body text-muted-foreground py-2">
              No notes yet. Your coach will start adding observations after your first check-in.
            </p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <CoachNote key={note.id} note={note} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
