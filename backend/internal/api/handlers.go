package api

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/csolivan11/optified-platform/backend/internal/db"
	"github.com/csolivan11/optified-platform/backend/internal/repository"
	"github.com/go-chi/chi/v5"
)

// Helper to write JSON response
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		slog.Error("failed to write json response", "error", err)
	}
}

// ─── Web Page Server Handlers ──────────────────────────────────

// ServeLogin renders the login page
func ServeLogin(w http.ResponseWriter, r *http.Request) {
	// If cookie is present and valid, redirect to dashboard automatically
	cookie, err := r.Cookie("sb-access-token")
	if err == nil && cookie.Value != "" {
		http.Redirect(w, r, "/dashboard", http.StatusSeeOther)
		return
	}
	RenderTemplate(w, "login", nil)
}

// ServeDashboard renders the secure client landing dashboard page
func ServeDashboard(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, _ := ctx.Value(UserIDKey).(string)

	pRepo := &repository.ProfileRepo{}
	profile, err := pRepo.GetByID(ctx, userID)
	if err != nil {
		slog.Error("failed to retrieve profile for dashboard", "userID", userID, "error", err)
		http.Redirect(w, r, "/login?error=profile", http.StatusSeeOther)
		return
	}

	// Query supplement schedules and daily compliance status for today
	type SupplementStatus struct {
		ScheduleID     string `json:"schedule_id"`
		SupplementName string `json:"supplement_name"`
		Dosage         string `json:"dosage"`
		Frequency      string `json:"frequency"`
		Taken          bool   `json:"taken"`
	}

	rows, err := db.Pool.Query(ctx, 
		`SELECT s.id, s.supplement_name, s.dosage, s.frequency, 
		        COALESCE(c.taken, false) as taken
		 FROM phi_stub.supplement_schedules s
		 LEFT JOIN phi_stub.supplement_compliance_logs c 
		   ON s.id = c.schedule_id AND c.logged_date = CURRENT_DATE
		 WHERE s.client_id = $1 AND s.active = true`, userID)

	var supplements []SupplementStatus
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var s SupplementStatus
			if err := rows.Scan(&s.ScheduleID, &s.SupplementName, &s.Dosage, &s.Frequency, &s.Taken); err == nil {
				supplements = append(supplements, s)
			}
		}
	} else {
		slog.Error("failed to query supplements schedules", "userID", userID, "error", err)
	}

	// Query client's microbiome results
	var diversityIndex, dysbiosisIndex float64
	var pathobionts []string
	err = db.Pool.QueryRow(ctx,
		`SELECT COALESCE(diversity_index, 7.5), COALESCE(dysbiosis_index, 3.2), COALESCE(detected_pathobionts, ARRAY[]::text[])
		 FROM phi_stub.microbiome_results
		 WHERE client_id = $1
		 ORDER BY test_date DESC LIMIT 1`, userID).Scan(&diversityIndex, &dysbiosisIndex, &pathobionts)
	if err != nil {
		slog.Warn("no microbiome records found for dashboard, using default stubs", "userID", userID, "error", err)
		diversityIndex = 7.5
		dysbiosisIndex = 3.2
		pathobionts = []string{"Clostridium bolteae", "Escherichia coli"}
	}

	// Query client's metabolic assessments
	var vo2Peak, rerResting float64
	var rmrKcal int
	err = db.Pool.QueryRow(ctx,
		`SELECT COALESCE(vo2_peak, 48.0), COALESCE(rmr_kcal, 1850), COALESCE(rer_resting, 0.78)
		 FROM phi_stub.metabolic_assessments
		 WHERE client_id = $1
		 ORDER BY test_date DESC LIMIT 1`, userID).Scan(&vo2Peak, &rmrKcal, &rerResting)
	if err != nil {
		slog.Warn("no metabolic assessments found for dashboard, using default stubs", "userID", userID, "error", err)
		vo2Peak = 48.0
		rmrKcal = 1850
		rerResting = 0.78
	}

	data := map[string]interface{}{
		"Profile":          profile,
		"Supplements":      supplements,
		"DiversityIndex":   diversityIndex,
		"DysbiosisIndex":   dysbiosisIndex,
		"Pathobionts":      pathobionts,
		"VO2Peak":          vo2Peak,
		"RMRKcal":          rmrKcal,
		"RERResting":       rerResting,
	}
	RenderTemplate(w, "dashboard", data)
}

