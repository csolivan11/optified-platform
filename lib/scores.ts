/**
 * Health score derivation.
 *
 * Pure functions that take raw metric values and return 0-100 composite
 * scores displayed on the Overview dashboard. These scores are the
 * "translation layer" the user specified — simple numbers a busy
 * professional can glance at and understand.
 *
 * Algorithms are intentionally simple for beta. They'll evolve with
 * clinical input and real-world validation.
 *
 * No server-only guard — safe to use in both server and client contexts.
 */

export interface ScoreInputs {
  recentHrv?: number[];          // last 7 days of HRV (ms)
  recentRhr?: number[];          // last 7 days of resting HR (bpm)
  recentSleep?: number[];        // last 7 days of sleep (hours)
  recentSteps?: number[];        // last 7 days of steps
  recentDeepSleep?: number[];    // last 7 days of deep sleep (min)
  hasDailyLogs?: boolean;        // did client log anything recently
}

/**
 * Normalize a value to 0-100 based on a linear scale between low/high.
 * Clamps to [0, 100].
 */
function normalize(value: number, low: number, high: number): number {
  if (high === low) return 50;
  const pct = ((value - low) / (high - low)) * 100;
  return Math.max(0, Math.min(100, pct));
}

function mean(values: number[] | undefined): number | null {
  if (!values || values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Sleep Quality score — based on total sleep and deep sleep consistency.
 *   100 = 8+ hours average + 90+ min deep sleep
 *   50  = 6 hours average + 50 min deep sleep
 *   0   = under 5 hours or under 20 min deep sleep
 */
export function sleepScore(inputs: ScoreInputs): number | null {
  const avgSleep = mean(inputs.recentSleep);
  const avgDeep = mean(inputs.recentDeepSleep);
  if (avgSleep === null) return null;

  const totalScore = normalize(avgSleep, 5, 8.5);
  const deepScore = avgDeep !== null ? normalize(avgDeep, 30, 100) : totalScore;
  return Math.round(totalScore * 0.6 + deepScore * 0.4);
}

/**
 * Recovery Readiness score — HRV and RHR trending.
 *   Higher HRV = better autonomic balance
 *   Lower RHR = better cardiovascular fitness
 */
export function recoveryScore(inputs: ScoreInputs): number | null {
  const avgHrv = mean(inputs.recentHrv);
  const avgRhr = mean(inputs.recentRhr);
  if (avgHrv === null && avgRhr === null) return null;

  const hrvScore = avgHrv !== null ? normalize(avgHrv, 30, 75) : null;
  const rhrScore = avgRhr !== null ? normalize(80 - avgRhr, 20, 42) : null;

  if (hrvScore !== null && rhrScore !== null) {
    return Math.round(hrvScore * 0.6 + rhrScore * 0.4);
  }
  return Math.round((hrvScore ?? rhrScore) as number);
}

/**
 * Activity score — steps meeting 10k target.
 */
export function activityScore(inputs: ScoreInputs): number | null {
  const avgSteps = mean(inputs.recentSteps);
  if (avgSteps === null) return null;
  return Math.round(normalize(avgSteps, 3000, 12000));
}

/**
 * Metabolic score — placeholder for beta.
 * In Phase 5+ this will consume real biomarker data (fasting glucose,
 * HOMA-IR, HbA1c, triglyceride:HDL ratio). For now, returns a neutral
 * score derived from activity + sleep.
 */
export function metabolicScore(inputs: ScoreInputs): number | null {
  const act = activityScore(inputs);
  const slp = sleepScore(inputs);
  if (act === null && slp === null) return null;
  if (act === null) return slp;
  if (slp === null) return act;
  return Math.round(act * 0.5 + slp * 0.5);
}

/**
 * Compliance score — did the client engage with the app recently.
 * Placeholder for Phase 4B when supplement adherence data lands.
 */
export function complianceScore(inputs: ScoreInputs): number | null {
  if (!inputs.hasDailyLogs) return null;
  // Beta: if client has recent daily logs, score = 85. Phase 4B refines.
  return 85;
}

/**
 * Overall score — weighted average of sub-scores.
 * Missing sub-scores are excluded from the weighted mean.
 */
export function overallScore(inputs: ScoreInputs): number | null {
  const sub = [
    { score: sleepScore(inputs), weight: 0.3 },
    { score: recoveryScore(inputs), weight: 0.3 },
    { score: metabolicScore(inputs), weight: 0.25 },
    { score: activityScore(inputs), weight: 0.15 },
  ].filter((s) => s.score !== null) as Array<{ score: number; weight: number }>;

  if (sub.length === 0) return null;

  const totalWeight = sub.reduce((acc, s) => acc + s.weight, 0);
  const weighted = sub.reduce((acc, s) => acc + s.score * s.weight, 0);
  return Math.round(weighted / totalWeight);
}
