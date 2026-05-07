import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types/database";

/**
 * Server-side auth helpers used by role-gated layouts.
 *
 * Each function hits the database once and returns the user's profile.
 * For a single page render that calls multiple helpers, we rely on React's
 * request-scoped `cache()` (Phase 4+) to dedupe. For Phase 2B the helpers
 * are simple and trust that Next.js wraps them appropriately.
 */

export interface AuthenticatedUser {
  id: string;
  email: string;
  profile: Profile;
}

/**
 * Returns the current user or null if not signed in.
 * Does NOT redirect — use `requireAuthenticated` for that.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch the full profile. RLS allows users to read their own row.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    // Profile missing for a signed-in user = data-integrity issue.
    // The auth trigger should have created it. Log and treat as unauthenticated.
    console.error("[auth] Missing profile for authenticated user", user.id, error);
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? profile.email,
    profile: profile as Profile,
  };
}

/**
 * Returns the current user or redirects to /login if not signed in.
 * Use this in any layout or page that requires authentication.
 */
export async function requireAuthenticated(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Returns the current user if they have one of the allowed roles,
 * otherwise redirects to their appropriate landing page (not login —
 * the user IS signed in, just not authorized for this route).
 *
 * Admins pass any role check automatically. This is deliberate: admins
 * have visibility into every surface. Phase 5's "View as Client" mode
 * uses this same trait — an admin viewing a client dashboard is not
 * breaking role boundaries, they're exercising legitimate access.
 */
export async function requireRole(
  allowed: UserRole | UserRole[]
): Promise<AuthenticatedUser> {
  const user = await requireAuthenticated();
  const allowedRoles = Array.isArray(allowed) ? allowed : [allowed];

  // Admins always pass
  if (user.profile.role === "admin") return user;

  if (!allowedRoles.includes(user.profile.role)) {
    redirect(landingPathForRole(user.profile.role));
  }

  return user;
}

/**
 * Where to send a user based on their role.
 * Used by the root `/` page and by `requireRole` when redirecting.
 */
export function landingPathForRole(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "coach":
      return "/coach";
    case "client":
      return "/dashboard";
  }
}

/**
 * Composite helper for client-facing pages.
 *
 * Returns the EFFECTIVE client id — the user whose data the page should
 * render. For a real client, this is their own id. For an admin who is
 * impersonating a client, this is the impersonated client's id.
 *
 * Use this in every page under (client)/dashboard. Replaces the pattern
 * of `const user = await requireRole("client"); const clientId = user.id;`.
 */
export async function requireClientContext(): Promise<{
  effectiveClientId: string;
  isImpersonating: boolean;
  realUser: AuthenticatedUser;
}> {
  // Local import to avoid a cycle (impersonation imports from auth).
  const { getImpersonationContext } = await import("./impersonation");
  await requireRole("client");
  const ctx = await getImpersonationContext();
  return {
    effectiveClientId: ctx.effectiveClientId,
    isImpersonating: ctx.isImpersonating,
    realUser: ctx.realUser,
  };
}
