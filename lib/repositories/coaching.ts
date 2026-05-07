import "server-only";
import { Repository } from "./base";

/**
 * Coaching repository — produces the aggregated views that power the
 * coach dashboard. These are intentionally denormalized: a PipelineRow
 * collapses data from profiles, enrollments, phases, adherence, and
 * check-ins into a single record so the coach UI can render a table
 * without N+1 queries per row.
 *
 * Risk tier is computed heuristically. Week-1 values are generous;
 * later weeks apply tighter thresholds. The logic is intentionally
 * readable in one place — this is a rule set that will evolve.
 */

export type RiskTier = "low" | "medium" | "high";

export interface PipelineRow {
  client_id: string;
  email: string;
  display_name: string;
  phase_name: string | null;
  weeks_in_program: number | null;
  compliance_pct: number;         // 0–100; supplement adherence across last 7d
  risk: RiskTier;
  last_check_in_days: number | null;
  open_alerts: number;
}

export interface ClientDetailSummary {
  client_id: string;
  display_name: string;
  email: string;
  phase_name: string | null;
  weeks_in_program: number | null;
  latest_weight_lbs: number | null;
  weight_delta_lbs: number | null;  // vs. first logged weight
  latest_hrv: number | null;
  latest_rhr: number | null;
  latest_sleep_min: number | null;
  compliance_pct: number;
  last_check_in_at: string | null;
}

export class CoachingRepository extends Repository {
  /**
   * Build pipeline rows for every client this coach is assigned to.
   * Admins see every client. Uses the user-scoped client so RLS
   * enforces assignment visibility automatically.
   */
  async listPipelineForCoach(coachId: string): Promise<PipelineRow[]> {
    // Step 1: get assigned clients via coach_assignments → profiles
    const { data: assignments, error: aErr } = await this.client
      .from("coach_assignments")
      .select(
        `
        client_id,
        client:profiles!coach_assignments_client_id_fkey(
          id, email, first_name, last_name, display_name
        )
        `
      )
      .eq("coach_id", coachId)
      .is("unassigned_at", null);

    if (aErr) {
      console.error("[coaching.listPipelineForCoach:assignments]", aErr);
      throw aErr;
    }

    const clientIds = (assignments ?? []).map(
      (a: { client_id: string }) => a.client_id
    );

    if (clientIds.length === 0) return [];

    // Step 2: fetch per-client aggregates in parallel
    const [enrollmentsR, adherenceR, checkInsR, phasesR] = await Promise.all([
      this.client
        .from("client_enrollments")
        .select("client_id, started_at, current_phase_id, status")
        .in("client_id", clientIds)
        .eq("status", "active"),

      // Supplement adherence for last 7 days across all supplements
      this.client
        .from("client_supplements")
        .select(
          `
          client_id,
          adherence:supplement_adherence(date, taken)
          `
        )
        .in("client_id", clientIds)
        .eq("active", true),

      this.client
        .from("client_check_ins")
        .select("client_id, submitted_at")
        .in("client_id", clientIds)
        .order("submitted_at", { ascending: false }),

      this.client
        .from("program_phases")
        .select("id, name, sequence"),
    ]);

    if (enrollmentsR.error) {
      console.error("[coaching.listPipeline:enrollments]", enrollmentsR.error);
      throw enrollmentsR.error;
    }

    const phasesById = new Map<string, string>();
    for (const p of phasesR.data ?? []) {
      phasesById.set(p.id, p.name);
    }

    const enrollmentByClient = new Map<
      string,
      { started_at: string; current_phase_id: string | null }
    >();
    for (const e of enrollmentsR.data ?? []) {
      enrollmentByClient.set(e.client_id, {
        started_at: e.started_at,
        current_phase_id: e.current_phase_id,
      });
    }

    // Compliance: count of taken vs. scheduled across last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const complianceByClient = new Map<
      string,
      { taken: number; total: number }
    >();
    for (const cs of (adherenceR.data ?? []) as Array<{
      client_id: string;
      adherence: Array<{ date: string; taken: boolean }>;
    }>) {
      const existing = complianceByClient.get(cs.client_id) ?? {
        taken: 0,
        total: 0,
      };
      for (const a of cs.adherence ?? []) {
        if (new Date(a.date) >= sevenDaysAgo) {
          existing.total += 1;
          if (a.taken) existing.taken += 1;
        }
      }
      complianceByClient.set(cs.client_id, existing);
    }

    // Last check-in
    const lastCheckInByClient = new Map<string, string>();
    for (const c of checkInsR.data ?? []) {
      if (!lastCheckInByClient.has(c.client_id)) {
        lastCheckInByClient.set(c.client_id, c.submitted_at);
      }
    }

    // Step 3: compose rows
    const rows: PipelineRow[] = (assignments ?? []).map(
      (a: {
        client_id: string;
        client: {
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          display_name: string | null;
        };
      }) => {
        const profile = a.client;
        const enrollment = enrollmentByClient.get(a.client_id);
        const compliance = complianceByClient.get(a.client_id);
        const compliancePct =
          compliance && compliance.total > 0
            ? Math.round((compliance.taken / compliance.total) * 100)
            : 0;

        const weeksInProgram = enrollment
          ? Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(enrollment.started_at).getTime()) /
                  (7 * 24 * 60 * 60 * 1000)
              )
            )
          : null;

