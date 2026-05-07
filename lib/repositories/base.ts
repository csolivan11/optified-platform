import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Base class for repositories.
 *
 * Repositories are the single place application code talks to the database.
 * Every database query in the app goes through a repository method — no
 * direct Supabase calls in components, pages, or route handlers.
 *
 * Why:
 *   1. PHI migration boundary. When PHI tables move to AWS RDS, only the
 *      PHI-specific repository files change. Everything else stays identical.
 *   2. Centralized input validation (Zod schemas wrap method arguments).
 *   3. Centralized audit logging (high-sensitivity methods log automatically).
 *   4. Easier testing — repositories can be mocked cleanly.
 *   5. Type safety — method signatures are the contract, not raw query shapes.
 *
 * Subclasses declare their default client (user-scoped, RLS-enforced) and
 * methods call `.client` for reads/writes that should respect RLS. If a
 * specific method needs service-role (e.g. writing an audit log entry), it
 * imports that client separately — it's never available by default.
 */
export abstract class Repository {
  protected get client(): SupabaseClient {
    // Each property access returns a fresh server client bound to the
    // current request's cookies. This is correct — we don't want to cache
    // a client across requests.
    return createClient();
  }
}
