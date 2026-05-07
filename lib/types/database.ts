/**
 * Database schema types.
 *
 * NOTE: In production, these should be generated from the live schema using:
 *   supabase gen types typescript --local > lib/types/database.generated.ts
 *
 * For Phase 2B we hand-write the types that the application needs. When Phase 2
 * is fully deployed, a `pnpm run gen:types` script will overwrite the generated
 * file from the running database. The hand-written types in THIS file will
 * remain as the application-facing contract — we re-export from here, not from
 * the generated file directly, so changes can be audited.
 */

// ─── Enum types (mirror SQL enums) ─────────────────────────
export type UserRole = "client" | "coach" | "admin";

export type ProgramTier =
  | "foundation"
  | "accelerator"
  | "elite"
  | "apex"
  | "vip";

export type EnrollmentStatus =
  | "active"
  | "paused"
  | "completed"
  | "withdrawn";

export type TaskStatus = "pending" | "in_progress" | "complete";

export type AdherenceSource = "manual" | "sms_reply" | "auto";

export type WearableProvider =
  | "oura"
  | "whoop"
  | "garmin"
  | "apple_health"
  | "fitbit";

export type WearableConnectionStatus = "active" | "expired" | "revoked";

export type FunctionalCategory =
  | "strength"
  | "endurance"
  | "mobility"
  | "body_comp";

export type EducationTriggerType =
  | "biomarker_range"
  | "protocol_match"
  | "manual_assign";

export type NotificationType =
  | "system"
  | "alert"
  | "milestone"
  | "reminder"
  | "coach_message";

// ─── Row types (match SQL tables) ──────────────────────────

export interface Profile {
  id: string;
  role: UserRole;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface CoachAssignment {
  id: string;
  client_id: string;
  coach_id: string;
  is_primary: boolean;
  assigned_at: string;
  unassigned_at: string | null;
  created_at: string;
}

export interface Program {
  id: string;
  name: string;
  tier: ProgramTier;
  duration_weeks: number;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProgramPhase {
  id: string;
  program_id: string;
  name: string;
  sequence: number;
  description: string | null;
  created_at: string;
}

export interface ProgramTask {
  id: string;
  phase_id: string;
  title: string;
  description: string | null;
  sequence: number;
  auto_detected: boolean;
  detection_rule: Record<string, unknown> | null;
  created_at: string;
}

export interface ClientEnrollment {
  id: string;
  client_id: string;
  program_id: string;
  started_at: string;
  current_phase_id: string | null;
  status: EnrollmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientTaskStatus {
  id: string;
  enrollment_id: string;
  task_id: string;
  status: TaskStatus;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Supplement {
  id: string;
  name: string;
  category: string | null;
  default_dose: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientSupplement {
  id: string;
  client_id: string;
  supplement_id: string;
  dose: string;
  frequency: string;
  protocol_name: string | null;
  start_date: string;
  end_date: string | null;
  active: boolean;
  prescribed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplementAdherence {
  id: string;
  client_supplement_id: string;
  date: string;
  taken: boolean;
  recorded_at: string;
  recorded_via: AdherenceSource;
}

export interface ClientExerciseProtocol {
  id: string;
  client_id: string;
  activity: string;
  frequency: string;
  duration: string | null;
  notes: string | null;
  active: boolean;
  prescribed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientNutritionTarget {
  id: string;
  client_id: string;
  diet_template: string | null;
  calories: number | null;
  protein_servings: number | null;
  carb_servings: number | null;
  fat_servings: number | null;
  veg_servings: number | null;
  fruit_servings: number | null;
  fiber_grams: number | null;
  effective_from: string;
  effective_until: string | null;
  prescribed_by: string | null;
  created_at: string;
}

export interface DailyLog {
  id: string;
  client_id: string;
  date: string;
  weight_lbs: number | null;
  waist_inches: number | null;
  steps: number | null;
  sleep_hours: number | null;
  mood_score: number | null;
  energy_score: number | null;
  hunger_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WearableConnection {
  id: string;
  client_id: string;
  provider: WearableProvider;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  provider_user_id: string | null;
  scope: string | null;
  connected_at: string;
  last_sync_at: string | null;
  status: WearableConnectionStatus;
  created_at: string;
  updated_at: string;
}

export interface WearableDataPoint {
  id: string;
  client_id: string;
  provider: WearableProvider;
  metric: string;
  value: number;
  unit: string | null;
  recorded_at: string;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
}

export interface FunctionalMetric {
  id: string;
  client_id: string;
  metric_name: string;
  category: FunctionalCategory;
  value: number;
  unit: string;
  recorded_at: string;
  baseline_value: number | null;
  target_value: number | null;
  lower_is_better: boolean;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface CoachNote {
  id: string;
  client_id: string;
  coach_id: string;
  content: string;
  week_number: number | null;
  visible_to_client: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ClientCheckIn {
  id: string;
  client_id: string;
  week_number: number;
  video_url: string | null;
  questions: string | null;
  coach_response: string | null;
  responded_by: string | null;
  submitted_at: string;
  responded_at: string | null;
  created_at: string;
}

export interface EducationArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  category: string | null;
  read_time_min: number | null;
  cover_image_url: string | null;
  published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientArticleAssignment {
  id: string;
  client_id: string;
  article_id: string;
  reason: string | null;
  assigned_by: string | null;
  assigned_at: string;
  read_at: string | null;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_role: UserRole | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  target_client_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

// ─── Insert/Update helper types ────────────────────────────
// Reusable patterns for repository write methods.

export type Insert<T> = Omit<T, "id" | "created_at" | "updated_at">;
export type Update<T> = Partial<Omit<T, "id" | "created_at" | "updated_at">>;