// ServeSettings renders the client settings and device configuration screen
func ServeSettings(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, _ := ctx.Value(UserIDKey).(string)

	pRepo := &repository.ProfileRepo{}
	profile, err := pRepo.GetByID(ctx, userID)
	if err != nil {
		slog.Error("failed to retrieve profile for settings", "userID", userID, "error", err)
		http.Redirect(w, r, "/login?error=profile", http.StatusSeeOther)
		return
	}

	data := map[string]interface{}{
		"Profile": profile,
	}
	RenderTemplate(w, "settings", data)
}

// ServeCoach renders the secure coach client pipeline console
func ServeCoach(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, _ := ctx.Value(UserIDKey).(string)
	role, _ := ctx.Value(UserRoleKey).(string)

	if role != "admin" && role != "coach" {
		http.Redirect(w, r, "/dashboard", http.StatusSeeOther)
		return
	}

	pRepo := &repository.ProfileRepo{}
	profile, err := pRepo.GetByID(ctx, userID)
	if err != nil {
		slog.Error("failed to retrieve profile for coach dashboard", "userID", userID, "error", err)
		http.Redirect(w, r, "/login?error=profile", http.StatusSeeOther)
		return
	}

	clients, err := pRepo.ListClients(ctx)
	if err != nil {
		slog.Error("failed to list pipeline clients", "error", err)
		clients = []repository.Profile{}
	}

	data := map[string]interface{}{
		"Profile": profile,
		"Clients": clients,
	}
	RenderTemplate(w, "coach", data)
}

