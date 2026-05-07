import { Heart, Brain, Moon, Flame } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/domain/metric-card";
import { HrvChart } from "@/components/domain/hrv-chart";
import { SleepArchitectureChart } from "@/components/domain/sleep-architecture-chart";
import { requireClientContext } from "@/lib/supabase/auth";
import { wearableDataRepo } from "@/lib/repositories";

export default async function BiomarkersPage() {
  const ctx = await requireClientContext();
  const clientId = ctx.effectiveClientId;

  const [
    hrvDaily,
    rhrDaily,
    hrvAvg7d,
    hrvAvg14d,
    rhrAvg7d,
    sleepAvg7d,
    deepAvg7d,
    stepsAvg7d,
    sleepArch,
    connections,
  ] = await Promise.all([
    wearableDataRepo.dailyMetric(clientId, "hrv_rmssd", 30),
    wearableDataRepo.dailyMetric(clientId, "resting_hr", 30),
    wearableDataRepo.rollingAverage(clientId, "hrv_rmssd", 7),
    wearableDataRepo.rollingAverage(clientId, "hrv_rmssd", 14),
    wearableDataRepo.rollingAverage(clientId, "resting_hr", 7),
    wearableDataRepo.rollingAverage(clientId, "sleep_total_min", 7),
    wearableDataRepo.rollingAverage(clientId, "sleep_deep_min", 7),
    wearableDataRepo.rollingAverage(clientId, "steps", 7),
    wearableDataRepo.sleepArchitecture(clientId, 7),
    wearableDataRepo.connectionsFor(clientId),
  ]);

  // Merge HRV and RHR by date for the dual-axis chart
  const hrvByDate = new Map(hrvDaily.map((p) => [p.date, p.value]));
  const rhrByDate = new Map(rhrDaily.map((p) => [p.date, p.value]));
  const allDates = Array.from(
    new Set([...hrvByDate.keys(), ...rhrByDate.keys()])
  ).sort();
  const hrvChartData = allDates.map((date) => ({
    date,
    hrv: hrvByDate.get(date),
    rhr: rhrByDate.get(date),
  }));

  const hasOura = connections.some((c) => c.provider === "oura");
  const isSimulated = hrvDaily.length > 0 && !hasOura;
  // With our beta, hasOura = true because the seeder creates a simulated
  // active connection. We surface "simulated" based on whether any data
  // has is_simulated=true instead. For simplicity we surface the banner
  // when we know we're in beta:
  const betaSimulated = true;

  // HRV status interpretation (simple heuristic)
  const hrvStatus = (() => {
    if (hrvAvg7d === null || hrvAvg14d === null) return null;
    const change = ((hrvAvg7d - hrvAvg14d) / hrvAvg14d) * 100;
    if (change > 5) return { label: "Improving", variant: "success" as const };
    if (change < -10) return { label: "Stressed", variant: "warning" as const };
    return { label: "Stable", variant: "info" as const };
  })();

  return (
    <>
      <PageHeader
        eyebrow="Wearable Signals"
        title="Biomarkers"
        description="HRV, resting heart rate, sleep architecture, and activity."
      >
        {betaSimulated && (
          <Badge variant="warning">
            Simulated data — live Oura sync launching in beta week 2
          </Badge>
        )}
      </PageHeader>

      {/* ─── Quick Stats ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Avg HRV (7d)"
          value={hrvAvg7d !== null ? Math.round(hrvAvg7d) : "—"}
          unit="ms"
          sub={hrvAvg14d !== null ? `14d: ${Math.round(hrvAvg14d)} ms` : undefined}
          icon={Brain}
          accentColor="accent"
        />
        <MetricCard
          label="Resting HR"
          value={rhrAvg7d !== null ? Math.round(rhrAvg7d) : "—"}
          unit="bpm"
          icon={Heart}
          accentColor="danger"
        />
        <MetricCard
          label="Avg Sleep"
          value={sleepAvg7d !== null ? (sleepAvg7d / 60).toFixed(1) : "—"}
          unit="hrs"
          sub={
            deepAvg7d !== null
              ? `Deep: ${Math.round(deepAvg7d)} min avg`
              : undefined
          }
          icon={Moon}
          accentColor="info"
        />
        <MetricCard
          label="Avg Steps"
          value={
            stepsAvg7d !== null
              ? Math.round(stepsAvg7d).toLocaleString()
              : "—"
          }
          sub="Goal: 10,000"
          icon={Flame}
          accentColor="warning"
        />
      </div>

      {/* ─── HRV + RHR trend ───────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle>HRV &amp; Resting Heart Rate</CardTitle>
              <CardDescription>30-day trend</CardDescription>
            </div>
            {hrvStatus && <Badge variant={hrvStatus.variant}>{hrvStatus.label}</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          <HrvChart data={hrvChartData} />
          {hrvAvg7d !== null && hrvAvg14d !== null && (
            <div className="mt-4 p-4 rounded-lg bg-success/5 border border-success/20">
              <p className="text-caption text-muted-foreground leading-relaxed">
                <span className="text-success font-semibold">Interpretation:</span>{" "}
                HRV trending{" "}
                {hrvAvg7d > hrvAvg14d ? "upward" : "downward"} while RHR
                {rhrAvg7d !== null && rhrAvg7d < 55 ? " sits in a strong" : " sits in a moderate"} range. This pattern reflects your autonomic
                balance — the ratio of sympathetic ("fight or flight") to
                parasympathetic ("rest and digest") activity.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Sleep architecture ────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Sleep Architecture</CardTitle>
          <CardDescription>Deep, REM, and light sleep — this week.</CardDescription>
        </CardHeader>
        <CardContent>
          <SleepArchitectureChart data={sleepArch} />
        </CardContent>
      </Card>
    </>
  );
}
