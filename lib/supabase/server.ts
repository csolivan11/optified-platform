import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use in Server Components, Route Handlers, and Server Actions.
 *
 * Reads session cookies from the Next.js request context. RLS is enforced —
 * this client authenticates as the signed-in user.
 *
 * Usage in a Server Component:
 *   const supabase = createClient();
 *   const { data } = await supabase.from("profiles").select();
 *
 * Note: this must be instantiated per-request (don't hoist it to module scope),
 * because it binds to the current request's cookie store.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // `set` may throw when called from a Server Component that
            // hasn't opted into cookie writing. Middleware handles session
            // refresh, so we can safely ignore this in Server Components.
          }
        },
      },
    }
  );
}