        const phaseName = enrollment?.current_phase_id
          ? phasesById.get(enrollment.current_phase_id) ?? null
          : null;

        const lastCheckIn = lastCheckInByClient.get(a.client_id);
        const lastCheckInDays = lastCheckIn
          ? Math.floor(
              (Date.now() - new Date(lastCheckIn).getTime()) /
                (24 * 60 * 60 * 1000)
            )
          : null;

        const risk = computeRisk({
          weeksInProgram,
          compliancePct,
          lastCheckInDays,
        });

        const displayName =
          profile.display_name ??
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
          profile.email;

        return {
          client_id: a.client_id,
          email: profile.email,
          display_name: displayName,
          phase_name: phaseName,
          weeks_in_program: weeksInProgram,
          compliance_pct: compliancePct,
          risk,
          last_check_in_days: lastCheckInDays,
          open_alerts: 0, // Phase 5B will populate
        };
      }
    );

    // Risk-first sort, then newest to oldest by weeks
    const riskOrder: Record<RiskTier, number> = { high: 0, medium: 1, low: 2 };
    rows.sort((a, b) => {
      const r = riskOrder[a.risk] - riskOrder[b.risk];
      if (r !== 0) return r;
      return (a.weeks_in_program ?? 999) - (b.weeks_in_program ?? 999);
    });

    return rows;
  }

  /**
   * Command-center summary for a single client — what a coach needs
   * on first glance when opening their file.
   */
  async clientDetailSummary(
    clientId: string
  ): Promise<ClientDetailSummary | null> {
    const [profileR, enrollmentR, phasesR, weightR, firstWeightR, wearableR, complianceR, lastCheckInR] =
      await Promise.all([
        this.client
          .from("profiles")
          .select("id, email, first_name, last_name, display_name")
          .eq("id", clientId)
          .maybeSingle(),

        this.client
          .from("client_enrollments")
          .select("started_at, current_phase_id")
          .eq("client_id", clientId)
          .eq("status", "active")
          .maybeSingle(),

        this.client.from("program_phases").select("id, name"),

        this.client
          .from("daily_logs")
          .select("weight_lbs, date")
          .eq("client_id", clientId)
          .not("weight_lbs", "is", null)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle(),

        this.client
          .from("daily_logs")
          .select("weight_lbs")
          .eq("client_id", clientId)
          .not("weight_lbs", "is", null)
          .order("date", { ascending: true })
          .limit(1)
          .maybeSingle(),

        // Latest HRV, RHR, sleep from wearable data — last 48h
        this.client
          .from("wearable_data_points")
          .select("metric, value, recorded_at")
          .eq("client_id", clientId)
          .in("metric", ["hrv_rmssd", "resting_hr", "sleep_total_min"])
          .gte(
            "recorded_at",
            new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
          )
          .order("recorded_at", { ascending: false }),

        // Last 7 days adherence
        this.client
          .from("client_supplements")
          .select(
            `
            adherence:supplement_adherence(date, taken)
            `
          )
          .eq("client_id", clientId)
          .eq("active", true),

        this.client
          .from("client_check_ins")
          .select("submitted_at")
          .eq("client_id", clientId)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (!profileR.data) return null;

    const phasesById = new Map<string, string>();
    for (const p of phasesR.data ?? []) {
      phasesById.set(p.id, p.name);
    }

    const phaseName = enrollmentR.data?.current_phase_id
      ? phasesById.get(enrollmentR.data.current_phase_id) ?? null
      : null;
    const weeksInProgram = enrollmentR.data?.started_at
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(enrollmentR.data.started_at).getTime()) /
              (7 * 24 * 60 * 60 * 1000)
          )
        )
      : null;

    // Pick the freshest value per metric
    const byMetric = new Map<string, number>();
    for (const p of wearableR.data ?? []) {
      if (!byMetric.has(p.metric)) byMetric.set(p.metric, Number(p.value));
    }

    const latestWeight = weightR.data?.weight_lbs ?? null;
    const firstWeight = firstWeightR.data?.weight_lbs ?? null;
    const weightDelta =
      latestWeight !== null && firstWeight !== null
        ? Number(latestWeight) - Number(firstWeight)
        : null;

    // Compliance pct across last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let complianceTotal = 0;
    let complianceTaken = 0;
    for (const cs of (complianceR.data ?? []) as Array<{
      adherence: Array<{ date: string; taken: boolean }>;
    }>) {
      for (const a of cs.adherence ?? []) {
        if (new Date(a.date) >= sevenDaysAgo) {
          complianceTotal += 1;
          if (a.taken) complianceTaken += 1;
        }
      }
    }
    const compliancePct =
      complianceTotal > 0
        ? Math.round((complianceTaken / complianceTotal) * 100)
        : 0;

    const profile = profileR.data;
    const displayName =
      profile.display_name ??
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
      profile.email;

    return {
      client_id: clientId,
      display_name: displayName,
      email: profile.email,
      phase_name: phaseName,
      weeks_in_program: weeksInProgram,
      latest_weight_lbs: latestWeight !== null ? Number(latestWeight) : null,
      weight_delta_lbs: weightDelta,
      latest_hrv: byMetric.get("hrv_rmssd") ?? null,
      latest_rhr: byMetric.get("resting_hr") ?? null,
      latest_sleep_min: byMetric.get("sleep_total_min") ?? null,
      compliance_pct: compliancePct,
      last_check_in_at: lastCheckInR.data?.submitted_at ?? null,
    };
  }
}

