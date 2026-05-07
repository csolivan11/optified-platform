"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components.
 *
 * Uses @supabase/ssr so that auth cookies are shared between the browser and
 * server — enabling Server Components to read the authenticated session on
 * first render without a flash of unauthenticated content.
 *
 * Usage:
 *   const supabase = createClient();
 *   const { data } = await supabase.from("profiles").select();
 *
 * RLS is enforced: queries only return rows the authenticated user is allowed
 * to see. Never use this client to bypass RLS — use the service-role client
 * server-side for that.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
