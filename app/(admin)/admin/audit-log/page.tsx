import Link from "next/link";
import {
  Activity,
  Eye,
  FileText,
  LogIn,
  LogOut,
  Mail,
  MessageSquare,
  Pill,
  Shield,
  UserCog,
  BookOpen,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auditRepo, type AuditLogEntryWithNames } from "@/lib/repositories";
import { requireRole } from "@/lib/supabase/auth";

interface PageProps {
  searchParams: {
    action?: string;
    category?: string;
    days?: string;
  };
}

/**
 * Audit log viewer. Admin-only (RLS enforces — non-admins see only
 * their own rows, which means non-admins landing here would see their
 * own signin events, not the whole system).
 *
 * Filters: action category (auth / client / impersonation / content / admin),
 * specific action, date range (preset days).
 */
export default async function AuditLogPage({ searchParams }: PageProps) {
  await requireRole("admin");

  const days = Number(searchParams.days ?? "7");
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const categoryPrefixMap: Record<string, string> = {
    auth: "user.",
    invites: "invite.",
    client: "client.",
    coaching: "coach_note.",
    impersonation: "impersonation.",
    content: "education.",
    supplements: "supplement.",
    admin: "admin.",
  };

  const filters = {
    from_date: fromDate,
    limit: 200,
    ...(searchParams.action && { action: searchParams.action }),
    ...(searchParams.category &&
      categoryPrefixMap[searchParams.category] && {
        action_prefix: categoryPrefixMap[searchParams.category],
      }),
  };

  const [entries, distinctActions] = await Promise.all([
    auditRepo.listForAdmin(filters),
    auditRepo.listDistinctActions(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Audit log"
        description="Every write action across the platform. Append-only at the database level — entries can never be modified or deleted."
      />

      {/* ─── Filter bar ─────────────────────────────────────── */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="space-y-4">
            <FilterRow label="Time window">
              {[
                { key: "1", label: "24h" },
                { key: "7", label: "7 days" },
                { key: "30", label: "30 days" },
                { key: "90", label: "90 days" },
              ].map((opt) => (
                <FilterChip
                  key={opt.key}
                  active={String(days) === opt.key}
                  href={buildHref(searchParams, "days", opt.key)}
                  label={opt.label}
                />
              ))}
            </FilterRow>

            <FilterRow label="Category">
              <FilterChip
                active={!searchParams.category}
                href={buildHref(searchParams, "category", undefined)}
                label="All"
              />
              {Object.keys(categoryPrefixMap).map((cat) => (
                <FilterChip
                  key={cat}
                  active={searchParams.category === cat}
                  href={buildHref(searchParams, "category", cat)}
                  label={cat}
                />
              ))}
            </FilterRow>

            {distinctActions.length > 0 && (
              <FilterRow label="Action">
                <FilterChip
                  active={!searchParams.action}
                  href={buildHref(searchParams, "action", undefined)}
                  label="All"
                />
                {distinctActions.map((a) => (
                  <FilterChip
                    key={a}
                    active={searchParams.action === a}
                    href={buildHref(searchParams, "action", a)}
                    label={a}
                    mono
                  />
                ))}
              </FilterRow>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Entries ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            {entries.length === 0
              ? "No entries match your filters."
              : `${entries.length} ${
                  entries.length === 1 ? "entry" : "entries"
                } within selected range.`}
          </CardDescription>
        </CardHeader>
        {entries.length > 0 && (
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {entries.map((entry) => (
                <AuditEntry key={entry.id} entry={entry} />
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </>
  );
}

// ─── Support components ─────────────────────────────────────

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="overline shrink-0 w-24">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  href,
  label,
  mono,
}: {
  active: boolean;
  href: string;
  label: string;
  mono?: boolean;
}) {
  const base =
    "inline-flex items-center px-3 py-1 rounded-md border text-caption transition-colors";
  const activeCls = "bg-success/10 border-success/30 text-success font-semibold";
  const inactiveCls =
    "border-border text-muted-foreground hover:text-foreground hover:border-navy-400";
  return (
    <Link
      href={href}
      className={`${base} ${active ? activeCls : inactiveCls} ${
        mono ? "font-mono text-[11px]" : "font-medium"
      }`}
    >
      {label}
    </Link>
  );
}

function AuditEntry({ entry }: { entry: AuditLogEntryWithNames }) {
  const categoryIcon = iconForAction(entry.action);
  const CategoryIcon = categoryIcon.icon;

  const actorLabel =
    entry.actor_display_name ?? entry.actor_email ?? "Unknown actor";
  const actorInitials = actorLabel
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="flex items-start gap-4 px-6 py-4 hover:bg-card/40 transition-colors">
      {/* Icon */}
      <div
        className={`w-9 h-9 rounded-md border flex items-center justify-center shrink-0 ${categoryIcon.cls}`}
      >
        <CategoryIcon size={14} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap mb-1">
          {entry.actor_role && (
            <Badge variant={roleVariant(entry.actor_role)}>
              {entry.actor_role}
            </Badge>
          )}
          <span className="text-caption font-bold text-foreground">
            {actorLabel}
          </span>
          <span className="text-caption text-muted-foreground">
            {describeAction(entry)}
          </span>
          {entry.target_client_display_name && (
            <span className="text-caption font-semibold text-foreground">
              {entry.target_client_display_name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          <span className="font-mono">{entry.action}</span>
          <span className="text-border">·</span>
          <time dateTime={entry.created_at} title={new Date(entry.created_at).toLocaleString()}>
            {formatRelativeTime(entry.created_at)}
          </time>
          {entry.ip_address && (
            <>
              <span className="text-border">·</span>
              <span className="font-mono">{entry.ip_address}</span>
            </>
          )}
        </div>
        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
          <details className="mt-2">
            <summary className="text-[10px] uppercase tracking-wider text-muted-foreground/60 cursor-pointer hover:text-muted-foreground">
              Metadata
            </summary>
            <pre className="mt-2 p-3 rounded-md bg-card/60 border border-border text-[11px] font-mono text-muted-foreground overflow-x-auto">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────

function buildHref(
  current: Record<string, string | undefined>,
  key: string,
  value: string | undefined
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (v) params.set(k, v);
  }
  if (value === undefined) params.delete(key);
  else params.set(key, value);
  const qs = params.toString();
  return qs ? `/admin/audit-log?${qs}` : "/admin/audit-log";
}

function iconForAction(action: string): {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  cls: string;
} {
  if (action.startsWith("user."))
    return { icon: action.includes("signed_in") ? LogIn : LogOut, cls: "text-info bg-info/10 border-info/20" };
  if (action.startsWith("invite."))
    return { icon: Mail, cls: "text-info bg-info/10 border-info/20" };
  if (action.startsWith("client."))
    return { icon: Eye, cls: "text-accent bg-accent/10 border-accent/20" };
  if (action.startsWith("coach_note."))
    return { icon: MessageSquare, cls: "text-accent bg-accent/10 border-accent/20" };
  if (action.startsWith("impersonation."))
    return { icon: Shield, cls: "text-warning bg-warning/10 border-warning/20" };
  if (action.startsWith("education."))
    return { icon: BookOpen, cls: "text-success bg-success/10 border-success/20" };
  if (action.startsWith("supplement."))
    return { icon: Pill, cls: "text-success bg-success/10 border-success/20" };
  if (action.startsWith("admin."))
    return { icon: UserCog, cls: "text-danger bg-danger/10 border-danger/20" };
  return { icon: Activity, cls: "text-muted-foreground bg-card border-border" };
}

function describeAction(entry: AuditLogEntryWithNames): string {
  const a = entry.action;
  const map: Record<string, string> = {
    "user.signed_in": "signed in",
    "user.signed_out": "signed out",
    "user.password_reset": "reset their password",
    "invite.created": "sent an invitation",
    "invite.accepted": "accepted an invitation",
    "invite.expired": "invitation expired for",
    "client.viewed": "viewed",
    "protocol.updated": "updated the protocol for",
    "coach_note.created": "wrote a note on",
    "coach_note.updated": "edited a note on",
    "impersonation.started": "started impersonating",
    "impersonation.ended": "exited impersonation of",
    "admin.role_changed": "changed the role of",
    "admin.user_deactivated": "deactivated",
    "education.article_created": "authored an article",
    "education.article_updated": "edited an article",
    "supplement.created": "added a supplement",
    "supplement.updated": "edited a supplement",
    "supplement.deactivated": "archived a supplement",
    "supplement.reactivated": "reactivated a supplement",
  };
  return map[a] ?? a;
}

function roleVariant(role: string): "default" | "success" | "warning" | "danger" | "info" {
  switch (role) {
    case "admin":
      return "danger";
    case "coach":
      return "warning";
    case "client":
      return "info";
    default:
      return "default";
  }
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86400);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
