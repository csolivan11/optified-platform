import { Heart, Activity, Shield, Brain, Pill, BookOpen, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TdeeCalculator } from "@/components/domain/tools/tdee-calculator";
import { MacroCalculator } from "@/components/domain/tools/macro-calculator";
import { OneRmCalculator } from "@/components/domain/tools/one-rm-calculator";
import { ProteinCalculator } from "@/components/domain/tools/protein-calculator";

interface UpcomingTool {
  name: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const UPCOMING_TOOLS: Array<{ category: string; items: UpcomingTool[] }> = [
  {
    category: "Cardiovascular & fitness",
    items: [
      {
        name: "VO₂ Max Rank",
        desc: "Age-adjusted VO₂ max percentile and mortality risk tier.",
        icon: Heart,
      },
      {
        name: "Target Heart Rate Zones",
        desc: "Personalized Zone 2 through Zone 5 training ranges.",
        icon: Activity,
      },
    ],
  },
  {
    category: "Risk & longevity",
    items: [
      {
        name: "ASCVD Risk Score",
        desc: "10-year cardiovascular risk estimate using ApoB and lipids.",
        icon: Shield,
      },
      {
        name: "Biological Age Estimator",
        desc: "Composite age calculation from biomarker panel.",
        icon: Brain,
      },
    ],
  },
  {
    category: "Reference",
    items: [
      {
        name: "Supplement Database",
        desc: "Dosing, timing, interactions, and evidence quality by compound.",
        icon: Pill,
      },
      {
        name: "Lab Reference Ranges",
        desc: "Optimal vs. standard ranges with clinical context.",
        icon: BookOpen,
      },
    ],
  },
];

export default function ToolsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Calculators & Reference"
        title="Tools"
        description="Quick calculations grounded in the same evidence base your protocol uses. Inputs are not stored unless you save a result to your profile."
      />

      {/* ─── Active calculators ─────────────────────────────── */}
      <section className="mb-12">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-h3">Nutrition &amp; metabolism</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <TdeeCalculator />
          <MacroCalculator />
          <ProteinCalculator />
          <OneRmCalculator />
        </div>
      </section>

      {/* ─── Upcoming tools (catalog with disabled cards) ────── */}
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-h3">Coming next</h2>
          <span className="text-caption text-muted-foreground">In development</span>
        </div>

        <div className="space-y-8">
          {UPCOMING_TOOLS.map((group) => (
            <div key={group.category}>
              <h3 className="overline mb-3">{group.category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.items.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <div
                      key={tool.name}
                      className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card/40 opacity-60"
                    >
                      <div className="w-9 h-9 rounded-md bg-muted/40 border border-border flex items-center justify-center shrink-0">
                        <Icon size={16} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-body font-semibold">
                          {tool.name}
                        </div>
                        <div className="text-caption text-muted-foreground mt-0.5">
                          {tool.desc}
                        </div>
                      </div>
                      <ChevronRight
                        size={14}
                        className="text-muted-foreground/50 shrink-0 mt-2"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
