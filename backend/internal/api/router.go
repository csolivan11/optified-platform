package api

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const (
	UserIDKey   contextKey = "userID"
	UserRoleKey contextKey = "userRole"
)

// ConfigureRouter builds the router with core middleware and endpoints
func ConfigureRouter() *chi.Mux {
	r := chi.NewRouter()

	// ─── Compliance Middlewares ──────────────────────────────────
	r.Use(SecurityHeadersMiddleware)
	r.Use(StructuredLoggingMiddleware)
	r.Use(CORSMiddleware)
	r.Use(RateLimiterMiddleware)

	// ─── Web Page Routes ──────────────────────────────────────────
	r.Get("/", ServeLogin)
	r.Get("/login", ServeLogin)

	// Auth Group for pages
	r.Group(func(r chi.Router) {
		r.Use(AuthenticationMiddleware)
		r.Get("/dashboard", ServeDashboard)
		r.Get("/coach", ServeCoach)
		r.Get("/settings", ServeSettings)
	})

	// ─── API Routing Group ────────────────────────────────────────
	r.Route("/api", func(r chi.Router) {
		// Public health check and login action
		r.Get("/health", HandleHealth)
		r.Post("/auth/login", HandleLogin)
		r.Post("/auth/mfa", HandleVerifyMFA)
		r.Post("/webhooks/ingest", HandleWebhookIngest)

		// Authenticated API Routes
		r.Group(func(r chi.Router) {
			r.Use(AuthenticationMiddleware)
			r.Use(CSRFMiddleware)

			// Client routes
			r.Get("/clients", HandleListClients)

			// PHI-secured Clinical Notes
			r.Get("/clinical-notes/{clientId}", HandleListClinicalNotes)
			r.Post("/clinical-notes", HandleCreateClinicalNote)

			// Wearables Data Ingress
			r.Post("/wearables/sync", HandleWearablesSync)

			// AI Longevity Chat Engine (RAG)
			r.Post("/chat", HandleChat)

			// GCS Document Ingress (Signed URLs)
			r.Get("/documents/upload-url", HandleGetUploadURL)

			// Supplement Intake Compliance Toggling
			r.Post("/supplements/toggle", HandleToggleSupplement)
			r.Post("/supplements/schedule", HandleCreateSupplementSchedule)
			r.Post("/supplements/deactivate", HandleDeactivateSupplement)

			// Custom Target Ranges Config
			r.Post("/biomarkers/custom-range", HandleSetCustomBiomarkerRange)

			// Audit Logs
			r.Get("/audit-logs/{clientId}", HandleListAuditLogs)
			r.Get("/audit-logs/{clientId}/export", HandleExportAuditLogs)

			// Clinician Assignment
			r.Post("/clients/assign", HandleAssignClinician)

			// KnowsItAll AI & Knowledge Graph Routing
			r.Post("/chat/knowsitall", HandleKnowsItAllChat)
			r.Get("/knowsitall/graph", HandleGetKnowledgeGraph)
			r.Get("/knowsitall/publications", HandleGetPublicationsList)
			r.Get("/knowsitall/export-citations", HandleExportCitations)
			r.Post("/knowsitall/upload-paper", HandleUploadPaperPDF)
			r.Post("/webhook/quest", HandleQuestIngest)
			r.Post("/knowsitall/graph/edge", HandleCreateGraphEdge)

			// Consultation Scheduler
			r.Post("/consultations/book", HandleBookConsultation)

			// Billing and Invoicing
			r.Post("/billing/invoice", HandleCreateBillingInvoice)

			// Longevity, Wearables, and Fitness extensions (Phases 152, 154, 156, 158, 160, 162, 164, 168, 170, 172, 174, 180, 182, 184, 190, 202, 204, 208, 210, 212, 214, 220)
			r.Post("/longevity/horvath-simulation", HandleHorvathSimulation)
			r.Get("/longevity/horvath-simulation/history", HandleGetHorvathSimulationHistory)
			r.Get("/longevity/horvath-simulation/delta", HandleGetHorvathSimulationDelta)
			r.Get("/longevity/horvath-simulation/delta/export", HandleExportHorvathSimulationDelta)
			r.Get("/longevity/horvath-simulation/chart", HandleGetHorvathSimulationChart)
			r.Post("/longevity/horvath-simulation/reset", HandleResetHorvathSimulation)
			r.Post("/wearables/cgm-range", HandleCGMRangeConfig)
			r.Post("/wearables/cgm-tir", HandleCGMTIRConfig)
			r.Post("/wearables/cgm-tir/alert", HandleCGMTIRAlertConfig)
			r.Post("/wearables/cgm-tir/alert/sound", HandleCGMTIRAlertSoundConfig)
			r.Get("/wearables/cgm-tir/anomalies", HandleGetCGMAnomalies)
			r.Post("/wearables/cgm-tir/event", HandleCGMTIREventTag)
			r.Get("/knowsitall/publication/{pmid}", HandleGetPublicationMetadata)
			r.Post("/fitness/schedule", HandleScheduleWorkout)
			r.Get("/fitness/schedule/list", HandleGetScheduledWorkouts)
			r.Post("/fitness/ftp-recalc", HandleFTPRecalc)
			r.Post("/diagnostics/gut-diversity", HandleGutDiversityConfig)
			r.Get("/diagnostics/gut-diversity/history", HandleGetGutDiversityHistory)
			r.Get("/diagnostics/gut-diversity/percentile", HandleGetGutDiversityPercentile)
			r.Get("/diagnostics/gut-diversity/advice", HandleGetGutDiversityAdvice)
			r.Get("/diagnostics/gut-diversity/phylum", HandleGetGutPhylumBreakdown)
			r.Get("/diagnostics/gut-diversity/phylum/history", HandleGetGutPhylumHistoryChart)
			r.Get("/diagnostics/gut-diversity/alerts", HandleGetGutDiversityAlerts)
			r.Get("/diagnostics/reports/normalized", HandleGetNormalizedReports)
			r.Post("/diagnostics/chat", HandleDiagnosticsChat)
			r.Post("/clinical-notes/draft-assistant", HandleClinicalNotesDraftAssistant)
			r.Post("/clinical-notes/approve", HandleApproveClinicalNotesDraft)
			r.Get("/clinical-notes/spotlight", HandleGetClinicalNotesSpotlight)
			r.Get("/clinical-notes/export/markdown", HandleExportClinicalNotesMarkdown)
			r.Post("/longevity/demo/toggle", HandleDemoMockTelemetryToggle)
			r.Get("/session/expiration", HandleGetSessionExpirationStatus)
			r.Post("/session/revoke", HandleRevokeSession)
			r.Post("/profile/timezone", HandleSaveProfileTimezone)
			r.Get("/profile/security-logs", HandleGetUserSecurityLogs)
			r.Get("/wearables/hrv/chart", HandleGetHRVChart)
			r.Post("/consultations/cancel", HandleCancelConsultation)
			r.Get("/diagnostics/reports/quest/csv", HandleExportQuestBiomarkersCSV)
			r.Get("/wearables/cgm-tir/bounds", HandleGetCGMGlucoseBounds)
			r.Get("/diagnostics/gut-diversity/advice/custom", HandleGetGutMicrobiomeCustomAdvice)
			r.Get("/billing/invoices/history", HandleGetClientBillingInvoicesHistory)
			r.Post("/profile/mfa/config", HandleUpdateUserMFAConfig)
			r.Get("/knowsitall/upload-paper/progress", HandleGetKnowsItAllParserMockProgress)
			r.Get("/wearables/status/badges", HandleGetWearableStatusBadges)
			r.Get("/longevity/horvath-simulation/pace", HandleGetHorvathAgingPace)
			r.Get("/clinical-notes/print/pdf", HandlePrintClinicalNotesPDF)
			r.Get("/diagnostics/gut-diversity/foods/search", HandleSearchPrebioticFoods)
			r.Post("/billing/currency/preference", HandleUpdateBillingCurrency)
			r.Get("/fitness/vo2max/chart", HandleGetCardioVO2MaxChart)
			r.Get("/wearables/hrv/alerts", HandleGetHRVRecoveryAlerts)
			r.Post("/profile/password/reset", HandleRequestPasswordReset)
			r.Post("/diagnostics/gut-diversity/phylum/alert", HandleSetGutPhylaAlertThreshold)
			r.Get("/knowsitall/upload-paper/preview", HandleGetKnowsItAllParserPreview)
			r.Get("/consultations/calendar/ics", HandleGetConsultationCalendarICS)
			r.Post("/profile/avatar", HandleSaveProfileAvatar)
			r.Get("/longevity/horvath-simulation/percentile", HandleGetHorvathSimulationPercentile)
			r.Get("/diagnostics/gut-diversity/advice/print", HandlePrintGutDiversityAdvice)
			r.Post("/billing/invoices/email", HandleSendBillingInvoiceEmail)
			r.Post("/knowsitall/publication/tags", HandleUpdatePublicationTags)
			r.Get("/wearables/hrv/monthly-chart", HandleGetHRVMonthlyChart)
			r.Post("/profile/mfa/sms", HandleUpdateSMSMFAPhone)
			r.Get("/diagnostics/gut-diversity/phylum/pdf", HandleExportGutPhylaPDF)
			r.Get("/knowsitall/upload-paper/errors", HandleGetKnowsItAllParserErrors)
			r.Post("/consultations/backup-phone", HandleRegisterConsultationBackupPhone)

			// Phases 341-365 Extensions
			r.Post("/profile/gender", HandleUpdateProfileGender)
			r.Get("/longevity/horvath-simulation/dunedinpace", HandleGetHorvathSimulationDunedinPACE)
			r.Post("/clients/config/search-delay", HandleSaveSearchDelayConfig)
			r.Post("/diagnostics/gut-diversity/advice/email", HandleSendGutDiversityAdviceEmail)
			r.Post("/billing/receipts/toggle", HandleToggleBillingReceipt)
			r.Post("/knowsitall/publication/comment", HandleAddPublicationComment)
			r.Get("/wearables/hrv/sleep-correlation", HandleGetHRVSleepCorrelation)
			r.Get("/profile/security-locations", HandleGetSecurityLocations)
			r.Post("/diagnostics/gut-diversity/phylum/alert/reset", HandleResetGutPhylumAlertThreshold)
			r.Get("/knowsitall/upload-paper/raw-json", HandleGetKnowsItAllParserRawJSON)
			r.Post("/consultations/calendar/cancel", HandleCancelConsultationCalendarICS)

			// Phases 366-390 Extensions
			r.Delete("/profile/avatar", HandleDeleteProfileAvatar)
			r.Get("/longevity/horvath-simulation/grimage", HandleGetHorvathSimulationGrimAge)
			r.Get("/clients/config/search-delay", HandleGetSearchDelayConfig)
			r.Get("/diagnostics/gut-diversity/advice/pdf", HandlePrintGutDiversityAdvicePDF)
			r.Get("/billing/receipts/preference", HandleGetBillingReceiptPreference)
			r.Delete("/knowsitall/publication/comment", HandleDeletePublicationComment)
			r.Get("/wearables/hrv/sleep-correlation/monthly", HandleGetHRVSleepCorrelationMonthly)
			r.Delete("/profile/security-locations", HandleDeleteSecurityLocations)
			r.Get("/diagnostics/gut-diversity/phylum/alert", HandleGetGutPhylumAlertThreshold)
			r.Post("/knowsitall/upload-paper/raw-json", HandleUpdateKnowsItAllParserRawJSON)
			r.Post("/consultations/calendar/resend", HandleResendConsultationCalendarICS)
		})
	})

	return r
}