// HandleLogin proxies authentication to Supabase Auth API
func HandleLogin(w http.ResponseWriter, r *http.Request) {
	// Parse HTML form values
	if err := r.ParseForm(); err != nil {
		w.Header().Set("HX-Reswap", "none")
		w.Write([]byte(`<span class="text-red-500 text-xs">Failed to parse login form parameters</span>`))
		return
	}

	email := r.FormValue("email")
	password := r.FormValue("password")

	if email == "" || password == "" {
		w.Header().Set("HX-Reswap", "none")
		w.Write([]byte(`<span class="text-red-500 text-xs">Email and password are required fields</span>`))
		return
	}

	supabaseURL := os.Getenv("NEXT_PUBLIC_SUPABASE_URL")
	supabaseAnonKey := os.Getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

	// If variables are missing, fallback to a local mock login for local development
	if supabaseURL == "" || supabaseAnonKey == "" {
		slog.Warn("Supabase configs missing, falling back to mock login logic.")
		// Look up mock profile by email
		pRepo := &repository.ProfileRepo{}
		clients, _ := pRepo.ListClients(r.Context())
		
		var mockID string
		var mockRole string
		
		if email == "coach@optified.dev" {
			mockID = "11111111-2222-3333-4444-555555555555" // dummy UUID
			mockRole = "coach"
		} else if len(clients) > 0 {
			mockID = clients[0].ID
			mockRole = "client"
		} else {
			mockID = "00000000-0000-0000-0000-000000000000"
			mockRole = "client"
		}

		// Write a dummy cookie for local development (JWT validation bypassed or using mock JWT)
		cookie := &http.Cookie{
			Name:     "sb-access-token",
			Value:    "local-mock-session-token", // In mock, token check is bypassed
			Path:     "/",
			HttpOnly: true,
			Secure:   false,
			Expires:  time.Now().Add(24 * time.Hour),
		}
		http.SetCookie(w, cookie)
		
		redirectPath := "/dashboard"
		if mockRole == "coach" || mockRole == "admin" {
			redirectPath = "/coach"
		}
		w.Header().Set("HX-Redirect", redirectPath)
		return
	}

	// ─── Production Supabase Authentication Proxy ──────────────────
	authURL := supabaseURL + "/auth/v1/token?grant_type=password"
	reqPayload, _ := json.Marshal(map[string]string{
		"email":    email,
		"password": password,
	})

	req, err := http.NewRequest("POST", authURL, bytes.NewBuffer(reqPayload))
	if err != nil {
		slog.Error("failed to build auth request", "error", err)
		w.Header().Set("HX-Reswap", "none")
		w.Write([]byte(`<span class="text-red-500 text-xs">Internal authentication connection error</span>`))
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", supabaseAnonKey)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		slog.Error("Supabase auth request failed", "error", err)
		w.Header().Set("HX-Reswap", "none")
		w.Write([]byte(`<span class="text-red-500 text-xs">Auth provider connection timed out</span>`))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errData map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&errData)
		errMsg, _ := errData["error_description"].(string)
		if errMsg == "" {
			errMsg, _ = errData["msg"].(string)
		}
		if errMsg == "" {
			errMsg = "Invalid login credentials"
		}
		w.Header().Set("HX-Reswap", "none")
		w.Write([]byte(`<span class="text-red-500 text-xs">` + errMsg + `</span>`))
		return
	}

	var authResp struct {
		AccessToken string `json:"access_token"`
		User        struct {
			ID string `json:"id"`
		} `json:"user"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		slog.Error("failed to decode auth response", "error", err)
		w.Header().Set("HX-Reswap", "none")
		w.Write([]byte(`<span class="text-red-500 text-xs">Error parsing auth response payload</span>`))
		return
	}

	// ─── Set HTTP-only Cookie & Redirect ──────────────────────────
	isProd := os.Getenv("NODE_ENV") == "production"
	cookie := &http.Cookie{
		Name:     "sb-access-token",
		Value:    authResp.AccessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   isProd, // SSL required in production
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(24 * time.Hour),
	}
	http.SetCookie(w, cookie)

	// In production, query user role from Profile repo to determine redirect path
	pRepo := &repository.ProfileRepo{}
	profile, err := pRepo.GetByID(r.Context(), authResp.User.ID)
	redirectPath := "/dashboard"
	if err == nil && (profile.Role == "coach" || profile.Role == "admin") {
		redirectPath = "/coach"
	}

	// Tell HTMX to perform a client-side redirect to the dashboard/coach console
	w.Header().Set("HX-Redirect", redirectPath)
}

// ─── API endpoints ─────────────────────────────────────────────

// HandleHealth returns application status
func HandleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":    "ok",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// HandleListClients retrieves the profiles of clients (Coaches and Admins only)
// HandleListClients retrieves the profiles of clients (Coaches and Admins only)
func HandleListClients(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	role, _ := ctx.Value(UserRoleKey).(string)

	if role != "admin" && role != "coach" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "Forbidden: Requires coach or admin privileges"})
		return
	}

	searchQuery := r.URL.Query().Get("search")
	var clients []repository.Profile
	var err error

	if searchQuery != "" {
		rows, errQuery := db.Pool.Query(ctx, 
			`SELECT id, email, display_name, role, created_at, updated_at 
			 FROM public.profiles 
			 WHERE role = 'client' AND (display_name ILIKE $1 OR email ILIKE $1)`, 
			"%"+searchQuery+"%")
		if errQuery == nil {
			defer rows.Close()
			for rows.Next() {
				var p repository.Profile
				if errScan := rows.Scan(&p.ID, &p.Email, &p.DisplayName, &p.Role, &p.CreatedAt, &p.UpdatedAt); errScan == nil {
					clients = append(clients, p)
				}
			}
		} else {
			err = errQuery
		}
	} else {
		pRepo := &repository.ProfileRepo{}
		clients, err = pRepo.ListClients(ctx)
	}

	if err != nil {
		slog.Error("failed to retrieve client list", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal database error"})
		return
	}

	isHX := r.Header.Get("HX-Request") == "true"
	if isHX {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		var htmlContent string
		for _, c := range clients {
			htmlContent += fmt.Sprintf(`
				<div hx-get="/api/clinical-notes/%s" hx-target="#detail-pane" hx-swap="innerHTML"
					 class="p-4 rounded-lg border border-navy-900 bg-navy-900/50 hover:bg-navy-900 hover:border-navy-750 transition cursor-pointer flex items-center justify-between group">
					<div>
						<h3 class="text-sm font-semibold text-slate-200 group-hover:text-white">%s</h3>
						<p class="text-xs text-slate-500 mt-1">Client ID: %s</p>
					</div>
					<span class="h-2 w-2 rounded-full bg-emerald-500"></span>
				</div>`, c.ID, c.DisplayName, c.ID)
		}
		if len(clients) == 0 {
			htmlContent = `<p class="text-xs text-slate-500 text-center py-8">No clients match your search query.</p>`
		}
		w.Write([]byte(htmlContent))
		return
	}

	writeJSON(w, http.StatusOK, clients)
}

type BiomarkerStudy struct {
	Key          string  `json:"key"`
	Value        float64 `json:"value"`
	Unit         string  `json:"unit"`
	Status       string  `json:"status"`
	DisplayName  string  `json:"display_name"`
	Summary      string  `json:"clinical_summary"`
	Implication  string  `json:"longevity_implication"`
	Intervention string  `json:"recommended_interventions"`
	Citation     string  `json:"journal_citation"`
}

// HandleListClinicalNotes handles retrieving PHI clinical notes
func HandleListClinicalNotes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	callerID, _ := ctx.Value(UserIDKey).(string)
	callerRole, _ := ctx.Value(UserRoleKey).(string)

	targetClientID := chi.URLParam(r, "clientId")
	if targetClientID == "" {
		http.Error(w, "Missing client ID", http.StatusBadRequest)
		return
	}

	// RBAC enforcement:
	// A client can only view their own notes. Coaches/admins can view any client's notes.
	if callerRole == "client" && callerID != targetClientID {
		http.Error(w, "Forbidden: Cannot view clinical records of another client", http.StatusForbidden)
		return
	}

	cnRepo := &repository.ClinicalNotesRepo{}
	notes, err := cnRepo.ListForClient(ctx, targetClientID)
	if err != nil {
		slog.Error("failed to list clinical notes", "client_id", targetClientID, "error", err)
		http.Error(w, "Internal database error", http.StatusInternalServerError)
		return
	}

	// Compliance Audit Trail logging
	auditRepo := &repository.AuditLogRepo{}
	userAgent := r.UserAgent()
	ipAddress := r.RemoteAddr
	resourceType := "clinical_notes"
	action := "viewed_clinical_notes"

	auditLog := repository.AuditLog{
		ActorID:        callerID,
		ActorRole:      callerRole,
		Action:         action,
		ResourceType:   &resourceType,
		TargetClientID: &targetClientID,
		IPAddress:      &ipAddress,
		UserAgent:      &userAgent,
	}
	
	if err := auditRepo.Create(ctx, auditLog); err != nil {
		slog.Error("failed to create compliance audit log entry", "error", err)
	}

	// Fetch target client profile
	pRepo := &repository.ProfileRepo{}
	clientProfile, err := pRepo.GetByID(ctx, targetClientID)
	if err != nil {
		http.Error(w, "Client not found", http.StatusNotFound)
		return
	}

	// Query client's parsed biomarkers and their matching medical interpretations
	rows, err := db.Pool.Query(ctx, 
		`SELECT r.biomarker_key, r.value, c.unit, r.status, c.display_name,
		        COALESCE(i.clinical_summary, 'No summary loaded.'),
		        COALESCE(i.longevity_implication, 'No study backing loaded.'),
		        COALESCE(i.recommended_interventions, 'No baseline recommendation loaded.'),
		        COALESCE(i.journal_citation, 'General physiology reference.')
		 FROM phi_stub.biomarker_results r
		 JOIN phi_stub.bloodwork_panels p ON r.panel_id = p.id
		 JOIN phi_stub.biomarker_catalog c ON r.biomarker_key = c.key
		 LEFT JOIN public.medical_interpretations i ON r.biomarker_key = i.biomarker_key
		 WHERE p.client_id = $1
		 ORDER BY p.draw_date DESC, r.biomarker_key`, targetClientID)

	var biomarkers []BiomarkerStudy
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var b BiomarkerStudy
			if err := rows.Scan(&b.Key, &b.Value, &b.Unit, &b.Status, &b.DisplayName, &b.Summary, &b.Implication, &b.Intervention, &b.Citation); err == nil {
				biomarkers = append(biomarkers, b)
			}
		}
	} else {
		slog.Error("failed to query biomarker study details", "client_id", targetClientID, "error", err)
	}

	// Render HTMX block update for #detail-pane (loads client detail layout)
	data := map[string]interface{}{
		"Client":     clientProfile,
		"Notes":      notes,
		"Biomarkers": biomarkers,
	}

	// Determine if this is an HTMX query requesting HTML swap or direct API client requesting JSON
	isHX := r.Header.Get("HX-Request") == "true"
	if isHX {
		RenderBlock(w, "client-detail", data)
	} else {
		writeJSON(w, http.StatusOK, notes)
	}
}

// HandleCreateClinicalNote handles writing a clinical note (PHI generation)
func HandleCreateClinicalNote(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	callerID, _ := ctx.Value(UserIDKey).(string)
	callerRole, _ := ctx.Value(UserRoleKey).(string)

	// Only coaches and admins can create clinical notes
	if callerRole != "admin" && callerRole != "coach" {
		http.Error(w, "Forbidden: Only clinicians/coaches can create clinical notes", http.StatusForbidden)
		return
	}

	var clientID string
	var content string

	isHX := r.Header.Get("HX-Request") == "true"

	if isHX {
		// HTMX sends form POST data
		if err := r.ParseForm(); err != nil {
			http.Error(w, "Failed to parse parameters", http.StatusBadRequest)
			return
		}
		clientID = r.FormValue("client_id")
		content = r.FormValue("content")
	} else {
		// API client sends JSON
		var req struct {
			ClientID string `json:"client_id"`
			Content  string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
			return
		}
		clientID = req.ClientID
		content = req.Content
	}

	if clientID == "" || content == "" {
		http.Error(w, "client_id and content are required fields", http.StatusBadRequest)
		return
	}

	cnRepo := &repository.ClinicalNotesRepo{}
	noteData := repository.ClinicalNote{
		ClientID: clientID,
		AuthorID: callerID,
		Content:  content,
	}

	createdNote, err := cnRepo.Create(ctx, noteData)
	if err != nil {
		slog.Error("failed to write clinical note to DB", "error", err)
		http.Error(w, "Internal database error", http.StatusInternalServerError)
		return
	}

	// Compliance Audit Logging (Write Note Action)
	auditRepo := &repository.AuditLogRepo{}
	userAgent := r.UserAgent()
	ipAddress := r.RemoteAddr
	resourceType := "clinical_notes"
	action := "created_clinical_note"

	auditLog := repository.AuditLog{
		ActorID:        callerID,
		ActorRole:      callerRole,
		Action:         action,
		ResourceType:   &resourceType,
		ResourceID:     &createdNote.ID,
		TargetClientID: &clientID,
		IPAddress:      &ipAddress,
		UserAgent:      &userAgent,
	}

	if err := auditRepo.Create(ctx, auditLog); err != nil {
		slog.Error("failed to create create_clinical_note audit entry", "error", err)
	}

	if isHX {
		// Render just the newly created note list item to prepend dynamically inside HTMX list
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(`
			<div class="p-4 rounded-lg border border-navy-850 bg-navy-900/30">
				<div class="flex justify-between items-center text-xs text-slate-450 border-b border-navy-900 pb-2 mb-2">
					<span>Logged by Clinician: ` + createdNote.AuthorID + `</span>
					<span>` + createdNote.CreatedAt.Format("Jan 02, 2006 at 15:04 MST") + `</span>
				</div>
				<p class="text-sm text-slate-200 leading-relaxed">` + createdNote.Content + `</p>
			</div>
		`))
	} else {
		writeJSON(w, http.StatusCreated, createdNote)
	}
}

// HandleListAuditLogs returns audit log history (Admins/coaches only)
func HandleListAuditLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	callerRole, _ := ctx.Value(UserRoleKey).(string)

	if callerRole != "admin" && callerRole != "coach" {
		http.Error(w, "Forbidden: Requires coach or admin privileges", http.StatusForbidden)
		return
	}

	targetClientID := chi.URLParam(r, "clientId")
	if targetClientID == "" {
		http.Error(w, "Missing client ID", http.StatusBadRequest)
		return
	}

	auditRepo := &repository.AuditLogRepo{}
	logs, err := auditRepo.ListForTarget(ctx, targetClientID)
	if err != nil {
		slog.Error("failed to query audit logs", "client_id", targetClientID, "error", err)
		http.Error(w, "Internal database error", http.StatusInternalServerError)
		return
	}

	isHX := r.Header.Get("HX-Request") == "true"
	if isHX {
		// Render the audit list template block inside HTMX detail container
		data := map[string]interface{}{
			"ClientID": targetClientID,
			"Logs":     logs,
		}
		RenderBlock(w, "audit-list", data)
	} else {
		writeJSON(w, http.StatusOK, logs)
	}
}

// HandleGetUploadURL handles signed GCS URL generation requests
func HandleGetUploadURL(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	clientID, _ := ctx.Value(UserIDKey).(string)
	if clientID == "" {
		http.Error(w, "Unauthorized: Session client identifier missing", http.StatusUnauthorized)
		return
	}

	filename := r.URL.Query().Get("filename")
	vendor := r.URL.Query().Get("vendor")
	if filename == "" || vendor == "" {
		http.Error(w, "Missing required query parameters: filename, vendor", http.StatusBadRequest)
		return
	}

	objectName := fmt.Sprintf("%s/%s/%d_%s", clientID, vendor, time.Now().Unix(), filename)
	bucket := os.Getenv("GCS_BUCKET_NAME")
	if bucket == "" {
		bucket = "optified-phi-documents-optified-prod"
	}

	var uploadURL string
	emulatorHost := os.Getenv("STORAGE_EMULATOR_HOST")
	if emulatorHost != "" {
		uploadURL = fmt.Sprintf("%s/%s/%s", emulatorHost, bucket, objectName)
	} else {
		uploadURL = fmt.Sprintf("https://storage.googleapis.com/%s/%s?GoogleAccessId=service-account@optified-prod.iam.gserviceaccount.com&Expires=%d&Signature=MOCK_SIGNATURE",
			bucket, objectName, time.Now().Add(15*time.Minute).Unix())
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"upload_url":  uploadURL,
		"object_key":  objectName,
		"bucket_name": bucket,
	})
}

// HandleToggleSupplement handles HTMX compliance check logging for supplement intake
func HandleToggleSupplement(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	clientID, _ := ctx.Value(UserIDKey).(string)
	if clientID == "" {
		http.Error(w, "Unauthorized: User session not found", http.StatusUnauthorized)
		return
	}

	scheduleID := r.FormValue("schedule_id")
	if scheduleID == "" {
		http.Error(w, "Missing schedule ID", http.StatusBadRequest)
		return
	}

	// Verify schedule belongs to caller
	var verifyID string
	err := db.Pool.QueryRow(ctx, "SELECT id FROM phi_stub.supplement_schedules WHERE id = $1 AND client_id = $2", scheduleID, clientID).Scan(&verifyID)
	if err != nil {
		http.Error(w, "Forbidden: Invalid schedule rule", http.StatusForbidden)
		return
	}

	var taken bool
	err = db.Pool.QueryRow(ctx, 
		`INSERT INTO phi_stub.supplement_compliance_logs (schedule_id, logged_date, taken)
		 VALUES ($1, CURRENT_DATE, true)
		 ON CONFLICT (schedule_id, logged_date)
		 DO UPDATE SET taken = NOT phi_stub.supplement_compliance_logs.taken
		 RETURNING taken`, scheduleID).Scan(&taken)
	if err != nil {
		slog.Error("failed to toggle compliance logs in DB", "schedule_id", scheduleID, "error", err)
		http.Error(w, "Internal database error", http.StatusInternalServerError)
		return
	}

	// Return simple dynamic response
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if taken {
		w.Write([]byte(`<span class="text-xs text-emerald-400 font-medium">Checked</span>`))
	} else {
		w.Write([]byte(`<span class="text-xs text-slate-500 font-medium">Pending</span>`))
	}
}

// HandleCreateSupplementSchedule adds a new supplement schedule regime for a client
func HandleCreateSupplementSchedule(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	callerID, _ := ctx.Value(UserIDKey).(string)
	callerRole, _ := ctx.Value(UserRoleKey).(string)

	if callerRole != "admin" && callerRole != "coach" {
		http.Error(w, "Forbidden: Only clinicians can manage supplement regimes", http.StatusForbidden)
		return
	}

	clientID := r.FormValue("client_id")
	supplementName := r.FormValue("supplement_name")
	dosage := r.FormValue("dosage")
	frequency := r.FormValue("frequency")

	if clientID == "" || supplementName == "" || dosage == "" || frequency == "" {
		http.Error(w, "Missing required parameters", http.StatusBadRequest)
		return
	}

	_, err := db.Pool.Exec(ctx,
		`INSERT INTO phi_stub.supplement_schedules (client_id, supplement_name, dosage, frequency)
		 VALUES ($1, $2, $3, $4);`,
		clientID, supplementName, dosage, frequency,
	)
	if err != nil {
		slog.Error("failed to create supplement schedule rule", "error", err)
		http.Error(w, "Internal database error", http.StatusInternalServerError)
		return
	}

	// Compliance Audit log
	action := "created_supplement_schedule"
	resType := "supplement_schedule"
	ip := r.RemoteAddr
	ua := r.UserAgent()
	meta := fmt.Sprintf(`{"supplement": %q, "dosage": %q}`, supplementName, dosage)

	auditLog := repository.AuditLog{
		ActorID:        callerID,
		ActorRole:      callerRole,
		Action:         action,
		ResourceType:   &resType,
		TargetClientID: &clientID,
		IPAddress:      &ip,
		UserAgent:      &ua,
		Metadata:       &meta,
	}
	auditRepo := &repository.AuditLogRepo{}
	_ = auditRepo.Create(ctx, auditLog)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(`
		<div class="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex justify-between items-center mb-2">
			<span>Schedule for ` + supplementName + ` created!</span>
			<button class="hover:underline text-[10px]" onclick="this.parentElement.remove()">Dismiss</button>
		</div>
	`))
}
