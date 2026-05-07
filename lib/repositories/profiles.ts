import "server-only";
import { Repository } from "./base";
import type { Profile, UserRole, Update } from "@/lib/types/database";

export class ProfilesRepository extends Repository {
  /**
   * Fetch a profile by ID. RLS ensures the caller can only see profiles
   * they have access to (self, their coach's clients, or any if admin).
   */
  async findById(id: string): Promise<Profile | null> {
    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[profiles.findById]", error);
      throw error;
    }
    return data as Profile | null;
  }

  /**
   * Find profile by email — used during invite flow to detect duplicates.
   * Requires admin privileges per RLS.
   */
  async findByEmail(email: string): Promise<Profile | null> {
    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error("[profiles.findByEmail]", error);
      throw error;
    }
    return data as Profile | null;
  }

  /**
   * List all clients for a coach. Coach sees their own assigned clients;
   * admin sees all clients.
   */
  async listClientsForCoach(coachId: string): Promise<Profile[]> {
    const { data, error } = await this.client
      .from("coach_assignments")
      .select(
        `
        client_id,
        client:profiles!coach_assignments_client_id_fkey(*)
        `
      )
      .eq("coach_id", coachId)
      .is("unassigned_at", null);

    if (error) {
      console.error("[profiles.listClientsForCoach]", error);
      throw error;
    }
    // Flatten the join result
    return (data ?? []).map(
      (row: { client: Profile }) => row.client
    ) as Profile[];
  }

  /**
   * Update a user's own profile fields.
   */
  async update(id: string, patch: Update<Profile>): Promise<Profile> {
    const { data, error } = await this.client
      .from("profiles")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[profiles.update]", error);
      throw error;
    }
    return data as Profile;
  }

  /**
   * List all clients (admin only — RLS enforces). Used by the admin
   * impersonation surface.
   */
  async listAllClients(limit: number = 100): Promise<Profile[]> {
    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("role", "client")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[profiles.listAllClients]", error);
      throw error;
    }
    return (data ?? []) as Profile[];
  }

  /**
   * Change a user's role. Admin only (enforced by RLS).
   */
  async setRole(id: string, role: UserRole): Promise<void> {
    const { error } = await this.client
      .from("profiles")
      .update({ role })
      .eq("id", id);

    if (error) {
      console.error("[profiles.setRole]", error);
      throw error;
    }
  }
}

// Singleton-style export. Each request gets a fresh client via the getter.
export const profilesRepo = new ProfilesRepository();
