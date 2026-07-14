import { createClient } from "@/lib/supabase/client";

/**
 * Base class for repositories in the client-side Static SPA architecture.
 *
 * All data access is routed through client-side API requests to the Go backend
 * instead of direct Supabase queries. This decouples the UI from the database
 * schema and ensures all PHI constraints are enforced inside the Go binary.
 */
export abstract class Repository {
  /**
   * Helper to execute authenticated HTTP fetch requests to the Go API backend.
   * Automatically extracts the active user session JWT token from Supabase Auth
   * and attaches it as a Bearer Authorization header.
   */
  protected async apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJSON;
      try {
        errorJSON = JSON.parse(errorText);
      } catch {
        // Not JSON
      }
      
      const errorMessage = errorJSON?.error || `API Request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    // Handle 204 No Content safely
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }
}
