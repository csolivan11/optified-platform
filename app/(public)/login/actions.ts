"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { auditRepo, AuditActions } from "@/lib/repositories/audit";
import { landingPathForRole } from "@/lib/supabase/auth";

export type SignInResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Sign a user in with email + password.
 * Returns result rather than redirecting so the client component can
 * display errors inline. On success, calls redirect().
 */
export async function signInAction(
  email: string,
  password: string,
  nextPath?: string
): Promise<SignInResult> {
  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    // Supabase returns deliberately vague messages for security. Surface
    // as-is but normalize to a user-friendly tone.
    return {
      ok: false,
      error: normalizeAuthError(error.message),
    };
  }

  if (!data.user) {
    return { ok: false, error: "Sign in failed. Please try again." };
  }

  // Look up role to decide landing path
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const role = profile?.role ?? "client";

  // Audit log (best-effort)
  const h = headers();
  await auditRepo.write({
    actor_id: data.user.id,
    actor_role: role,
    action: AuditActions.USER_SIGNED_IN,
    ip_address: h.get("x-forwarded-for") ?? undefined,
    user_agent: h.get("user-agent") ?? undefined,
  });

  const destination = nextPath?.startsWith("/")
    ? nextPath
    : landingPathForRole(role);

  redirect(destination);
}

/**
 * Sign the current user out.
 */
export async function signOutAction(): Promise<void> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    await auditRepo.write({
      actor_id: user.id,
      actor_role: profile?.role ?? "client",
      action: AuditActions.USER_SIGNED_OUT,
    });
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * Translate Supabase auth error messages into user-friendly copy.
 */
function normalizeAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (m.includes("email not confirmed")) {
    return "Please confirm your email before signing in. Check your inbox.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  // Fall back to the raw message for debugging; in production,
  // consider a generic fallback instead.
  return message;
}