export const coachingRepo = new CoachingRepository();

// ─── Risk heuristic ─────────────────────────────────────────

function computeRisk(input: {
  weeksInProgram: number | null;
  compliancePct: number;
  lastCheckInDays: number | null;
}): RiskTier {
  const { weeksInProgram, compliancePct, lastCheckInDays } = input;

  // Brand-new clients get a grace period
  if (weeksInProgram !== null && weeksInProgram <= 1) {
    // Except: no check-in at all after 7+ days in week 1 is high risk
    if (lastCheckInDays !== null && lastCheckInDays > 7) return "high";
    return "low";
  }

  const hasStaleCheckIn =
    lastCheckInDays === null || lastCheckInDays > 7;
  const lowCompliance = compliancePct < 60;
  const moderateCompliance = compliancePct < 80;

  if ((hasStaleCheckIn && lowCompliance) || compliancePct < 40) return "high";
  if (hasStaleCheckIn || moderateCompliance) return "medium";
  return "low";
}

// ─── Cohort outcomes ────────────────────────────────────────
// Aggregates across the coach's entire client base.

export interface CohortOutcomes {
  clientCount: number;
  avgWeightDeltaLbs: number | null;
  avgComplianceWeek1: number | null;
  avgComplianceCurrent: number | null;
  avgHrvLast7d: number | null;
  totalCheckIns: number;
  weeklyComplianceTrend: Array<{ week_start: string; compliance_pct: number }>;
}

export class CoachingExtensions {
  /**
   * NOTE: extensions are added directly to the prototype below to avoid
   * a second class. Defined as standalone functions so they can call
   * each other without class context.
   */
}

declare module "./coaching" {
  interface CoachingRepository {
    cohortOutcomesForCoach(coachId: string): Promise<CohortOutcomes>;
    upcomingOperationsForCoach(
      coachId: string,
      days?: number
    ): Promise<UpcomingItem[]>;
    actionableAlertsForCoach(coachId: string): Promise<ActionableAlert[]>;
  }
}

export interface UpcomingItem {
  date: string;          // ISO date YYYY-MM-DD
  client_id: string;
  client_name: string;
  type: "check_in" | "phase_milestone" | "lab_due";
  label: string;
}

