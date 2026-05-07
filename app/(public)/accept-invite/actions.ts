"use server";

import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { invitesRepo, auditRepo, AuditActions } from "@/lib/repositories";
import { sendEmail, senders, welcomeEmail } from "@/lib/email";

export type AcceptInviteResult =
  | { ok: true; email: string }
  | { ok: false; error: string; reason: "invalid_token" | "weak_password" | "server_error" };

/**
 * Accept an invite.
 *
 * Flow:
 *   1. Validate token → look up invite row
 *   2. Create auth user via service_role (email_confirmed=true, since the
 *      fact that they clicked the email link IS email confirmation)
 *   3. Update profile row (created by auth trigger) with invite metadata
 *   4. Create coach assignment if invite specified one
 *   5. Create enrollment if invite specified a program
 *   6. Mark invite accepted
 *   7. Send welcome email
 *   8. Audit log
 *
 * The service_role is used here because the caller is unauthenticated.
 * Validation that the caller actually has a valid token is our
 * authorization.
 */
export async function acceptInviteAction(
  token: string,
  password: string
): Promise<AcceptInviteResult> {
  const h = headers();

  // ─── Validate token ─────────────────────────────────────
  let invite;
  try {
    invite = await invitesRepo.lookupByToken(token);
  } catch (err) {
    console.error("[acceptInvite] token lookup failed", err);
    return {
      ok: false,
      error: "Something went wrong validating your invite. Please try again.",
      reason: "server_error",
    };
  }

  if (!invite) {
    return {
      ok: false,
      error:
        "This invitation is invalid, expired, or already used. Please ask your coach to send a new one.",
      reason: "invalid_token",
    };
  }

  // ─── Validate password ──────────────────────────────────
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { ok: false, error: passwordError, reason: "weak_password" };
  }

  // ─── Create auth user ───────────────────────────────────
  const svc = createServiceClient();

  const { data: authUser, error: authError } = await svc.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true, // clicking the email link confirms email implicitly
    user_metadata: {
      role: invite.role,
      invited_via: invite.id,
    },
  });

  if (authError || !authUser.user) {
    // 422 "User already registered" — edge case where an account appeared
    // between invite creation and acceptance. Surface a helpful error.
    if (authError?.message?.toLowerCase().includes("already")) {
      return {
        ok: false,
        error:
          "An account with this email already exists. Try signing in instead, or use the password reset.",
        reason: "invalid_token",
      };
    }
    console.error("[acceptInvite] auth user create failed", authError);
    return {
      ok: false,
      error: "Could not create your account. Please try again.",
      reason: "server_error",
    };
  }

  const userId = authUser.user.id;

  // ─── Update profile with invite metadata ────────────────
  // The auth trigger created a profile row with role='client' by default;
  // we overwrite role and fill in the name fields.
  const { error: profileError } = await svc
    .from("profiles")
    .update({
      role: invite.role,
      first_name: invite.first_name,
      last_name: invite.last_name,
    })
    .eq("id", userId);

  if (profileError) {
    console.error("[acceptInvite] profile update failed", profileError);
    // Continue anyway — user can sign in, and admin can fix via admin UI
  }

  // ─── Coach assignment ───────────────────────────────────
  if (invite.assigned_coach_id && invite.role === "client") {
    const { error: assignError } = await svc.from("coach_assignments").insert({
      client_id: userId,
      coach_id: invite.assigned_coach_id,
      is_primary: true,
    });
    if (assignError) {
      console.error("[acceptInvite] coach assignment failed", assignError);
    }
  }

  // ─── Program enrollment ─────────────────────────────────
  if (invite.program_id && invite.role === "client") {
    const { error: enrollError } = await svc.from("client_enrollments").insert({
      client_id: userId,
      program_id: invite.program_id,
      status: "active",
    });
    if (enrollError) {
      console.error("[acceptInvite] enrollment failed", enrollError);
    }
  }

  // ─── Mark invite accepted ───────────────────────────────
  try {
    await invitesRepo.markAccepted(invite.id, userId);
  } catch (err) {
    console.error("[acceptInvite] mark accepted failed", err);
  }

  // ─── Send welcome email (non-blocking) ──────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const dashboardUrl =
    invite.role === "admin"
      ? `${appUrl}/admin`
      : invite.role === "coach"
      ? `${appUrl}/coach`
      : `${appUrl}/dashboard`;

  try {
    const { subject, html, text } = welcomeEmail({
      dashboardUrl,
      firstName: invite.first_name ?? undefined,
    });
    await sendEmail({
      to: { email: invite.email, name: invite.first_name ?? undefined },
      from: senders().accounts,
      subject,
      html,
      text,
      tags: { category: "welcome" },
      idempotencyKey: `welcome-${invite.id}`,
    });
  } catch (err) {
    // Non-blocking — user still has a valid account
    console.error("[acceptInvite] welcome email failed", err);
  }

  // ─── Audit ──────────────────────────────────────────────
  await auditRepo.write({
    actor_id: userId,
    actor_role: invite.role,
    action: AuditActions.INVITE_ACCEPTED,
    resource_type: "invite",
    resource_id: invite.id,
    ip_address: h.get("x-forwarded-for") ?? undefined,
    user_agent: h.get("user-agent") ?? undefined,
  });

  return { ok: true, email: invite.email };
}

// ─── Password policy ────────────────────────────────────────
function validatePassword(pw: string): string | null {
  if (!pw || pw.length < 10) {
    return "Password must be at least 10 characters.";
  }
  if (pw.length > 72) {
    // bcrypt max
    return "Password must be 72 characters or fewer.";
  }
  // Beta policy: length-based. No character-class requirements — modern
  // guidance (NIST 800-63B) favors length over complexity.
  return null;
}
