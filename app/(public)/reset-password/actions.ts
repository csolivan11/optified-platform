"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { auditRepo, AuditActions } from "@/lib/repositories";
import { sendEmail, senders, passwordResetEmail } from "@/lib/email";

export type RequestResetResult = { ok: true } | { ok: false; error: string };

const RESET_EXPIRY_MINUTES = 30;

/**
 * Request a password reset.
 *
 * Uses Supabase's built-in `resetPasswordForEmail` BUT with a twist: we
 * supply our own redirect URL pointing to our `/set-password` page, so
 * the recovery flow lands in our branded UI rather than any default
 * Supabase surface.
 *
 * Crucially: we ALWAYS return success, even if the email doesn't match
 * any account. This prevents email enumeration attacks where an attacker
 * probes which emails are registered.
 *
 * Supabase's default email template is NOT used here — the template is
 * configured in supabase/config.toml to use a minimal placeholder that
 * points to our app, OR (preferred) we skip the Supabase email entirely
 * and send our own via Resend. For Phase 3 we use Supabase's recovery
 * token generation via admin.generateLink() and embed it in our Resend
 * email ourselves.
 */
export async function requestPasswordResetAction(
  email: string
): Promise<RequestResetResult> {
  const h = headers();
  const cleanEmail = email?.trim().toLowerCase();

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const supabase = createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Generate recovery link via admin API so we can send via Resend instead
  // of Supabase's default SMTP. Requires service_role.
  const { createServiceClient } = await import("@/lib/supabase/service");
  const svc = createServiceClient();

  const { data, error } = await svc.auth.admin.generateLink({
    type: "recovery",
    email: cleanEmail,
    options: {
      redirectTo: `${appUrl}/set-password`,
    },
  });

  // If the email isn't registered, generateLink returns an error. We
  // deliberately swallow it and return ok to prevent enumeration.
  if (error || !data?.properties?.action_link) {
    console.info(
      `[requestPasswordReset] no account for ${cleanEmail} or error:`,
      error?.message
    );
    return { ok: true };
  }

  const resetUrl = data.properties.action_link;
  const ip = h.get("x-forwarded-for") ?? undefined;

  try {
    const { subject, html, text } = passwordResetEmail({
      resetUrl,
      expiresInMinutes: RESET_EXPIRY_MINUTES,
      requestedFromIp: ip,
    });

    await sendEmail({
      to: { email: cleanEmail },
      from: senders().accounts,
      subject,
      html,
      text,
      tags: { category: "password_reset" },
    });

    await auditRepo.write({
      actor_id: data.user?.id ?? "",
      actor_role: "client",
      action: AuditActions.USER_PASSWORD_RESET,
      metadata: { email: cleanEmail, stage: "requested" },
      ip_address: ip,
      user_agent: h.get("user-agent") ?? undefined,
    });
  } catch (err) {
    // Log but still return ok to prevent enumeration via error messages
    console.error("[requestPasswordReset] email send failed", err);
  }

  return { ok: true };
}

/**
 * Set a new password after clicking the reset link.
 *
 * The user arrives at /set-password with Supabase's recovery token in
 * the URL fragment. Supabase's client SDK exchanges it for a session
 * automatically on page load; at that point the user is signed in and
 * can update their password.
 *
 * This action runs server-side AFTER the client has established the
 * recovery session (call from a Client Component after confirming the
 * session exists).
 */
export async function setPasswordAction(
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const h = headers();

  if (!newPassword || newPassword.length < 10) {
    return { ok: false, error: "Password must be at least 10 characters." };
  }
  if (newPassword.length > 72) {
    return { ok: false, error: "Password must be 72 characters or fewer." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "Your reset session has expired. Please request a new link.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    console.error("[setPasswordAction]", error);
    return { ok: false, error: "Could not update your password. Please try again." };
  }

  await auditRepo.write({
    actor_id: user.id,
    actor_role: "client",
    action: AuditActions.USER_PASSWORD_RESET,
    metadata: { stage: "completed" },
    ip_address: h.get("x-forwarded-for") ?? undefined,
    user_agent: h.get("user-agent") ?? undefined,
  });

  return { ok: true };
}