export interface ActionableAlert {
  id: string;            // composite "client_id:type:created"
  client_id: string;
  client_name: string;
  severity: "info" | "warning" | "danger" | "positive";
  message: string;
  created_at: string;
  suggested_action: string;
}

CoachingRepository.prototype.cohortOutcomesForCoach = async function (
  coachId: string
): Promise<CohortOutcomes> {
  const rows = await this.listPipelineForCoach(coachId);
  const clientIds = rows.map((r) => r.client_id);

  if (clientIds.length === 0) {
    return {
      clientCount: 0,
      avgWeightDeltaLbs: null,
      avgComplianceWeek1: null,
      avgComplianceCurrent: null,
      avgHrvLast7d: null,
      totalCheckIns: 0,
      weeklyComplianceTrend: [],
    };
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [weightFirstR, weightLastR, hrvR, checkInsR, weeklyAdherenceR] =
    await Promise.all([
      // First weight per client (ASC, distinct via min subquery isn't trivial in
      // PostgREST — fetch all and reduce client-side; data volume is bounded
      // by client count which is small).
      this.client
        .from("daily_logs")
        .select("client_id, weight_lbs, date")
        .in("client_id", clientIds)
        .not("weight_lbs", "is", null)
        .order("date", { ascending: true }),

      this.client
        .from("daily_logs")
        .select("client_id, weight_lbs, date")
        .in("client_id", clientIds)
        .not("weight_lbs", "is", null)
        .order("date", { ascending: false }),

      this.client
        .from("wearable_data_points")
        .select("value")
        .in("client_id", clientIds)
        .eq("metric", "hrv_rmssd")
        .gte("recorded_at", sevenDaysAgo.toISOString()),

      this.client
        .from("client_check_ins")
        .select("id", { count: "exact", head: true })
        .in("client_id", clientIds),

      // Adherence over last 28 days, bucketed by week
      this.client
        .from("client_supplements")
        .select(
          `
          client_id,
          adherence:supplement_adherence(date, taken)
          `
        )
        .in("client_id", clientIds)
        .eq("active", true),
    ]);

  // First weight per client
  const firstWeight = new Map<string, number>();
  for (const row of weightFirstR.data ?? []) {
    if (!firstWeight.has(row.client_id))
      firstWeight.set(row.client_id, Number(row.weight_lbs));
  }
  // Last weight per client
  const lastWeight = new Map<string, number>();
  for (const row of weightLastR.data ?? []) {
    if (!lastWeight.has(row.client_id))
      lastWeight.set(row.client_id, Number(row.weight_lbs));
  }
  // Avg weight delta
  const deltas: number[] = [];
  for (const cid of clientIds) {
    const f = firstWeight.get(cid);
    const l = lastWeight.get(cid);
    if (f !== undefined && l !== undefined) deltas.push(l - f);
  }
  const avgWeightDeltaLbs =
    deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;

  // Avg HRV last 7d across the cohort
  const hrvVals = (hrvR.data ?? []).map((r: { value: number }) => Number(r.value));
  const avgHrvLast7d =
    hrvVals.length > 0
      ? hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length
      : null;

  // Avg compliance current (= avg of pipeline compliance_pct)
  const compliancePcts = rows.map((r) => r.compliance_pct);
  const avgComplianceCurrent =
    compliancePcts.length > 0
      ? Math.round(
          compliancePcts.reduce((a, b) => a + b, 0) / compliancePcts.length
        )
      : null;

  // Weekly compliance trend (last 4 weeks)
  const weekBuckets = new Map<
    string,
    { taken: number; total: number }
  >();
  const now = new Date();
  for (let w = 3; w >= 0; w--) {
    const start = new Date(now);
    start.setDate(start.getDate() - (w + 1) * 7 + 1);
    const startKey = start.toISOString().slice(0, 10);
    weekBuckets.set(startKey, { taken: 0, total: 0 });
  }

  for (const cs of (weeklyAdherenceR.data ?? []) as Array<{
    adherence: Array<{ date: string; taken: boolean }>;
  }>) {
    for (const a of cs.adherence ?? []) {
      const aDate = new Date(a.date);
      const weekStart = new Date(aDate);
      weekStart.setDate(aDate.getDate() - aDate.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      const bucket = weekBuckets.get(key);
      if (bucket) {
        bucket.total += 1;
        if (a.taken) bucket.taken += 1;
      }
    }
  }

  const weeklyComplianceTrend = Array.from(weekBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week_start, b]) => ({
      week_start,
      compliance_pct:
        b.total > 0 ? Math.round((b.taken / b.total) * 100) : 0,
    }));

  // Week-1 average — proxy: clients in week 1 right now is small; for
  // beta we just report current as the "live" number and leave week-1
  // baseline for v2 when the data history is richer.
  const avgComplianceWeek1 = null;

  return {
    clientCount: clientIds.length,
    avgWeightDeltaLbs,
    avgComplianceWeek1,
    avgComplianceCurrent,
    avgHrvLast7d,
    totalCheckIns: checkInsR.count ?? 0,
    weeklyComplianceTrend,
  };
};

