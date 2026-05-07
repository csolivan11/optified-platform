import "server-only";
import { Repository } from "./base";
import type {
  Supplement,
  ClientSupplement,
  SupplementAdherence,
  AdherenceSource,
} from "@/lib/types/database";

/**
 * Client supplement with the joined master-catalog name and a 7-day
 * adherence array (most-recent-last).
 */
export interface ClientSupplementWithAdherence extends ClientSupplement {
  supplement: Pick<Supplement, "id" | "name" | "category" | "notes">;
  /**
   * Adherence for the last 7 days, oldest first.
   * Each entry is true (taken), false (not taken), or null (not yet recorded).
   */
  weekAdherence: Array<{ date: string; taken: boolean | null }>;
  /**
   * Percentage of taken vs (taken + not-taken). Null entries are excluded
   * from the calculation — a brand-new prescription with no adherence
   * data yet returns 0/0 = null.
   */
  adherencePercent: number | null;
}

export class SupplementsRepository extends Repository {
  /**
   * Get all active prescriptions for a client with adherence rolled up.
   */
  async listActiveForClient(
    clientId: string
  ): Promise<ClientSupplementWithAdherence[]> {
    // 1. Active prescriptions joined with supplement catalog
    const { data: prescriptions, error: rxErr } = await this.client
      .from("client_supplements")
      .select(
        `
        *,
        supplement:supplements!inner(id, name, category, notes)
        `
      )
      .eq("client_id", clientId)
      .eq("active", true)
      .order("protocol_name", { ascending: true });

    if (rxErr) {
      console.error("[supplements.listActiveForClient:rx]", rxErr);
      throw rxErr;
    }
    const rxList = (prescriptions ?? []) as Array<
      ClientSupplement & {
        supplement: Pick<Supplement, "id" | "name" | "category" | "notes">;
      }
    >;
    if (rxList.length === 0) return [];

    // 2. Adherence for last 7 days for each prescription, single query
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoIso = sevenDaysAgo.toISOString().slice(0, 10);

    const { data: adherence, error: adhErr } = await this.client
      .from("supplement_adherence")
      .select("*")
      .in(
        "client_supplement_id",
        rxList.map((r) => r.id)
      )
      .gte("date", sevenDaysAgoIso);

    if (adhErr) {
      console.error("[supplements.listActiveForClient:adh]", adhErr);
      throw adhErr;
    }

    // 3. Build the 7-day window (oldest -> newest)
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      days.push(d.toISOString().slice(0, 10));
    }

    // Group adherence by prescription
    const adhByRx = new Map<string, Map<string, boolean>>();
    for (const a of (adherence ?? []) as SupplementAdherence[]) {
      if (!adhByRx.has(a.client_supplement_id)) {
        adhByRx.set(a.client_supplement_id, new Map());
      }
      adhByRx.get(a.client_supplement_id)!.set(a.date, a.taken);
    }

    return rxList.map((rx) => {
      const adh = adhByRx.get(rx.id) ?? new Map();
      const week = days.map((date) => ({
        date,
        taken: adh.has(date) ? (adh.get(date) ?? null) : null,
      }));
      const recorded = week.filter((d) => d.taken !== null);
      const taken = recorded.filter((d) => d.taken === true).length;
      const adherencePercent =
        recorded.length === 0 ? null : Math.round((taken / recorded.length) * 100);

      return {
        ...rx,
        weekAdherence: week,
        adherencePercent,
      };
    });
  }

  /**
   * Record adherence for a specific prescription on a specific date.
   * Used by the daily check-off widget.
   */
  async recordAdherence(input: {
    client_supplement_id: string;
    date: string;
    taken: boolean;
    recorded_via?: AdherenceSource;
  }): Promise<void> {
    const { error } = await this.client.from("supplement_adherence").upsert(
      {
        client_supplement_id: input.client_supplement_id,
        date: input.date,
        taken: input.taken,
        recorded_via: input.recorded_via ?? "manual",
        recorded_at: new Date().toISOString(),
      },
      { onConflict: "client_supplement_id,date" }
    );

    if (error) {
      console.error("[supplements.recordAdherence]", error);
      throw error;
    }
  }
}

export const supplementsRepo = new SupplementsRepository();

// ─── Admin-facing extensions ────────────────────────────────

export interface SupplementAdminListItem extends Supplement {
  activePrescriptionCount: number;
}

export interface CreateSupplementInput {
  name: string;
  category?: string | null;
  default_dose?: string | null;
  notes?: string | null;
}

export interface UpdateSupplementInput {
  name?: string;
  category?: string | null;
  default_dose?: string | null;
  notes?: string | null;
  active?: boolean;
}

declare module "./supplements" {
  interface SupplementsRepository {
    listForAdmin(includeInactive?: boolean): Promise<SupplementAdminListItem[]>;
    findByIdForAdmin(id: string): Promise<Supplement | null>;
    createSupplement(input: CreateSupplementInput): Promise<Supplement>;
    updateSupplement(
      id: string,
      patch: UpdateSupplementInput
    ): Promise<Supplement>;
  }
}

SupplementsRepository.prototype.listForAdmin = async function (
  includeInactive: boolean = true
): Promise<SupplementAdminListItem[]> {
  let q = this.client
    .from("supplements")
    .select("*")
    .order("name", { ascending: true });
  if (!includeInactive) q = q.eq("active", true);

  const [supplementsR, prescriptionsR] = await Promise.all([
    q,
    this.client
      .from("client_supplements")
      .select("supplement_id")
      .eq("active", true),
  ]);

  if (supplementsR.error) throw supplementsR.error;

  const counts = new Map<string, number>();
  for (const cs of prescriptionsR.data ?? []) {
    counts.set(cs.supplement_id, (counts.get(cs.supplement_id) ?? 0) + 1);
  }

  return ((supplementsR.data ?? []) as Supplement[]).map((s) => ({
    ...s,
    activePrescriptionCount: counts.get(s.id) ?? 0,
  }));
};

SupplementsRepository.prototype.findByIdForAdmin = async function (
  id: string
): Promise<Supplement | null> {
  const { data, error } = await this.client
    .from("supplements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Supplement | null;
};

SupplementsRepository.prototype.createSupplement = async function (
  input: CreateSupplementInput
): Promise<Supplement> {
  const { data, error } = await this.client
    .from("supplements")
    .insert({
      name: input.name.trim(),
      category: input.category ?? null,
      default_dose: input.default_dose ?? null,
      notes: input.notes ?? null,
      active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Supplement;
};

SupplementsRepository.prototype.updateSupplement = async function (
  id: string,
  patch: UpdateSupplementInput
): Promise<Supplement> {
  const { data, error } = await this.client
    .from("supplements")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Supplement;
};
