/**
 * Repository index — single entry point for all data access.
 *
 * Phase 2B ships with the core repositories wired up. Additional
 * repositories (programs, supplements, daily logs, wearables, functional
 * metrics, coaching, education) are stubbed as TODO markers and will be
 * implemented in Phase 4 as their respective UI surfaces come online.
 *
 * The PHI-deferred domains (bloodwork, specialty tests, clinical notes,
 * medical documents) intentionally have NO repository files. The absence
 * is the enforcement — there is no way for application code to reach
 * phi_stub.* tables because there is no data access function defined for
 * them. When PHI infrastructure is activated, new files are added here
 * (e.g. `bloodwork.ts`) that route to the appropriate backend.
 */

export { profilesRepo, ProfilesRepository } from "./profiles";
export { auditRepo, AuditRepository, AuditActions } from "./audit";
export type {
  AuditAction,
  AuditWrite,
  AuditLogEntryWithNames,
  AuditListFilters,
} from "./audit";
export {
  invitesRepo,
  InvitesRepository,
  InviteAlreadyExistsError,
  type InviteRow,
  type InviteCreateInput,
  type CreatedInvite,
} from "./invites";
export { dailyLogsRepo, DailyLogsRepository, type DailyLogInput } from "./daily-logs";
export { wearableDataRepo, WearableDataRepository, type DailyMetricPoint } from "./wearable-data";
export {
  programsRepo,
  ProgramsRepository,
  type EnrollmentDetails,
  type PhaseWithTaskProgress,
  type TaskWithStatus,
  type ProgramCatalogEntry,
} from "./programs";
export {
  supplementsRepo,
  SupplementsRepository,
  type ClientSupplementWithAdherence,
  type SupplementAdminListItem,
  type CreateSupplementInput,
  type UpdateSupplementInput,
} from "./supplements";
export {
  functionalMetricsRepo,
  FunctionalMetricsRepository,
  type FunctionalMetricLatest,
} from "./functional-metrics";
export {
  coachNotesRepo,
  CoachNotesRepository,
  type CoachNoteWithAuthor,
} from "./coach-notes";
export {
  educationRepo,
  EducationRepository,
  type AssignedArticle,
  type ArticleAdminListItem,
  type CreateArticleInput,
  type UpdateArticleInput,
} from "./education";
export {
  coachingRepo,
  CoachingRepository,
  type PipelineRow,
  type ClientDetailSummary,
  type RiskTier,
  type CohortOutcomes,
  type UpcomingItem,
  type ActionableAlert,
} from "./coaching";

// ─── PHI-deferred (no beta implementation by design) ───
// bloodworkRepo — UI shows InDevelopmentNotice instead
// specialtyTestsRepo — UI shows InDevelopmentNotice instead
// medicalDocumentsRepo — UI shows InDevelopmentNotice instead
// clinicalNotesRepo — folded into coach_notes for beta
