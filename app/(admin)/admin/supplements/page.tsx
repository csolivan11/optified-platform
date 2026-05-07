import { Pill, Archive } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supplementsRepo } from "@/lib/repositories";
import { requireRole } from "@/lib/supabase/auth";
import { SupplementAddForm } from "./supplement-add-form";
import { SupplementRow } from "./supplement-row";

export default async function SupplementsAdminPage() {
  await requireRole("admin");
  const all = await supplementsRepo.listForAdmin(true);

  const active = all.filter((s) => s.active);
  const archived = all.filter((s) => !s.active);

  const totalActivePrescriptions = all.reduce(
    (acc, s) => acc + s.activePrescriptionCount,
    0
  );

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Supplements"
        description="Master catalog. Adding a supplement makes it available for coaches to prescribe."
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Active" value={active.length} icon={Pill} tone="success" />
        <Stat label="Archived" value={archived.length} icon={Archive} tone="muted" />
        <Stat
          label="In active use"
          value={totalActivePrescriptions}
          icon={Pill}
        />
      </div>

      {/* Add form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add supplement</CardTitle>
          <CardDescription>
            Press Tab to move between fields, Enter to add. Form clears after
            each successful add for fast bulk entry.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SupplementAddForm />
        </CardContent>
      </Card>

      {/* Active supplements */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Active catalog</CardTitle>
          <CardDescription>
            Click a row to expand and edit inline. Archive removes a supplement
            from the catalog without affecting existing prescriptions.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {active.length === 0 ? (
            <p className="px-6 pb-6 text-body text-muted-foreground italic">
              No active supplements. Add one above.
            </p>
          ) : (
            <div>
              {active.map((s) => (
                <SupplementRow key={s.id} supplement={s} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Archived */}
      {archived.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Archived</CardTitle>
            <CardDescription>
              Removed from the catalog. Existing prescriptions are unaffected.
              Reactivate to make available again.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div>
              {archived.map((s) => (
                <SupplementRow key={s.id} supplement={s} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone?: "default" | "success" | "muted";
}) {
  const valueCls =
    tone === "success"
      ? "text-success"
      : tone === "muted"
      ? "text-muted-foreground"
      : "text-foreground";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="overline mb-2 inline-flex items-center gap-1.5">
          <Icon size={11} />
          {label}
        </div>
        <div className={`text-h2 font-bold tabular-nums ${valueCls}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
