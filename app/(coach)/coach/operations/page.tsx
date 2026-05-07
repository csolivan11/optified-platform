import Link from "next/link";
import { Calendar, MessageSquare, FileText, Award } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/supabase/auth";
import { coachingRepo, type UpcomingItem } from "@/lib/repositories";

export default async function OperationsPage() {
  const coach = await requireRole("coach");
  const items = await coachingRepo.upcomingOperationsForCoach(coach.id, 14);

  // Group items by date
  const byDate = new Map<string, UpcomingItem[]>();
  for (const item of items) {
    const existing = byDate.get(item.date) ?? [];
    existing.push(item);
    byDate.set(item.date, existing);
  }
  const groups = Array.from(byDate.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <>
      <PageHeader
        eyebrow="Scheduling & workflow"
        title="Operations"
        description="Upcoming labs, check-ins, and milestones across your client base. Next 14 days."
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar
              size={32}
              className="text-muted-foreground mx-auto mb-3"
              strokeWidth={1.8}
            />
            <p className="text-h3 mb-1">Nothing scheduled</p>
            <p className="text-body text-muted-foreground">
              No upcoming operational items in the next 14 days.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([date, dayItems]) => (
            <DayGroup key={date} date={date} items={dayItems} />
          ))}
        </div>
      )}
    </>
  );
}

function DayGroup({ date, items }: { date: string; items: UpcomingItem[] }) {
  const d = new Date(date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  let label: string;
  if (d.getTime() === today.getTime()) label = "Today";
  else if (d.getTime() === tomorrow.getTime()) label = "Tomorrow";
  else
    label = d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

  return (
    <section>
      <h2 className="overline mb-3">{label}</h2>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {items.map((item) => (
              <OperationsRow key={`${item.client_id}:${item.type}`} item={item} />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

const TYPE_META: Record<
  UpcomingItem["type"],
  {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    badge: string;
    cls: string;
  }
> = {
  check_in: {
    icon: MessageSquare,
    badge: "Check-in",
    cls: "text-info bg-info/10 border-info/20",
  },
  lab_due: {
    icon: FileText,
    badge: "Labs",
    cls: "text-accent bg-accent/10 border-accent/20",
  },
  phase_milestone: {
    icon: Award,
    badge: "Milestone",
    cls: "text-success bg-success/10 border-success/20",
  },
};

function OperationsRow({ item }: { item: UpcomingItem }) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;

  return (
    <Link
      href={`/coach/clients/${item.client_id}`}
      className="flex items-center gap-4 px-6 py-4 hover:bg-card/60 transition-colors"
    >
      <div
        className={`w-9 h-9 rounded-md flex items-center justify-center border ${meta.cls} shrink-0`}
      >
        <Icon size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-body font-semibold truncate">
          {item.client_name}
        </div>
        <div className="text-caption text-muted-foreground mt-0.5">
          {item.label}
        </div>
      </div>
      <span
        className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider border ${meta.cls}`}
      >
        {meta.badge.toUpperCase()}
      </span>
    </Link>
  );
}
