import "server-only";
import { Repository } from "./base";
import type { DailyLog, Insert, Update } from "@/lib/types/database";

export interface DailyLogInput {
  client_id: string;
  date: string; // ISO date (YYYY-MM-DD)
  weight_lbs?: number | null;
  waist_inches?: number | null;
  steps?: number | null;
  sleep_hours?: number | null;
  mood_score?: number | null;
  energy_score?: number | null;
  hunger_score?: number | null;
  notes?: string | null;
}

export class DailyLogsRepository extends Repository {
  /**
   * Fetch the last N days of self-reported logs for a client, ascending by date.
   * Returns empty array if no data yet.
   */
  async listForClient(
    clientId: string,
    days: number = 30
  ): Promise<DailyLog[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const sinceIso = since.toISOString().slice(0, 10);

    const { data, error } = await this.client
      .from("daily_logs")
      .select("*")
      .eq("client_id", clientId)
      .gte("date", sinceIso)
      .order("date", { ascending: true });

    if (error) {
      console.error("[dailyLogs.listForClient]", error);
      throw error;
    }
    return (data ?? []) as DailyLog[];
  }

  /**
   * Get the most recent log entry for a client. Useful for "current weight"
   * style fields on the Overview dashboard.
   */
  async latestForClient(clientId: string): Promise<DailyLog | null> {
    const { data, error } = await this.client
      .from("daily_logs")
      .select("*")
      .eq("client_id", clientId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[dailyLogs.latestForClient]", error);
      throw error;
    }
    return data as DailyLog | null;
  }

  /**
   * Upsert a day. Creates if it doesn't exist, updates fields provided.
   * Used by the client daily-entry form.
   */
  async upsertDay(input: DailyLogInput): Promise<DailyLog> {
    const { data, error } = await this.client
      .from("daily_logs")
      .upsert(
        {
          client_id: input.client_id,
          date: input.date,
          weight_lbs: input.weight_lbs ?? null,
          waist_inches: input.waist_inches ?? null,
          steps: input.steps ?? null,
          sleep_hours: input.sleep_hours ?? null,
          mood_score: input.mood_score ?? null,
          energy_score: input.energy_score ?? null,
          hunger_score: input.hunger_score ?? null,
          notes: input.notes ?? null,
          is_simulated: false, // user-entered data is always real
        },
        { onConflict: "client_id,date" }
      )
      .select()
      .single();

    if (error) {
      console.error("[dailyLogs.upsertDay]", error);
      throw error;
    }
    return data as DailyLog;
  }
}

export const dailyLogsRepo = new DailyLogsRepository();
