import { TrendingDown, TrendingUp, Heart, Brain, Users, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/domain/metric-card";
import { ComplianceTrendChart } from "./compliance-chart";
import { requireRole } from "@/lib/supabase/auth";
import { coachingRepo } from "@/lib/repositories";

export default async function OutcomesPage() {
  const coach = await requireRole("coach");
  const outcomes = await coachingRepo.cohortOutcomesForCoach(coach.id);

  const weightDeltaDisplay =
    outcomes.avgWeightDeltaLbs !== null
      ? `${outcomes.avgWeightDeltaLbs > 0 ? "+" : ""}${outcomes.avgWeightDeltaLbs.toFixed(1)}`
      : "—";

  return (
    <>
      <PageHeader
        eyebrow="Cohort performance"
        title="Outcomes"
        description="Aggregate progress across your full client base. Updated in real time."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Active clients"
          value={outcomes.clientCount}
          icon={Users}
          accentColor="success"
        />
        <MetricCard
          label="Avg weight change"
          value={weightDeltaDisplay}
          unit="lbs"
          sub="Since baseline"
          icon={
            outcomes.avgWeightDeltaLbs !== null && outcomes.avgWeightDeltaLbs < 0
              ? TrendingDown
              : TrendingUp
          }
          accentColor={
            outcomes.avgWeightDeltaLbs !== null && outcomes.avgWeightDeltaLbs < 0
              ? "success"
              : "warning"
          }
        />
        <MetricCard
          label="Avg HRV (7d)"
          value={
            outcomes.avgHrvLast7d !== null
              ? Math.round(outcomes.avgHrvLast7d)
              : "—"
          }
          unit="ms"
          icon={Brain}
          accentColor="accent"
        />
        <MetricCard
          label="Total check-ins"
          value={outcomes.totalCheckIns}
          sub="All-time"
          icon={MessageSquare}
          accentColor="info"
        />
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Compliance trend</CardTitle>
          <CardDescription>
            Cohort-wide supplement adherence percentage by week.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {outcomes.weeklyComplianceTrend.length === 0 ? (
            <p className="text-body text-muted-foreground py-12 text-center">
              Not enough adherence data yet.
            </p>
          ) : (
            <ComplianceTrendChart data={outcomes.weeklyComplianceTrend} />
          )}
          {outcomes.avgComplianceCurrent !== null && (
            <div className="mt-4 p-4 rounded-lg bg-success/5 border border-success/20">
              <p className="text-caption text-muted-foreground">
                Current cohort compliance:{" "}
                <span className="text-success font-bold">
                  {outcomes.avgComplianceCurrent}%
                </span>{" "}
                across all active clients.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What this measures</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-outside pl-5 space-y-2 text-body text-muted-foreground marker:text-muted-foreground/40">
            <li>
              <span className="font-semibold text-foreground">Weight change</span>{" "}
              compares the most recent weight log against each client&apos;s
              first logged weight, averaged across the cohort.
            </li>
            <li>
              <span className="font-semibold text-foreground">HRV</span> is the
              7-day rolling average across all client wearable streams.
            </li>
            <li>
              <span className="font-semibold text-foreground">
                Compliance trend
              </span>{" "}
              buckets every supplement adherence record by ISO week and
              computes the cohort percentage taken vs. scheduled.
            </li>
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
