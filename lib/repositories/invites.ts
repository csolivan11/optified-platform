import "server-only";
import { Repository } from "./base";
import { createServiceClient } from "@/lib/supabase/service";
import { generateInviteToken, hashToken } from "@/lib/auth/tokens";
import type { UserRole } from "@/lib/types/database";

/**
 * Invites repository.
 *
 * Creation, lookup-by-token, and acceptance all go through here.
 * Some operations (token lookup, user creation on accept) require
 * service_role because they happen BEFORE the user is authenticated —
 * so we can't rely on RLS policies for self-access.
 */

export interface InviteCreateInput {
  email: string;
  role: UserRole;
  first_name?: string;
  last_name?: string;
  program_id?: string;
  assigned_coach_id?: string;
  invited_by: string;           // admin's profile ID
  expires_at: Date;
}

export interface CreatedInvite {
  id: string;
  token: string;                // plaintext — only available here
  email: string;
  expires_at: string;
}

export interface InviteRow {
  id: string;
  email: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  program_id: string | null;
  assigned_coach_id: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  accepted_at: string | null;
  invited_by: string;
  invited_at: string;
}

export class InvitesRepository extends Repository {
  /**
   * Create an invite. Uses the user-scoped client so RLS enforces that
   * only admins can insert (per the admin-only policy on the table).
   *
   * Returns the plaintext token for inclusion in the outgoing email.
   */
  async create(input: InviteCreateInput): Promise<CreatedInvite> {
    const { plaintext, hash } = generateInviteToken();

    const { data, error } = await this.client
      .from("invites")
      .insert({
        token_hash: hash,
        email: input.email.trim().toLowerCase(),
        role: input.role,
        first_name: input.first_name ?? null,
        last_name: input.last_name ?? null,
        program_id: input.program_id ?? null,
        assigned_coach_id: input.assigned_coach_id ?? null,
        invited_by: input.invited_by,
        expires_at: input.expires_at.toISOString(),
      })
      .select("id, email, expires_at")
      .single();

    if (error) {
      // 23505 = unique violation. Most likely: a pending invite already
      // exists for this email.
      if (error.code === "23505") {
        throw new InviteAlreadyExistsError(input.email);
      }
      console.error("[invites.create]", error);
      throw error;
    }

    return {
      id: data.id,
      token: plaintext,
      email: data.email,
      expires_at: data.expires_at,
    };
  }

  /**
   * Look up an invite by plaintext token. Uses service_role because the
   * caller is unauthenticated (they're about to accept the invite).
   *
   * Returns the invite row only if:
   *   - token matches
   *   - status is 'pending'
   *   - expires_at is in the future
   *
   * Does NOT mark the invite as accepted — that happens in acceptInvite().
   */
  async lookupByToken(plaintext: string): Promise<InviteRow | null> {
    const hash = hashToken(plaintext);
    const svc = createServiceClient();

    const { data, error } = await svc
      .from("invites")
      .select("*")
      .eq("token_hash", hash)
      .maybeSingle();

    if (error) {
      console.error("[invites.lookupByToken]", error);
      throw error;
    }
    if (!data) return null;

    // Validate lifecycle
    if (data.status !== "pending") return null;
    if (new Date(data.expires_at) < new Date()) {
      // Best-effort: mark as expired so admin UI reflects it.
      await svc.from("invites").update({ status: "expired" }).eq("id", data.id);
      return null;
    }

    return data as InviteRow;
  }

  /**
   * Mark an invite as accepted. Called from the accept-invite flow after
   * the auth user has been created successfully.
   */
  async markAccepted(inviteId: string, acceptedByUserId: string): Promise<void> {
    const svc = createServiceClient();
    const { error } = await svc
      .from("invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: acceptedByUserId,
      })
      .eq("id", inviteId);

    if (error) {
      console.error("[invites.markAccepted]", error);
      throw error;
    }
  }

  /**
   * Revoke a pending invite. Admin only (enforced by RLS).
   */
  async revoke(inviteId: string, revokedBy: string): Promise<void> {
    const { error } = await this.client
      .from("invites")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_by: revokedBy,
      })
      .eq("id", inviteId)
      .eq("status", "pending");

    if (error) {
      console.error("[invites.revoke]", error);
      throw error;
    }
  }

  /**
   * List recent invites for admin UI.
   */
  async list(limit = 50): Promise<InviteRow[]> {
    const { data, error } = await this.client
      .from("invites")
      .select("*")
      .order("invited_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[invites.list]", error);
      throw error;
    }
    return (data ?? []) as InviteRow[];
  }
}

export class InviteAlreadyExistsError extends Error {
  constructor(public readonly email: string) {
    super(`A pending invite already exists for ${email}`);
    this.name = "InviteAlreadyExistsError";
  }
}

export const invitesRepo = new InvitesRepository();
