import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/supabase/auth";
import { coachingRepo, type ActionableAlert } from "@/lib/repositories";

export default async function AlertsPage() {
  const coach = await requireRole("coach");
  const alerts = await coachingRepo.actionableAlertsForCoach(coach.id);

  const danger = alerts.filter((a) => a.severity === "danger");
  const warning = alerts.filter((a) => a.severity === "warning");
  const positive = alerts.filter((a) => a.severity === "positive");

  return (
    <>
      <PageHeader
        eyebrow="Attention needed"
        title="Alerts"
        description="Compliance drops, missed check-ins, and clients who deserve recognition. Sorted by severity."
      />

      {alerts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle
              size={32}
              className="text-success mx-auto mb-3"
              strokeWidth={1.8}
            />
            <p className="text-h3 mb-1">All clear</p>
            <p className="text-body text-muted-foreground">
              No alerts right now. Your cohort is in a healthy state.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {danger.length > 0 && (
            <AlertGroup
              title="Urgent"
              count={danger.length}
              icon={AlertTriangle}
              tone="danger"
              alerts={danger}
            />
          )}
          {warning.length > 0 && (
            <AlertGroup
              title="Needs attention"
              count={warning.length}
              icon={Bell}
              tone="warning"
              alerts={warning}
            />
          )}
          {positive.length > 0 && (
            <AlertGroup
              title="Wins to acknowledge"
              count={positive.length}
              icon={CheckCircle}
              tone="success"
              alerts={positive}
            />
          )}
        </div>
      )}
    </>
  );
}

function AlertGroup({
  title,
  count,
  icon: Icon,
  tone,
  alerts,
}: {
  title: string;
  count: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: "danger" | "warning" | "success";
  alerts: ActionableAlert[];
}) {
  const toneCls = {
    danger: "text-danger bg-danger/10 border-danger/20",
    warning: "text-warning bg-warning/10 border-warning/20",
    success: "text-success bg-success/10 border-success/20",
  }[tone];

  const dotColor = {
    danger: "bg-danger",
    warning: "bg-warning",
    success: "bg-success",
  }[tone];

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`w-7 h-7 rounded-md flex items-center justify-center border ${toneCls}`}
        >
          <Icon size={14} />
        </div>
        <h2 className="text-h3">{title}</h2>
        <span className="overline">{count}</span>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {alerts.map((alert) => (
              <Link
                key={alert.id}
                href={`/coach/clients/${alert.client_id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-card/60 transition-colors group"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${dotColor} mt-2 shrink-0`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-body font-semibold truncate">
                    {alert.client_name}
                  </div>
                  <p className="text-caption text-muted-foreground mt-0.5">
                    {alert.message}
                  </p>
                </div>
                <span className="text-caption text-muted-foreground hidden sm:inline">
                  {alert.suggested_action}
                </span>
                <ChevronRight
                  size={14}
                  className="text-muted-foreground shrink-0 group-hover:text-foreground transition-colors"
                />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
