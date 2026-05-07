import "server-only";
import { Repository } from "./base";
import type {
  Program,
  ProgramPhase,
  ProgramTask,
  ClientEnrollment,
  ClientTaskStatus,
  TaskStatus,
} from "@/lib/types/database";

export interface PhaseWithTaskProgress extends ProgramPhase {
  total_tasks: number;
  completed_tasks: number;
}

export interface TaskWithStatus extends ProgramTask {
  status: TaskStatus;
  completed_at: string | null;
}

export interface EnrollmentDetails {
  enrollment: ClientEnrollment;
  program: Program;
  phases: PhaseWithTaskProgress[];
  currentPhase: ProgramPhase | null;
  currentPhaseTasks: TaskWithStatus[];
  weekNumber: number;
}

export class ProgramsRepository extends Repository {
  /**
   * Active enrollment for a client with phases, current-phase tasks,
   * and per-phase progress counts. Single composite call so the page
   * can render without N+1 round-trips.
   */
  async activeEnrollmentDetails(
    clientId: string
  ): Promise<EnrollmentDetails | null> {
    // 1. Active enrollment
    const { data: enrollment, error: enrollErr } = await this.client
      .from("client_enrollments")
      .select("*")
      .eq("client_id", clientId)
      .eq("status", "active")
      .maybeSingle();

    if (enrollErr) {
      console.error("[programs.activeEnrollmentDetails:enrollment]", enrollErr);
      throw enrollErr;
    }
    if (!enrollment) return null;

    // 2. Program
    const { data: program, error: progErr } = await this.client
      .from("programs")
      .select("*")
      .eq("id", enrollment.program_id)
      .single();

    if (progErr) {
      console.error("[programs.activeEnrollmentDetails:program]", progErr);
      throw progErr;
    }

    // 3. Phases for this program
    const { data: phasesRaw, error: phasesErr } = await this.client
      .from("program_phases")
      .select("*")
      .eq("program_id", enrollment.program_id)
      .order("sequence", { ascending: true });

    if (phasesErr) {
      console.error("[programs.activeEnrollmentDetails:phases]", phasesErr);
      throw phasesErr;
    }
    const phases = (phasesRaw ?? []) as ProgramPhase[];

    // 4. All tasks for this program (one query, group client-side)
    const phaseIds = phases.map((p) => p.id);
    const { data: tasksRaw, error: tasksErr } = await this.client
      .from("program_tasks")
      .select("*")
      .in("phase_id", phaseIds.length ? phaseIds : ["00000000-0000-0000-0000-000000000000"])
      .order("sequence", { ascending: true });

    if (tasksErr) {
      console.error("[programs.activeEnrollmentDetails:tasks]", tasksErr);
      throw tasksErr;
    }
    const allTasks = (tasksRaw ?? []) as ProgramTask[];

    // 5. Task statuses for this enrollment
    const { data: statusRaw, error: statusErr } = await this.client
      .from("client_task_status")
      .select("*")
      .eq("enrollment_id", enrollment.id);

    if (statusErr) {
      console.error("[programs.activeEnrollmentDetails:status]", statusErr);
      throw statusErr;
    }
    const statusByTask = new Map(
      (statusRaw ?? []).map((s: ClientTaskStatus) => [s.task_id, s])
    );

    // Compute per-phase progress
    const phasesWithProgress: PhaseWithTaskProgress[] = phases.map((phase) => {
      const phaseTasks = allTasks.filter((t) => t.phase_id === phase.id);
      const completed = phaseTasks.filter(
        (t) => statusByTask.get(t.id)?.status === "complete"
      ).length;
      return {
        ...phase,
        total_tasks: phaseTasks.length,
        completed_tasks: completed,
      };
    });

    // Current-phase tasks with status
    const currentPhase =
      phases.find((p) => p.id === enrollment.current_phase_id) ?? phases[0] ?? null;

    const currentPhaseTasks: TaskWithStatus[] = currentPhase
      ? allTasks
          .filter((t) => t.phase_id === currentPhase.id)
          .map((t) => {
            const s = statusByTask.get(t.id);
            return {
              ...t,
              status: s?.status ?? "pending",
              completed_at: s?.completed_at ?? null,
            };
          })
      : [];

    // Week number (1-indexed)
    const startedAt = new Date(enrollment.started_at);
    const weekNumber =
      Math.floor((Date.now() - startedAt.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

    return {
      enrollment,
      program: program as Program,
      phases: phasesWithProgress,
      currentPhase,
      currentPhaseTasks,
      weekNumber,
    };
  }

  /**
   * Mark a task as complete (or revert to pending).
   * Inserts a status row if none exists yet.
   */
  async setTaskStatus(input: {
    enrollment_id: string;
    task_id: string;
    status: TaskStatus;
    completed_by: string;
  }): Promise<void> {
    const completedAt = input.status === "complete" ? new Date().toISOString() : null;
    const { error } = await this.client
      .from("client_task_status")
      .upsert(
        {
          enrollment_id: input.enrollment_id,
          task_id: input.task_id,
          status: input.status,
          completed_at: completedAt,
          completed_by: input.status === "complete" ? input.completed_by : null,
        },
        { onConflict: "enrollment_id,task_id" }
      );

    if (error) {
      console.error("[programs.setTaskStatus]", error);
      throw error;
    }
  }
}

export const programsRepo = new ProgramsRepository();

// ─── Admin-facing extensions ────────────────────────────────
// These methods power the admin catalog view. Read-only for beta;
// program editing happens via SQL migrations.

export interface ProgramCatalogEntry extends Program {
  phases: ProgramPhase[];
  totalTasks: number;
  enrolledClientCount: number;
}

declare module "./programs" {
  interface ProgramsRepository {
    listForAdmin(): Promise<ProgramCatalogEntry[]>;
  }
}

ProgramsRepository.prototype.listForAdmin = async function (): Promise<
  ProgramCatalogEntry[]
> {
  const [programsR, phasesR, tasksR, enrollmentsR] = await Promise.all([
    this.client.from("programs").select("*").order("created_at", { ascending: true }),
    this.client.from("program_phases").select("*").order("sequence", { ascending: true }),
    this.client.from("program_tasks").select("phase_id"),
    this.client
      .from("client_enrollments")
      .select("program_id")
      .eq("status", "active"),
  ]);

  if (programsR.error) throw programsR.error;

  const phasesByProgram = new Map<string, ProgramPhase[]>();
  for (const p of (phasesR.data ?? []) as ProgramPhase[]) {
    const list = phasesByProgram.get(p.program_id) ?? [];
    list.push(p);
    phasesByProgram.set(p.program_id, list);
  }

  // Count tasks per program by joining via phase membership
  const taskCountByPhase = new Map<string, number>();
  for (const t of tasksR.data ?? []) {
    taskCountByPhase.set(t.phase_id, (taskCountByPhase.get(t.phase_id) ?? 0) + 1);
  }

  const enrollmentCountByProgram = new Map<string, number>();
  for (const e of enrollmentsR.data ?? []) {
    enrollmentCountByProgram.set(
      e.program_id,
      (enrollmentCountByProgram.get(e.program_id) ?? 0) + 1
    );
  }

  return ((programsR.data ?? []) as Program[]).map((p) => {
    const phases = phasesByProgram.get(p.id) ?? [];
    const totalTasks = phases.reduce(
      (acc, ph) => acc + (taskCountByPhase.get(ph.id) ?? 0),
      0
    );
    return {
      ...p,
      phases,
      totalTasks,
      enrolledClientCount: enrollmentCountByProgram.get(p.id) ?? 0,
    };
  });
};
