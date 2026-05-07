import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — BYPASSES ROW-LEVEL SECURITY.
 *
 * Used only on the server, for operations that legitimately need to bypass RLS:
 *   - Writing to append-only `audit_log` (users cannot insert directly)
 *   - Admin operations that touch records across clients
 *   - Wearable sync workers ingesting data for multiple clients
 *   - Inviting new users (creating auth users from admin)
 *
 * CRITICAL GUARDRAILS:
 *   - Never use in Client Components or browser-facing code
 *   - Never use where RLS would have sufficed — always prefer the user-scoped
 *     server client. Using service-role means YOU are responsible for access
 *     control, because the database will let you read/write anything.
 *   - Always write an audit log entry when using this client to act on a
 *     specific user's data (transparency principle).
 *
 * The `server-only` import at the top of this file causes Next.js to throw
 * a build error if this module is ever imported into client code.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
