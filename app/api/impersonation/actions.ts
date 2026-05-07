"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/auth";
import { IMPERSONATION_COOKIE, readImpersonationCookie } from "@/lib/supabase/impersonation";
import { auditRepo, AuditActions, profilesRepo } from "@/lib/repositories";

/**
 * Start impersonation. Admin-only.
 *
 * Validates that the target client exists, sets the cookie, writes an
 * audit entry, and redirects into the client dashboard so the admin
 * lands in the impersonated experience immediately.
 */
export async function startImpersonationAction(
  targetClientIdOrForm: string | FormData
): Promise<{ ok: false; error: string } | void> {
  const admin = await requireRole("admin");
  const h = headers();

  // Accept either a direct string (programmatic call) or FormData
  // (from a server-rendered form). FormData path expects `client_id`.
  const targetClientId =
    typeof targetClientIdOrForm === "string"
      ? targetClientIdOrForm
      : String(targetClientIdOrForm.get("client_id") ?? "");

  if (!targetClientId) {
    return { ok: false, error: "Missing target client id." };
  }

  // Validate the target exists and is a client
  const target = await profilesRepo.findById(targetClientId).catch(() => null);
  if (!target) {
    return { ok: false, error: "Target user not found." };
  }
  if (target.role !== "client") {
    return {
      ok: false,
      error: "You can only view as a client account.",
    };
  }

  cookies().set(
    IMPERSONATION_COOKIE.name,
    targetClientId,
    IMPERSONATION_COOKIE.options
  );

  await auditRepo.write({
    actor_id: admin.id,
    actor_role: "admin",
    action: AuditActions.IMPERSONATION_STARTED,
    resource_type: "profile",
    resource_id: targetClientId,
    target_client_id: targetClientId,
    metadata: { target_email: target.email },
    ip_address: h.get("x-forwarded-for") ?? undefined,
    user_agent: h.get("user-agent") ?? undefined,
  });

  // Land in the client dashboard, which now renders for the impersonated user
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Exit impersonation. Clears the cookie regardless of role (defensive —
 * we never want a stuck impersonation cookie to be impossible to clear).
 *
 * Returns the admin to /admin/users since that's the most likely starting
 * point for impersonation. Could be parameterized later if other entry
 * points emerge.
 */
export async function stopImpersonationAction(): Promise<void> {
  const previousTarget = await readImpersonationCookie();

  // Best-effort audit — we still clear the cookie even if this fails
  if (previousTarget) {
    try {
      const admin = await requireRole("admin");
      const h = headers();
      await auditRepo.write({
        actor_id: admin.id,
        actor_role: "admin",
        action: AuditActions.IMPERSONATION_ENDED,
        resource_type: "profile",
        resource_id: previousTarget,
        target_client_id: previousTarget,
        ip_address: h.get("x-forwarded-for") ?? undefined,
        user_agent: h.get("user-agent") ?? undefined,
      });
    } catch (err) {
      // Likely role check failed (admin signed out mid-impersonation).
      // Fall through to clear the cookie anyway.
      console.warn("[stopImpersonationAction] audit skipped", err);
    }
  }

  cookies().delete(IMPERSONATION_COOKIE.name);
  revalidatePath("/", "layout");
  redirect("/admin/users");
}
