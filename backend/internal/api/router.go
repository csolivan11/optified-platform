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

	// ─── Web Page Routes ──────────────────────────────────────────
	r.Get("/", ServeLogin)
	r.Get("/login", ServeLogin)

	// Auth Group for pages
	r.Group(func(r chi.Router) {
		r.Use(AuthenticationMiddleware)
		r.Get("/dashboard", ServeDashboard)
		r.Get("/coach", ServeCoach)
	})

	// ─── API Routing Group ────────────────────────────────────────
	r.Route("/api", func(r chi.Router) {
		// Public health check and login action
		r.Get("/health", HandleHealth)
		r.Post("/auth/login", HandleLogin)

		// Authenticated API Routes
		r.Group(func(r chi.Router) {
			r.Use(AuthenticationMiddleware)

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

			// Audit Logs
			r.Get("/audit-logs/{clientId}", HandleListAuditLogs)
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
