import { Heart, Brain, Moon, Flame } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScoreRing } from "@/components/domain/score-ring";
import { MetricCard } from "@/components/domain/metric-card";
import { WeightTrendChart } from "@/components/domain/weight-trend-chart";
import { SupplementAdherenceGrid } from "@/components/domain/supplement-adherence-grid";
import { requireClientContext } from "@/lib/supabase/auth";
import {
  dailyLogsRepo,
  wearableDataRepo,
  supplementsRepo,
} from "@/lib/repositories";
import {
  sleepScore,
  recoveryScore,
  metabolicScore,
  complianceScore,
  overallScore,
} from "@/lib/scores";
import { recordAdherenceAction } from "./actions";

export default async function OverviewPage() {
  const ctx = await requireClientContext();
  const clientId = ctx.effectiveClientId;

  const [
    dailyLogs,
    hrv7d,
    rhr7d,
    sleepTotal7d,
    sleepDeep7d,
    steps7d,
    latestHrv,
    latestRhr,
    latestSleepTotal,
    latestSteps,
    latestLog,
    firstLog,
    activeSupplements,
  ] = await Promise.all([
    dailyLogsRepo.listForClient(clientId, 30),
    wearableDataRepo.dailyMetric(clientId, "hrv_rmssd", 7),
    wearableDataRepo.dailyMetric(clientId, "resting_hr", 7),
    wearableDataRepo.dailyMetric(clientId, "sleep_total_min", 7),
    wearableDataRepo.dailyMetric(clientId, "sleep_deep_min", 7),
    wearableDataRepo.dailyMetric(clientId, "steps", 7),
    wearableDataRepo.latestValue(clientId, "hrv_rmssd"),
    wearableDataRepo.latestValue(clientId, "resting_hr"),
    wearableDataRepo.latestValue(clientId, "sleep_total_min"),
    wearableDataRepo.latestValue(clientId, "steps"),
    dailyLogsRepo.latestForClient(clientId),
    (async () => {
      const logs = await dailyLogsRepo.listForClient(clientId, 365);
      return logs[0] ?? null;
    })(),
    supplementsRepo.listActiveForClient(clientId),
  ]);

  const scoreInputs = {
    recentHrv: hrv7d.map((p) => p.value),
    recentRhr: rhr7d.map((p) => p.value),
    recentSleep: sleepTotal7d.map((p) => p.value / 60),
    recentDeepSleep: sleepDeep7d.map((p) => p.value),
    recentSteps: steps7d.map((p) => p.value),
    hasDailyLogs: dailyLogs.length > 0,
  };

  const overall = overallScore(scoreInputs);
  const sleep = sleepScore(scoreInputs);
  const recovery = recoveryScore(scoreInputs);
  const metabolic = metabolicScore(scoreInputs);
  // Compliance: prefer real adherence average if any prescriptions exist
  const supplementCompliance = (() => {
    const withData = activeSupplements.filter((s) => s.adherencePercent !== null);
    if (withData.length === 0) return null;
    return Math.round(
      withData.reduce((acc, s) => acc + (s.adherencePercent ?? 0), 0) / withData.length
    );
  })();
  const compliance = supplementCompliance ?? complianceScore(scoreInputs);

  const weightData = dailyLogs
    .filter((l) => l.weight_lbs !== null)
    .map((l) => ({ date: l.date, weight: Number(l.weight_lbs) }));

  const latestWeight = latestLog?.weight_lbs;
  const startWeight = firstLog?.weight_lbs;
  const weightDelta =
    latestWeight && startWeight ? Number(latestWeight) - Number(startWeight) : null;

  // Display name: when impersonating, we want to greet the impersonated
  // client (not "Good morning, Admin"). Layout already fetches the
  // impersonated profile for the sidebar — for the greeting we use the
  // first name field if available.
  let displayName: string | null = null;
  if (ctx.isImpersonating) {
    const { profilesRepo } = await import("@/lib/repositories");
    const target = await profilesRepo.findById(clientId).catch(() => null);
    displayName =
      target?.first_name ?? target?.display_name ?? null;
  } else {
    displayName =
      ctx.realUser.profile.first_name ?? ctx.realUser.profile.display_name ?? null;
  }
  const greeting = getGreeting();

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title={`${greeting}${displayName ? `, ${displayName}` : ""}.`}
        description="A snapshot of where your optimization is right now."
      />

      <Card className="mb-8">
        <CardHeader className="pb-6">
          <CardTitle>Health Scores</CardTitle>
          <CardDescription>7-day rolling composite scores.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-around flex-wrap gap-8">
            <ScoreRing score={overall} size={140} label="Overall" sublabel="Health Score" />
            <ScoreRing score={sleep} size={108} label="Sleep" sublabel="Quality" />
            <ScoreRing score={recovery} size={108} label="Recovery" sublabel="Readiness" />
            <ScoreRing score={metabolic} size={108} label="Metabolic" sublabel="Health" />
            <ScoreRing score={compliance} size={108} label="Compliance" sublabel="Adherence" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Resting HR"
          value={latestRhr !== null ? Math.round(latestRhr) : "—"}
          unit="bpm"
          icon={Heart}
          accentColor="danger"
        />
        <MetricCard
          label="HRV"
          value={latestHrv !== null ? Math.round(latestHrv) : "—"}
          unit="ms"
          icon={Brain}
          accentColor="accent"
        />
        <MetricCard
          label="Sleep"
          value={latestSleepTotal !== null ? (latestSleepTotal / 60).toFixed(1) : "—"}
          unit="hrs"
          icon={Moon}
          accentColor="info"
        />
        <MetricCard
          label="Steps"
          value={latestSteps !== null ? latestSteps.toLocaleString() : "—"}
          sub="Goal: 10,000"
          icon={Flame}
          accentColor="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weight trend */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Weight Trend</CardTitle>
                <CardDescription>Last 30 days.</CardDescription>
              </div>
              {latestWeight !== undefined && latestWeight !== null && (
                <div className="text-right">
                  <div className="text-2xl font-extrabold tabular-nums tracking-tight">
                    {Number(latestWeight).toFixed(1)}
                    <span className="text-sm text-muted-foreground ml-1">lbs</span>
                  </div>
                  {weightDelta !== null && Math.abs(weightDelta) > 0.1 && (
                    <div
                      className={`text-caption font-semibold ${
                        weightDelta < 0 ? "text-success" : "text-warning"
                      }`}
                    >
                      {weightDelta < 0 ? "↓" : "↑"}{" "}
                      {Math.abs(weightDelta).toFixed(1)} lbs from baseline
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <WeightTrendChart data={weightData} />
          </CardContent>
        </Card>

        {/* Supplement adherence */}
        <Card>
          <CardHeader>
            <CardTitle>Supplement Adherence</CardTitle>
            <CardDescription>This week. Tap today to log.</CardDescription>
          </CardHeader>
          <CardContent>
            <SupplementAdherenceGrid
              supplements={activeSupplements}
              onRecord={recordAdherenceAction}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