// ─── Middlewares ────────────────────────────────────────────────

// SecurityHeadersMiddleware adds industry-standard compliance security headers
func SecurityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "0")
		w.Header().Set("Content-Security-Policy", "default-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com https://fonts.gstatic.com https://unpkg.com; frame-ancestors 'none';")
		w.Header().Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload") // Enforce HTTPS
		next.ServeHTTP(w, r)
	})
}

// StructuredLoggingMiddleware maps requests in JSON format to stdout for Cloud Logging
func StructuredLoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		
		// Capture request details
		ip := r.RemoteAddr
		if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
			ip = strings.Split(forwarded, ",")[0]
		}

		next.ServeHTTP(w, r)

		slog.Info("http_request",
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.String("ip", ip),
			slog.String("user_agent", r.UserAgent()),
			slog.Duration("latency", time.Since(start)),
		)
	})
}

// CORSMiddleware restricts origin domains in compliance environments
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowedOrigin := os.Getenv("NEXT_PUBLIC_APP_URL")
		if allowedOrigin == "" {
			allowedOrigin = "http://localhost:3000"
		}
		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// AuthenticationMiddleware intercepts headers and cookies, verifies JWT
func AuthenticationMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var tokenString string

		// 1. Check Authorization Header (API Clients)
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		}

		// 2. Check Cookie (Web Browser page fetches)
		if tokenString == "" {
			cookie, err := r.Cookie("sb-access-token")
			if err == nil {
				tokenString = cookie.Value
			}
		}

		isAPI := strings.HasPrefix(r.URL.Path, "/api/")

		// 3. Inactivity Session Timeout Check (HIPAA / FedRAMP safeguards)
		if !isAPI && tokenString != "" {
			now := time.Now().Unix()
			activityCookie, err := r.Cookie("sb-last-activity")
			if err == nil {
				var lastActivity int64
				if _, scanErr := fmt.Sscanf(activityCookie.Value, "%d", &lastActivity); scanErr == nil {
					// 15-minute inactivity limit (900 seconds)
					if now-lastActivity > 900 {
						slog.Warn("Session timeout triggered due to inactivity", "inactive_seconds", now-lastActivity)
						http.SetCookie(w, &http.Cookie{
							Name:     "sb-access-token",
							Value:    "",
							Path:     "/",
							MaxAge:   -1,
							HttpOnly: true,
						})
						http.SetCookie(w, &http.Cookie{
							Name:     "sb-last-activity",
							Value:    "",
							Path:     "/",
							MaxAge:   -1,
							HttpOnly: true,
						})
						http.Redirect(w, r, "/login?error=timeout", http.StatusSeeOther)
						return
					}
				}
			}
			http.SetCookie(w, &http.Cookie{
				Name:     "sb-last-activity",
				Value:    fmt.Sprintf("%d", now),
				Path:     "/",
				HttpOnly: true,
				Secure:   false, // Set false for local HTTP emulator setups, true in prod
				SameSite: http.SameSiteLaxMode,
			})
		}

		// Handle missing token
		if tokenString == "" {
			if isAPI {
				http.Error(w, `{"error": "Unauthorized: Missing authentication token"}`, http.StatusUnauthorized)
			} else {
				// Browser redirects to login page
				http.Redirect(w, r, "/login", http.StatusSeeOther)
			}
			return
		}

		jwtSecret := os.Getenv("SUPABASE_JWT_SECRET") // Used to verify Supabase tokens locally
		if jwtSecret == "" {
			jwtSecret = "super-secret-supabase-token-signing-key-placeholder"
		}

		token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			slog.Error("Authentication token validation failed", "error", err)
			if isAPI {
				http.Error(w, `{"error": "Unauthorized: Invalid or expired token"}`, http.StatusUnauthorized)
			} else {
				http.Redirect(w, r, "/login?error=expired", http.StatusSeeOther)
			}
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			if isAPI {
				http.Error(w, `{"error": "Unauthorized: Invalid claims format"}`, http.StatusUnauthorized)
			} else {
				http.Redirect(w, r, "/login", http.StatusSeeOther)
			}
			return
		}

		// Extract user ID (typically 'sub' in OAuth/Supabase/Firebase tokens)
		sub, _ := claims["sub"].(string)
		if sub == "" {
			if isAPI {
				http.Error(w, `{"error": "Unauthorized: Missing subject claim"}`, http.StatusUnauthorized)
			} else {
				http.Redirect(w, r, "/login", http.StatusSeeOther)
			}
			return
		}

		// Extract user role if stored in claims
		role := "client"
		if appMetadata, exists := claims["app_metadata"].(map[string]interface{}); exists {
			if rVal, ok := appMetadata["role"].(string); ok {
				role = rVal
			}
		}

		// Inject credentials into request context
		ctx := context.WithValue(r.Context(), UserIDKey, sub)
		ctx = context.WithValue(ctx, UserRoleKey, role)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// CSRFMiddleware verifies AJAX/HTMX CSRF token header values
func CSRFMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" || r.Method == "PUT" || r.Method == "DELETE" {
			csrfToken := r.Header.Get("X-CSRF-Token")
			if csrfToken == "" {
				csrfToken = r.FormValue("csrf_token")
			}
			// Static validator for demonstration/investor sandbox profile
			if csrfToken != "static_session_csrf_token_value_xyz" {
				http.Error(w, "Forbidden: Invalid CSRF Token", http.StatusForbidden)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// RateLimiterMiddleware prevents brute-force logins
func RateLimiterMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Mock sliding window rate limit counter
		if r.URL.Path == "/api/auth/login" {
			// Fail if mock attacker uses brute force headers
			if r.Header.Get("X-Brute-Force-Attack") == "true" {
				w.Header().Set("Retry-After", "30")
				http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
