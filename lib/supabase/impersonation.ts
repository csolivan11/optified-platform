import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, type AuthenticatedUser } from "./auth";

/**
 * Server-side impersonation context.
 *
 * Architecture (Option A — view-layer override, no auth-token swap):
 *   - Real authenticated user is unchanged at all times. JWT keeps the
 *     admin/coach identity. RLS policies always see auth.uid() as the
 *     real user.
 *   - Impersonation is expressed as a single HTTP-only cookie naming
 *     a target client_id.
 *   - This helper is the only place that reads the cookie. Pages and
 *     repositories ask for `effectiveClientId` and trust the answer.
 *   - Writes during impersonation are blocked at the Server Action layer
 *     via `requireNotImpersonating()`. The cookie is intentionally not
 *     a request header — middleware never auto-rewrites it — so an
 *     admin can't accidentally trigger writes by reloading a page.
 *
 * Authorization rules:
 *   - Only admins can impersonate (Phase 5B scope). Coaches viewing
 *     their assigned clients use /coach/clients/[id], which is a
 *     coach-rendered detail view, not impersonation.
 *   - The cookie value must be a valid UUID format; everything else is
 *     treated as no impersonation.
 */

const COOKIE_NAME = "optified_impersonating_client_id";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ImpersonationContext {
  realUser: AuthenticatedUser;
  /**
   * The client whose data should be displayed. Equals realUser.id when
   * not impersonating; equals the cookie value when impersonating.
   */
  effectiveClientId: string;
  isImpersonating: boolean;
  /**
   * The client_id being impersonated (only set when isImpersonating=true).
   * Useful for banner display and audit metadata.
   */
  impersonatedClientId: string | null;
}

/**
 * Resolve the impersonation state for the current request.
 *
 * If the realUser is not signed in, redirects to /login.
 * If a non-admin user has the cookie set somehow, the cookie is ignored
 * (returns isImpersonating=false). The cookie should be cleared by the
 * caller in that case to keep state clean.
 */
export async function getImpersonationContext(): Promise<ImpersonationContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const cookieValue = cookies().get(COOKIE_NAME)?.value ?? null;

  // Non-admins can never impersonate. Silently treat as no impersonation.
  if (user.profile.role !== "admin") {
    return {
      realUser: user,
      effectiveClientId: user.id,
      isImpersonating: false,
      impersonatedClientId: null,
    };
  }

  if (!cookieValue || !UUID_RE.test(cookieValue)) {
    return {
      realUser: user,
      effectiveClientId: user.id,
      isImpersonating: false,
      impersonatedClientId: null,
    };
  }

  return {
    realUser: user,
    effectiveClientId: cookieValue,
    isImpersonating: true,
    impersonatedClientId: cookieValue,
  };
}

/**
 * Lightweight "are we currently impersonating?" check for Server Actions.
 * Used by `requireNotImpersonating()` and by audit metadata.
 */
export async function readImpersonationCookie(): Promise<string | null> {
  const value = cookies().get(COOKIE_NAME)?.value;
  if (!value || !UUID_RE.test(value)) return null;
  return value;
}

/**
 * Guard at the top of every write-performing Server Action.
 *
 * Throws if impersonation is active. The thrown error is caught by the
 * action's normal error path and surfaces to the user as "Action
 * blocked while impersonating." This makes the rule a single line at
 * each call site rather than scattered visibility-toggle checks.
 *
 * Rationale: the alternative (disable buttons in the impersonated UI)
 * would have to be implemented at every interactive surface, and one
 * missed surface is a security incident. Failing closed at the action
 * boundary is the safer pattern.
 */
export class ImpersonationWriteBlockedError extends Error {
  constructor() {
    super(
      "This action is blocked while viewing as another user. Exit impersonation to make changes."
    );
    this.name = "ImpersonationWriteBlockedError";
  }
}

export async function requireNotImpersonating(): Promise<void> {
  const impersonating = await readImpersonationCookie();
  if (impersonating) {
    throw new ImpersonationWriteBlockedError();
  }
}

/**
 * Cookie name and config exposed for the start/stop Server Actions.
 * Kept here so the cookie's lifecycle parameters are co-located with
 * everything else that touches it.
 */
export const IMPERSONATION_COOKIE = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    // 4 hours — long enough for a normal admin session, short enough that
    // a forgotten impersonation auto-clears.
    maxAge: 60 * 60 * 4,
  },
};
