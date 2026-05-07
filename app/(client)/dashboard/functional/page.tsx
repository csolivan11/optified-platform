import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FunctionalMetricRow } from "@/components/domain/functional-metric-row";
import { requireClientContext } from "@/lib/supabase/auth";
import { functionalMetricsRepo } from "@/lib/repositories";
import type { FunctionalCategory } from "@/lib/types/database";

const CATEGORY_META: Record<
  FunctionalCategory,
  { title: string; description: string }
> = {
  strength: {
    title: "Strength",
    description: "1-rep max benchmarks across major lifts and grip strength.",
  },
  endurance: {
    title: "Endurance",
    description: "Aerobic capacity and cardiovascular fitness measures.",
  },
  mobility: {
    title: "Mobility & Stability",
    description: "Range of motion, balance, and isometric holds.",
  },
  body_comp: {
    title: "Body Composition",
    description: "Lean mass, fat mass, and circumference measurements.",
  },
};

const CATEGORY_ORDER: FunctionalCategory[] = [
  "strength",
  "endurance",
  "mobility",
  "body_comp",
];

export default async function FunctionalPage() {
  const ctx = await requireClientContext();
  const byCategory = await functionalMetricsRepo.latestByCategory(ctx.effectiveClientId);

  const totalMetrics = Object.values(byCategory).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  return (
    <>
      <PageHeader
        eyebrow="Performance Benchmarks"
        title="Functional Metrics"
        description="Strength, endurance, mobility, and body composition tracked from baseline to target."
      />

      {totalMetrics === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-body text-muted-foreground max-w-md mx-auto">
              No functional benchmarks recorded yet. Your coach will capture
              your baseline assessment in your first session.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {CATEGORY_ORDER.map((category) => {
            const metrics = byCategory[category];
            if (metrics.length === 0) return null;
            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle>{CATEGORY_META[category].title}</CardTitle>
                  <CardDescription>
                    {CATEGORY_META[category].description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-5">
                    {metrics.map((m) => (
                      <FunctionalMetricRow key={m.metric_name} metric={m} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
