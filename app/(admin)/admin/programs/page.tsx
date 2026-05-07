import { Lock, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { programsRepo } from "@/lib/repositories";
import { requireRole } from "@/lib/supabase/auth";

export default async function ProgramsAdminPage() {
  await requireRole("admin");
  const programs = await programsRepo.listForAdmin();

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Programs"
        description="Catalog of program templates and their phase structure."
      >
        <Badge variant="info">
          <Lock size={11} className="mr-1.5 inline" />
          Migration-controlled
        </Badge>
      </PageHeader>

      {/* Read-only notice */}
      <Card className="mb-6 border-info/30 bg-info/5">
        <CardContent className="p-5">
          <p className="text-caption text-muted-foreground leading-relaxed">
            <span className="text-info font-semibold">Read-only by design.</span>{" "}
            Program structure changes affect every enrolled client, so edits go
            through SQL migrations rather than this UI. Add or modify a program
            by creating a new migration file in{" "}
            <code className="px-1.5 py-0.5 rounded bg-card font-mono text-[11px]">
              supabase/migrations/
            </code>
            .
          </p>
        </CardContent>
      </Card>

      {programs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-body text-muted-foreground">
              No programs in the catalog yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {programs.map((program) => (
            <Card key={program.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge
                        variant={program.active ? "success" : "default"}
                        className="uppercase"
                      >
                        {program.tier}
                      </Badge>
                      {!program.active && (
                        <Badge variant="default">Inactive</Badge>
                      )}
                    </div>
                    <CardTitle>{program.name}</CardTitle>
                    {program.description && (
                      <CardDescription className="mt-1.5 max-w-2xl">
                        {program.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <Stat label="Duration" value={`${program.duration_weeks}w`} />
                    <Stat label="Phases" value={program.phases.length} />
                    <Stat label="Tasks" value={program.totalTasks} />
                    <Stat
                      label="Enrolled"
                      value={program.enrolledClientCount}
                      icon={Users}
                    />
                  </div>
                </div>
              </CardHeader>
              {program.phases.length > 0 && (
                <CardContent>
                  <div className="space-y-2">
                    <div className="overline mb-2">Phase structure</div>
                    {program.phases.map((phase, i) => (
                      <div
                        key={phase.id}
                        className="flex items-center gap-3 px-4 py-3 rounded-md bg-card/40 border border-border"
                      >
                        <div className="w-7 h-7 rounded-full border-2 border-border flex items-center justify-center text-caption font-bold tabular-nums shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-body font-semibold">
                            {phase.name}
                          </div>
                          {phase.description && (
                            <div className="text-caption text-muted-foreground mt-0.5">
                              {phase.description}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div>
      <div className="overline mb-1 flex items-center gap-1 justify-end">
        {Icon && <Icon size={10} />}
        {label}
      </div>
      <div className="text-h3 font-bold tabular-nums">{value}</div>
    </div>
  );
}
