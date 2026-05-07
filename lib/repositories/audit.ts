import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { UserRole, AuditLogEntry } from "@/lib/types/database";

/**
 * Audit log repository.
 *
 * The audit_log table is append-only at the database level (immutability
 * trigger blocks UPDATE and DELETE). Writes go through service_role because
 * regular users do not have INSERT permission — this guarantees that audit
 * writes are always explicit and intentional (not accidental side effects
 * of user-initiated queries).
 *
 * Read access is governed by RLS: users see their own actor entries; admins
 * see everything.
 */

export interface AuditWrite {
  actor_id: string;
  actor_role: UserRole;
  action: string;
  resource_type?: string;
  resource_id?: string;
  target_client_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

export class AuditRepository {
  /**
   * Write an audit entry. Uses service_role to bypass RLS.
   * Failures are logged but do NOT throw — an audit failure should never
   * break the user's primary action. In production, these failures should
   * additionally alert (Sentry, PagerDuty, etc.) — wire that up in Phase 6.
   */
  async write(entry: AuditWrite): Promise<void> {
    try {
      const svc = createServiceClient();
      const { error } = await svc.from("audit_log").insert({
        actor_id: entry.actor_id,
        actor_role: entry.actor_role,
        action: entry.action,
        resource_type: entry.resource_type ?? null,
        resource_id: entry.resource_id ?? null,
        target_client_id: entry.target_client_id ?? null,
        metadata: entry.metadata ?? null,
        ip_address: entry.ip_address ?? null,
        user_agent: entry.user_agent ?? null,
      });

      if (error) {
        console.error("[audit.write] failed", error, entry);
      }
    } catch (err) {
      console.error("[audit.write] threw", err, entry);
    }
  }

  /**
   * Read audit entries. RLS enforces visibility — actors see their own;
   * admins see all. Callers typically pass `target_client_id` to query
   * the history for a specific client.
   */
  async list(filters: {
    actor_id?: string;
    target_client_id?: string;
    action?: string;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = createClient();

    let q = supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(filters.limit ?? 100);

    if (filters.actor_id) q = q.eq("actor_id", filters.actor_id);
    if (filters.target_client_id)
      q = q.eq("target_client_id", filters.target_client_id);
    if (filters.action) q = q.eq("action", filters.action);

    const { data, error } = await q;
    if (error) {
      console.error("[audit.list]", error);
      throw error;
    }
    return (data ?? []) as AuditLogEntry[];
  }
}

export const auditRepo = new AuditRepository();

// ─── Admin-facing extensions ────────────────────────────────

/**
 * Audit log entry with actor and target-client profile names joined.
 * Used by the admin audit log viewer — raw audit_log rows only carry
 * ids, so resolving them to human-readable names is the viewer's job.
 */
export interface AuditLogEntryWithNames {
  id: string;
  actor_id: string | null;
  actor_role: UserRole | null;
  actor_display_name: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  target_client_id: string | null;
  target_client_display_name: string | null;
  target_client_email: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditListFilters {
  actor_id?: string;
  target_client_id?: string;
  action?: string;
  action_prefix?: string;         // e.g. "education." matches all article events
  from_date?: string;             // ISO
  to_date?: string;               // ISO
  limit?: number;
  offset?: number;
}

declare module "./audit" {
  interface AuditRepository {
    listForAdmin(filters: AuditListFilters): Promise<AuditLogEntryWithNames[]>;
    listDistinctActions(): Promise<string[]>;
  }
}

AuditRepository.prototype.listForAdmin = async function (
  filters: AuditListFilters
): Promise<AuditLogEntryWithNames[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = createClient();

  let q = supabase
    .from("audit_log")
    .select(
      `
      id,
      actor_id,
      actor_role,
      action,
      resource_type,
      resource_id,
      target_client_id,
      metadata,
      ip_address,
      user_agent,
      created_at,
      actor:profiles!audit_log_actor_id_fkey(
        display_name, first_name, last_name, email
      ),
      target:profiles!audit_log_target_client_id_fkey(
        display_name, first_name, last_name, email
      )
      `
    )
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);

