import "server-only";
import { Repository } from "./base";
import type {
  FunctionalMetric,
  FunctionalCategory,
} from "@/lib/types/database";

/**
 * The shape Functional Metrics tab consumes: most-recent entry per
 * unique metric_name within a category, plus the prior value for trend.
 */
export interface FunctionalMetricLatest {
  metric_name: string;
  category: FunctionalCategory;
  unit: string;
  value: number;
  previous_value: number | null;
  baseline_value: number | null;
  target_value: number | null;
  lower_is_better: boolean;
  recorded_at: string;
}

export class FunctionalMetricsRepository extends Repository {
  /**
   * Get the most recent value per unique metric_name for a client,
   * grouped by category. Each entry includes the prior value for trend.
   */
  async latestByCategory(
    clientId: string
  ): Promise<Record<FunctionalCategory, FunctionalMetricLatest[]>> {
    // Fetch all entries for the client, ordered by metric+date desc, then
    // collapse client-side into latest + previous per metric. For beta scale
    // (a few dozen entries per client) this is fine; if it grows, we move
    // to a dedicated SQL view with DISTINCT ON.
    const { data, error } = await this.client
      .from("functional_metrics")
      .select("*")
      .eq("client_id", clientId)
      .order("metric_name", { ascending: true })
      .order("recorded_at", { ascending: false });

    if (error) {
      console.error("[functionalMetrics.latestByCategory]", error);
      throw error;
    }

    const rows = (data ?? []) as FunctionalMetric[];

    // Group by metric_name, keep latest + immediate prior
    const byMetric = new Map<string, FunctionalMetric[]>();
    for (const row of rows) {
      const arr = byMetric.get(row.metric_name) ?? [];
      arr.push(row);
      byMetric.set(row.metric_name, arr);
    }

    // Bucket by category
    const result: Record<FunctionalCategory, FunctionalMetricLatest[]> = {
      strength: [],
      endurance: [],
      mobility: [],
      body_comp: [],
    };

    for (const [, entries] of byMetric) {
      const latest = entries[0];
      const prior = entries[1] ?? null;
      result[latest.category].push({
        metric_name: latest.metric_name,
        category: latest.category,
        unit: latest.unit,
        value: Number(latest.value),
        previous_value: prior ? Number(prior.value) : null,
        baseline_value:
          latest.baseline_value !== null ? Number(latest.baseline_value) : null,
        target_value:
          latest.target_value !== null ? Number(latest.target_value) : null,
        lower_is_better: latest.lower_is_better,
        recorded_at: latest.recorded_at,
      });
    }

    return result;
  }
}

export const functionalMetricsRepo = new FunctionalMetricsRepository();