CoachingRepository.prototype.upcomingOperationsForCoach = async function (
  coachId: string,
  days: number = 14
): Promise<UpcomingItem[]> {
  // Beta: derive upcoming items from existing data. Real scheduling lives in
  // future migration; for now we surface implied operational items.
  const rows = await this.listPipelineForCoach(coachId);
  const items: UpcomingItem[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const row of rows) {
    // Suggest weekly check-in if last was > 5 days ago
    if (
      row.last_check_in_days !== null &&
      row.last_check_in_days >= 5 &&
      row.last_check_in_days <= 14
    ) {
      const due = new Date(today);
      due.setDate(today.getDate() + Math.max(0, 7 - row.last_check_in_days));
      items.push({
        date: due.toISOString().slice(0, 10),
        client_id: row.client_id,
        client_name: row.display_name,
        type: "check_in",
        label: "Weekly check-in due",
      });
    }
    // 30-day labs at week 4
    if (row.weeks_in_program !== null && row.weeks_in_program >= 3 && row.weeks_in_program <= 5) {
      const due = new Date(today);
      due.setDate(today.getDate() + 7);
      items.push({
        date: due.toISOString().slice(0, 10),
        client_id: row.client_id,
        client_name: row.display_name,
        type: "lab_due",
        label: "30-day follow-up labs",
      });
    }
  }

  // Sort by date ASC
  items.sort((a, b) => a.date.localeCompare(b.date));
  return items.slice(0, 20);
};

CoachingRepository.prototype.actionableAlertsForCoach = async function (
  coachId: string
): Promise<ActionableAlert[]> {
  const rows = await this.listPipelineForCoach(coachId);
  const alerts: ActionableAlert[] = [];
  const now = new Date().toISOString();

  for (const row of rows) {
    // Stale check-in
    if (row.last_check_in_days !== null && row.last_check_in_days > 7) {
      alerts.push({
        id: `${row.client_id}:stale_checkin`,
        client_id: row.client_id,
        client_name: row.display_name,
        severity: row.last_check_in_days > 14 ? "danger" : "warning",
        message: `${row.display_name} hasn't checked in for ${row.last_check_in_days} days.`,
        created_at: now,
        suggested_action: "Send outreach",
      });
    }
    // Low compliance
    if (row.compliance_pct < 60 && row.weeks_in_program !== null && row.weeks_in_program > 1) {
      alerts.push({
        id: `${row.client_id}:low_compliance`,
        client_id: row.client_id,
        client_name: row.display_name,
        severity: row.compliance_pct < 40 ? "danger" : "warning",
        message: `${row.display_name}'s supplement adherence has dropped to ${row.compliance_pct}%.`,
        created_at: now,
        suggested_action: "Schedule call",
      });
    }
    // Positive: high compliance + recent check-in (celebrate)
    if (
      row.compliance_pct >= 90 &&
      row.last_check_in_days !== null &&
      row.last_check_in_days <= 3 &&
      row.weeks_in_program !== null &&
      row.weeks_in_program >= 4
    ) {
      alerts.push({
        id: `${row.client_id}:high_streak`,
        client_id: row.client_id,
        client_name: row.display_name,
        severity: "positive",
        message: `${row.display_name} hit ${row.compliance_pct}% adherence with a fresh check-in.`,
        created_at: now,
        suggested_action: "Acknowledge",
      });
    }
  }

  // Order: danger → warning → info → positive
  const sevOrder: Record<ActionableAlert["severity"], number> = {
    danger: 0,
    warning: 1,
    info: 2,
    positive: 3,
  };
  alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  return alerts;
};