  if (filters.actor_id) q = q.eq("actor_id", filters.actor_id);
  if (filters.target_client_id)
    q = q.eq("target_client_id", filters.target_client_id);
  if (filters.action) q = q.eq("action", filters.action);
  if (filters.action_prefix) q = q.like("action", `${filters.action_prefix}%`);
  if (filters.from_date) q = q.gte("created_at", filters.from_date);
  if (filters.to_date) q = q.lte("created_at", filters.to_date);
  if (filters.offset)
    q = q.range(
      filters.offset,
      filters.offset + (filters.limit ?? 100) - 1
    );

  const { data, error } = await q;
  if (error) {
    console.error("[audit.listForAdmin]", error);
    throw error;
  }

  return ((data ?? []) as Array<{
    id: string;
    actor_id: string | null;
    actor_role: UserRole | null;
    action: string;
    resource_type: string | null;
    resource_id: string | null;
    target_client_id: string | null;
    metadata: Record<string, unknown> | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    actor: {
      display_name: string | null;
      first_name: string | null;
      last_name: string | null;
      email: string;
    } | null;
    target: {
      display_name: string | null;
      first_name: string | null;
      last_name: string | null;
      email: string;
    } | null;
  }>).map((row) => ({
    id: row.id,
    actor_id: row.actor_id,
    actor_role: row.actor_role,
    actor_display_name: row.actor
      ? row.actor.display_name ??
        [row.actor.first_name, row.actor.last_name].filter(Boolean).join(" ") ||
        null
      : null,
    actor_email: row.actor?.email ?? null,
    action: row.action,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    target_client_id: row.target_client_id,
    target_client_display_name: row.target
      ? row.target.display_name ??
        [row.target.first_name, row.target.last_name]
          .filter(Boolean)
          .join(" ") ||
        null
      : null,
    target_client_email: row.target?.email ?? null,
    metadata: row.metadata,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    created_at: row.created_at,
  }));
};

AuditRepository.prototype.listDistinctActions = async function (): Promise<
  string[]
> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = createClient();

  // Distinct requires a GROUP BY via RPC or client-side reduction. Given
  // our finite action vocabulary, client-side is fine — the set is small.
  const { data, error } = await supabase
    .from("audit_log")
    .select("action")
    .limit(5000);

  if (error) {
    console.error("[audit.listDistinctActions]", error);
    return [];
  }

  const set = new Set<string>();
  for (const row of data ?? []) {
    if (row.action) set.add(row.action);
  }
  return Array.from(set).sort();
};

/**
 * Audit action constants. Centralized so a grep tells you every kind of event.
 */
export const AuditActions = {
  // Auth
  USER_SIGNED_IN: "user.signed_in",
  USER_SIGNED_OUT: "user.signed_out",
  USER_PASSWORD_RESET: "user.password_reset",
  // Invites
  INVITE_CREATED: "invite.created",
  INVITE_ACCEPTED: "invite.accepted",
  INVITE_EXPIRED: "invite.expired",
  // Client data
  CLIENT_VIEWED: "client.viewed",
  PROTOCOL_UPDATED: "protocol.updated",
  COACH_NOTE_CREATED: "coach_note.created",
  COACH_NOTE_UPDATED: "coach_note.updated",
  // Impersonation (Phase 5)
  IMPERSONATION_STARTED: "impersonation.started",
  IMPERSONATION_ENDED: "impersonation.ended",
  // Admin
  ROLE_CHANGED: "admin.role_changed",
  USER_DEACTIVATED: "admin.user_deactivated",
  // Content management (Phase 6A)
  ARTICLE_CREATED: "education.article_created",
  ARTICLE_UPDATED: "education.article_updated",
  SUPPLEMENT_CREATED: "supplement.created",
  SUPPLEMENT_UPDATED: "supplement.updated",
  SUPPLEMENT_DEACTIVATED: "supplement.deactivated",
  SUPPLEMENT_REACTIVATED: "supplement.reactivated",
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];
