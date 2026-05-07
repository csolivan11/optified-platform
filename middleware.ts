import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Middleware runs on every matched request. Its jobs:
 *
 *   1. Refresh the Supabase auth session (rotates refresh token if near expiry)
 *   2. Redirect unauthenticated users away from protected routes
 *   3. Redirect signed-in users away from auth-only routes (/login, /signup)
 *
 * Role-based redirects (client vs coach vs admin) happen inside each route
 * group's layout, because middleware doesn't have clean access to the user's
 * profile.role — we'd need a separate DB round-trip here and we already pay
 * for one in the layout.
 */

const PUBLIC_PATHS = ["/login", "/reset-password", "/accept-invite", "/set-password"];
const AUTH_ONLY_PATHS = ["/login", "/reset-password"]; // redirect signed-in users away

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: this call refreshes the session. Removing it will break auth.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
  const isAuthOnly = AUTH_ONLY_PATHS.some((p) => path.startsWith(p));

  // Not signed in + trying to access a protected route → send to login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Signed in + on an auth-only page → send to their dashboard
  // (Role-specific redirect happens in the root page component.)
  if (user && isAuthOnly) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - api/auth/callback (OAuth return path, handles its own cookies)
     * - public files with extensions (e.g. .svg, .png)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
