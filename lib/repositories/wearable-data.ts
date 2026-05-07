import "server-only";
import { Repository } from "./base";
import type { WearableDataPoint, WearableConnection } from "@/lib/types/database";

/**
 * Wearable data access.
 *
 * Beta reality: wearable data is populated by the deterministic seeder
 * (`security.seed_demo_wearable_data`) for demo clients. Week 2 brings
 * the real Oura OAuth + sync pipeline that writes to the same table
 * without `is_simulated=true`.
 *
 * This repository reads from `wearable_data_points` uniformly — callers
 * don't care whether the data is simulated or real. Analytics code that
 * should exclude simulated data filters explicitly on `is_simulated=false`.
 */

export interface DailyMetricPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export class WearableDataRepository extends Repository {
  /**
   * Fetch raw data points for a metric over the last N days.
   */
  async listMetric(
    clientId: string,
    metric: string,
    days: number = 30
  ): Promise<WearableDataPoint[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { data, error } = await this.client
      .from("wearable_data_points")
      .select("*")
      .eq("client_id", clientId)
      .eq("metric", metric)
      .gte("recorded_at", since.toISOString())
      .order("recorded_at", { ascending: true });

    if (error) {
      console.error("[wearableData.listMetric]", error);
      throw error;
    }
    return (data ?? []) as WearableDataPoint[];
  }

  /**
   * Return daily points with date (YYYY-MM-DD) keys. Convenience for
   * chart rendering — the repository is the right place to do the
   * date-bucket normalization so components receive clean data.
   */
  async dailyMetric(
    clientId: string,
    metric: string,
    days: number = 30
  ): Promise<DailyMetricPoint[]> {
    const points = await this.listMetric(clientId, metric, days);
    return points.map((p) => ({
      date: p.recorded_at.slice(0, 10),
      value: Number(p.value),
    }));
  }

  /**
   * Fetch the most recent value for a metric.
   */
  async latestValue(
    clientId: string,
    metric: string
  ): Promise<number | null> {
    const { data, error } = await this.client
      .from("wearable_data_points")
      .select("value")
      .eq("client_id", clientId)
      .eq("metric", metric)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[wearableData.latestValue]", error);
      throw error;
    }
    return data ? Number(data.value) : null;
  }

  /**
   * Rolling average of a metric across the last N days.
   */
  async rollingAverage(
    clientId: string,
    metric: string,
    days: number
  ): Promise<number | null> {
    const points = await this.listMetric(clientId, metric, days);
    if (points.length === 0) return null;
    const sum = points.reduce((acc, p) => acc + Number(p.value), 0);
    return sum / points.length;
  }

  /**
   * Get all Oura-syncable sleep stage data joined per day, in the shape
   * the sleep-architecture chart expects.
   */
  async sleepArchitecture(
    clientId: string,
    days: number = 7
  ): Promise<
    Array<{
      date: string;
      day: string; // "Mon", "Tue"
      total: number;
      deep: number;
      rem: number;
      light: number;
    }>
  > {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { data, error } = await this.client
      .from("wearable_data_points")
      .select("metric, value, recorded_at")
      .eq("client_id", clientId)
      .in("metric", [
        "sleep_total_min",
        "sleep_deep_min",
        "sleep_rem_min",
        "sleep_light_min",
      ])
      .gte("recorded_at", since.toISOString())
      .order("recorded_at", { ascending: true });

    if (error) {
      console.error("[wearableData.sleepArchitecture]", error);
      throw error;
    }

    // Group by date
    const byDate = new Map<
      string,
      { total: number; deep: number; rem: number; light: number }
    >();
    for (const row of data ?? []) {
      const date = row.recorded_at.slice(0, 10);
      const existing = byDate.get(date) ?? {
        total: 0,
        deep: 0,
        rem: 0,
        light: 0,
      };
      const key = row.metric.replace("sleep_", "").replace("_min", "") as
        | "total"
        | "deep"
        | "rem"
        | "light";
      existing[key] = Number(row.value);
      byDate.set(date, existing);
    }

    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        day: dayLabels[new Date(date + "T00:00:00").getDay()],
        ...v,
      }));
  }

  /**
   * Get active wearable connections for a client. Used to decide whether
   * to show "Connect Oura" CTA on the Biomarkers page.
   */
  async connectionsFor(clientId: string): Promise<WearableConnection[]> {
    const { data, error } = await this.client
      .from("wearable_connections")
      .select("*")
      .eq("client_id", clientId)
      .eq("status", "active");

    if (error) {
      console.error("[wearableData.connectionsFor]", error);
      throw error;
    }
    return (data ?? []) as WearableConnection[];
  }
}

export const wearableDataRepo = new WearableDataRepository();
