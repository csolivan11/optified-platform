"use server";

import { headers } from "next/headers";
import { requireRole } from "@/lib/supabase/auth";
import {
  requireNotImpersonating,
  ImpersonationWriteBlockedError,
} from "@/lib/supabase/impersonation";
import {
  invitesRepo,
  InviteAlreadyExistsError,
  profilesRepo,
  auditRepo,
  AuditActions,
} from "@/lib/repositories";
import { sendEmail, senders, inviteEmail, EmailSendError } from "@/lib/email";
import type { UserRole } from "@/lib/types/database";

const INVITE_EXPIRY_HOURS = 72;

export interface CreateInviteInput {
  email: string;
  role: UserRole;
  first_name?: string;
  last_name?: string;
  program_id?: string;
  assigned_coach_id?: string;
}

export type CreateInviteResult =
  | { ok: true; inviteId: string; email: string }
  | { ok: false; error: string };

/**
 * Admin creates an invite.
 *
 * Flow:
 *   1. Authorize caller (admin only)
 *   2. Check for existing auth account with this email (prevent duplicates)
 *   3. Insert invite row (RLS enforces admin-only)
 *   4. Send email via Resend. If send fails, roll back the invite row so
 *      we don't leave orphans in the DB.
 *   5. Audit log on success.
 */
export async function createInviteAction(
  input: CreateInviteInput
): Promise<CreateInviteResult> {
  const admin = await requireRole("admin");
  const h = headers();

  // Block writes during impersonation
  try {
    await requireNotImpersonating();
  } catch (err) {
    if (err instanceof ImpersonationWriteBlockedError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  // ─── Validate input ─────────────────────────────────────
  const email = input.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please provide a valid email address." };
  }
  if (!["client", "coach", "admin"].includes(input.role)) {
    return { ok: false, error: "Invalid role." };
  }

  // ─── Duplicate check: does an account already exist? ────
  // Checks public.profiles. An existing auth user without a profile is
  // a data-integrity edge case; we treat it as "not existing" here and
  // let the acceptance flow handle it.
  try {
    const existing = await profilesRepo.findByEmail(email);
    if (existing) {
      return {
        ok: false,
        error: "An account with this email already exists.",
      };
    }
  } catch (err) {
    console.error("[createInviteAction] profile lookup failed", err);
    return { ok: false, error: "Could not verify account availability. Try again." };
  }

  // ─── Create invite row ──────────────────────────────────
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 3600 * 1000);
  let invite;
  try {
    invite = await invitesRepo.create({
      email,
      role: input.role,
      first_name: input.first_name,
      last_name: input.last_name,
      program_id: input.program_id,
      assigned_coach_id: input.assigned_coach_id,
      invited_by: admin.id,
      expires_at: expiresAt,
    });
  } catch (err) {
    if (err instanceof InviteAlreadyExistsError) {
      return {
        ok: false,
        error:
          "A pending invitation is already out for this email. Revoke it first if you want to resend.",
      };
    }
    console.error("[createInviteAction] invite create failed", err);
    return { ok: false, error: "Could not create invitation. Please try again." };
  }

  // ─── Send email ─────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const acceptUrl = `${appUrl}/accept-invite?token=${encodeURIComponent(invite.token)}`;
  const inviterName =
    admin.profile.display_name ??
    [admin.profile.first_name, admin.profile.last_name]
      .filter(Boolean)
      .join(" ") ||
    "Your coach";

  const { subject, html, text } = inviteEmail({
    acceptUrl,
    inviterName,
    recipientFirstName: input.first_name,
    expiresInHours: INVITE_EXPIRY_HOURS,
  });

  try {
    await sendEmail({
      to: { email, name: [input.first_name, input.last_name].filter(Boolean).join(" ") || undefined },
      from: senders().accounts,
      subject,
      html,
      text,
      tags: { category: "invite" },
      idempotencyKey: `invite-${invite.id}`,
    });
  } catch (err) {
    // Roll back the invite row — no point in keeping a pending invite
    // the recipient never received.
    console.error("[createInviteAction] email send failed; rolling back invite", err);
    try {
      await invitesRepo.revoke(invite.id, admin.id);
    } catch (rollbackErr) {
      console.error("[createInviteAction] rollback also failed", rollbackErr);
    }

    const message =
      err instanceof EmailSendError
        ? "We couldn't send the invitation email. The invite has been cancelled. Please check email configuration and try again."
        : "Email delivery failed. The invite has been cancelled. Please try again.";
    return { ok: false, error: message };
  }

  // ─── Audit log ──────────────────────────────────────────
  await auditRepo.write({
    actor_id: admin.id,
    actor_role: "admin",
    action: AuditActions.INVITE_CREATED,
    resource_type: "invite",
    resource_id: invite.id,
    metadata: { email, role: input.role },
    ip_address: h.get("x-forwarded-for") ?? undefined,
    user_agent: h.get("user-agent") ?? undefined,
  });

  return { ok: true, inviteId: invite.id, email };
}
