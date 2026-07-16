package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestGenerateTailoredNutritionPlan(t *testing.T) {
	// Diversity score < 6.0 should trigger high-fiber prebiotic protocols
	lowDivPlan := GenerateTailoredNutritionPlan(5.2)
	expectedLow := "High-diversity plant fiber protocol: 35g daily prebiotics + Konjac root extract to clear beta-glucuronidase."
	if lowDivPlan != expectedLow {
		t.Errorf("expected prebiotic protocol, got %q", lowDivPlan)
	}

	// Diversity score >= 6.0 should trigger standard protocol
	stdPlan := GenerateTailoredNutritionPlan(7.8)
	expectedStd := "Standard longevity protocol: Mediterranean diet with high polyphenol olive oil & fermented foods."
	if stdPlan != expectedStd {
		t.Errorf("expected standard protocol, got %q", stdPlan)
	}
}

func TestGenerateTailoredExercisePlan(t *testing.T) {
	// Whoop recovery < 40.0 should trigger Zone 1 active recovery
	recoveryPlan := GenerateTailoredExercisePlan(35.0, 52.0)
	expectedRec := "Recovery Protocol: 45 minutes Zone 1 active recovery (recovery day triggered)."
	if recoveryPlan != expectedRec {
		t.Errorf("expected active recovery, got %q", recoveryPlan)
	}

	// VO2 Peak < 45.0 should trigger Norwegian 4x4 intervals
	hiitPlan := GenerateTailoredExercisePlan(75.0, 42.0)
	expectedHiit := "VO2 Max Build Protocol: Norwegian 4x4 intervals at 90% HRmax twice weekly."
	if hiitPlan != expectedHiit {
		t.Errorf("expected Norwegian 4x4 HIIT, got %q", hiitPlan)
	}

	// Normal inputs should trigger Zone 2 endurance base protocol
	normalPlan := GenerateTailoredExercisePlan(80.0, 52.0)
	expectedNormal := "Endurance Build Protocol: 3x90 mins Zone 2 training + 1x Peak output session."
	if normalPlan != expectedNormal {
		t.Errorf("expected endurance build, got %q", normalPlan)
	}
}

func TestGenerateTailoredCognitivePlan(t *testing.T) {
	focusPlan := GenerateTailoredCognitivePlan(45.0)
	expectedFocus := "Ultradian rhythm focus protocol: 90-minute deep work cycles + 40Hz gamma binaural beats."
	if focusPlan != expectedFocus {
		t.Errorf("expected ultradian beats, got %q", focusPlan)
	}
}

func TestHandleBookConsultation(t *testing.T) {
	form := url.Values{}
	form.Set("booking_date", "July 20, 2026 at 10:00 AM")

	req, err := http.NewRequest("POST", "/api/consultations/book", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleBookConsultation)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}

	if !strings.Contains(rr.Body.String(), "Booking Confirmed!") {
		t.Errorf("expected confirmation message, got %s", rr.Body.String())
	}
}

func TestHandleCreateBillingInvoiceForbidden(t *testing.T) {
	form := url.Values{}
	form.Set("client_id", "client-id-123")
	form.Set("service", "Longevity Consultation")
	form.Set("amount", "250")

	req, err := http.NewRequest("POST", "/api/billing/invoice", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	// Clients cannot dispatch invoices
	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleCreateBillingInvoice)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden, got %v", rr.Code)
	}
}

func TestHandleHorvathSimulation(t *testing.T) {
	form := url.Values{}
	form.Set("chronological_age", "45")
	form.Set("methylation_rate", "0.78")

	req, err := http.NewRequest("POST", "/api/longevity/horvath-simulation", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleHorvathSimulation)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Predicted Biological Age") {
		t.Errorf("expected biological age prediction in output, got %s", rr.Body.String())
	}
}

func TestHandleCGMRangeConfig(t *testing.T) {
	form := url.Values{}
	form.Set("lower_bound", "75")
	form.Set("upper_bound", "125")

	req, err := http.NewRequest("POST", "/api/wearables/cgm-range", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleCGMRangeConfig)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Glycemic Targets Calibrated") {
		t.Errorf("expected calibration message, got %s", rr.Body.String())
	}
}

func TestHandleGetPublicationMetadata(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/knowsitall/publication/35012345", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	
	// Set chi routing context mock for PMID parameter
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("pmid", "35012345")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	handler := http.HandlerFunc(HandleGetPublicationMetadata)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Autophagy clears cell waste") {
		t.Errorf("expected target abstract details, got %s", rr.Body.String())
	}
}

func TestHandleScheduleWorkout(t *testing.T) {
	form := url.Values{}
	form.Set("workout_type", "Norwegian 4x4 intervals at 90% HRmax")
	form.Set("scheduled_date", "July 22 at 8:00 AM")

	req, err := http.NewRequest("POST", "/api/fitness/schedule", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleScheduleWorkout)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Workout scheduled") {
		t.Errorf("expected workout scheduled confirmation, got %s", rr.Body.String())
	}
}

func TestHandleGutDiversityConfigForbidden(t *testing.T) {
	form := url.Values{}
	form.Set("client_id", "client-id-123")
	form.Set("target_diversity", "7.5")

	req, err := http.NewRequest("POST", "/api/diagnostics/gut-diversity", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	// Clients cannot configure diversity targets
	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGutDiversityConfig)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden, got %v", rr.Code)
	}
}

func TestHandleGetHorvathSimulationHistory(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/longevity/horvath-simulation/history", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetHorvathSimulationHistory)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Date/Time") {
		t.Errorf("expected log table headers, got %s", rr.Body.String())
	}
}

func TestHandleCGMTIRConfig(t *testing.T) {
	form := url.Values{}
	form.Set("lower_bound", "70")
	form.Set("upper_bound", "130")
	form.Set("target_tir", "96")

	req, err := http.NewRequest("POST", "/api/wearables/cgm-tir", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleCGMTIRConfig)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Glycemic TIR targets calibrated") {
		t.Errorf("expected calibration message, got %s", rr.Body.String())
	}
}

func TestHandleFTPRecalc(t *testing.T) {
	form := url.Values{}
	form.Set("ftp_watts", "275")

	req, err := http.NewRequest("POST", "/api/fitness/ftp-recalc", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleFTPRecalc)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "FTP zone adjustments successfully recorded") {
		t.Errorf("expected confirmation message, got %s", rr.Body.String())
	}
}

func TestHandleGetGutDiversityHistory(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/gut-diversity/history", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetGutDiversityHistory)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "<svg") {
		t.Errorf("expected SVG visualization response, got %s", rr.Body.String())
	}
}

func TestHandleUploadPaperPDFValidation(t *testing.T) {
	form := url.Values{}
	form.Set("impact_factor", "invalid")
	
	req, err := http.NewRequest("POST", "/api/knowsitall/upload-paper", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	
	ctx := req.Context()
	ctx = withUserSession(ctx, "coach-id-123", "coach")
	req = req.WithContext(ctx)
	
	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleUploadPaperPDF)
	handler.ServeHTTP(rr, req)
	
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request, got %v", rr.Code)
	}
}

func TestHandleGetHorvathSimulationDelta(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/longevity/horvath-simulation/delta", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetHorvathSimulationDelta)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Epigenetic Offset") {
		t.Errorf("expected epigenetic offset delta wrapper, got %s", rr.Body.String())
	}
}

func TestHandleCGMTIRAlertConfig(t *testing.T) {
	form := url.Values{}
	form.Set("alert_threshold", "92")

	req, err := http.NewRequest("POST", "/api/wearables/cgm-tir/alert", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleCGMTIRAlertConfig)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "TIR alert threshold set to") {
		t.Errorf("expected confirmation message, got %s", rr.Body.String())
	}
}

func TestHandleGetGutDiversityPercentile(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/gut-diversity/percentile", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetGutDiversityPercentile)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Latest Gut Index") {
		t.Errorf("expected gut index percentile content, got %s", rr.Body.String())
	}
}

func TestHandleResetHorvathSimulation(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/longevity/horvath-simulation/reset", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleResetHorvathSimulation)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "successfully reset") {
		t.Errorf("expected reset message, got %s", rr.Body.String())
	}
}

func TestHandleGetCGMAnomalies(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/wearables/cgm-tir/anomalies", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetCGMAnomalies)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Anomaly tracking limit") {
		t.Errorf("expected cgm anomalies stats content, got %s", rr.Body.String())
	}
}

func TestHandleGetPublicationsList(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/knowsitall/publications?tag_filter=Autophagy", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetPublicationsList)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Autophagy & Longevity") {
		t.Errorf("expected filtered publication entry, got %s", rr.Body.String())
	}
}

func TestHandleGetGutDiversityAdvice(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/gut-diversity/advice", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetGutDiversityAdvice)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Clinical Protocol Guidance") {
		t.Errorf("expected gut diversity protocol suggestions, got %s", rr.Body.String())
	}
}

func TestHandleSetHorvathSimulationMilestone(t *testing.T) {
	form := url.Values{}
	form.Set("target_offset", "-8")

	req, err := http.NewRequest("POST", "/api/longevity/horvath-simulation/milestone", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleSetHorvathSimulationMilestone)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Target biological age offset set to") {
		t.Errorf("expected confirmation message, got %s", rr.Body.String())
	}
}

func TestHandleGetCGMHourlyStats(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/wearables/cgm-tir/hourly", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetCGMHourlyStats)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Hourly Average Glucose Levels") {
		t.Errorf("expected cgm hourly statistics, got %s", rr.Body.String())
	}
}

func TestHandleGetGutDiversityBaseline(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/gut-diversity/baseline", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetGutDiversityBaseline)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Cohort Baseline") {
		t.Errorf("expected baseline cohort comparisons content, got %s", rr.Body.String())
	}
}

func TestHandleGetHorvathSimulationChart(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/longevity/horvath-simulation/chart", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetHorvathSimulationChart)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "<svg") {
		t.Errorf("expected biological age chart SVG content, got %s", rr.Body.String())
	}
}

func TestHandleCGMTIREventTag(t *testing.T) {
	form := url.Values{}
	form.Set("meal_marker", "pre_workout")

	req, err := http.NewRequest("POST", "/api/wearables/cgm-tir/event", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleCGMTIREventTag)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "tagged successfully as") {
		t.Errorf("expected event tag confirmation message, got %s", rr.Body.String())
	}
}

func TestHandleGetScheduledWorkouts(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/fitness/schedule/list", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetScheduledWorkouts)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Norwegian 4x4 intervals") {
		t.Errorf("expected scheduled workout items list content, got %s", rr.Body.String())
	}
}

func TestHandleGetGutPhylumBreakdown(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/gut-diversity/phylum", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetGutPhylumBreakdown)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Phylum Ratio") {
		t.Errorf("expected phylum breakdown stats content, got %s", rr.Body.String())
	}
}

func TestHandleExportHorvathSimulationDelta(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/longevity/horvath-simulation/delta/export", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleExportHorvathSimulationDelta)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "EPIGENETIC HORVATH SIMULATION DELTA REPORT") {
		t.Errorf("expected exported text content, got %s", rr.Body.String())
	}
}

func TestHandleCGMTIRAlertSoundConfig(t *testing.T) {
	form := url.Values{}
	form.Set("sound_profile", "melodic")

	req, err := http.NewRequest("POST", "/api/wearables/cgm-tir/alert/sound", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleCGMTIRAlertSoundConfig)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Alert sound profile set to") {
		t.Errorf("expected confirmation message, got %s", rr.Body.String())
	}
}

func TestHandleGetGutDiversityAlerts(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/gut-diversity/alerts", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetGutDiversityAlerts)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Clinical Status Indicator") {
		t.Errorf("expected clinical alerts stats content, got %s", rr.Body.String())
	}
}

func TestHandleGetNormalizedReports(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/reports/normalized", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetNormalizedReports)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Genova GI Effects Gut Panel") {
		t.Errorf("expected Genova lab report, got %s", rr.Body.String())
	}
}

func TestHandleDiagnosticsChat(t *testing.T) {
	form := url.Values{}
	form.Set("question", "Tell me about my biological age delta?")

	req, err := http.NewRequest("POST", "/api/diagnostics/chat", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleDiagnosticsChat)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "biological offset delta") {
		t.Errorf("expected grounded response, got %s", rr.Body.String())
	}
}

func TestHandleClinicalNotesDraftAssistant(t *testing.T) {
	form := url.Values{}
	form.Set("client_id", "client-id-123")
	form.Set("rough_notes", "apoB level is fine at 60")

	req, err := http.NewRequest("POST", "/api/clinical-notes/draft-assistant", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "coach-id-123", "coach")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleClinicalNotesDraftAssistant)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Swiss Study Cite Attached") {
		t.Errorf("expected draft assistant expansions, got %s", rr.Body.String())
	}
}

func TestHandleApproveClinicalNotesDraft(t *testing.T) {
	form := url.Values{}
	form.Set("client_id", "client-id-123")
	form.Set("approved_content", "Patient shows optimal ApoB recovery.")
	form.Set("citation_pmid", "99012345")

	req, err := http.NewRequest("POST", "/api/clinical-notes/approve", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "coach-id-123", "coach")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleApproveClinicalNotesDraft)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Published") {
		t.Errorf("expected publication approval confirmation, got %s", rr.Body.String())
	}
}

func TestHandleGetClinicalNotesSpotlight(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/clinical-notes/spotlight", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetClinicalNotesSpotlight)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Swiss Sports Nutrition Hub") {
		t.Errorf("expected clinical notes spotlight details, got %s", rr.Body.String())
	}
}

func TestHandleDemoMockTelemetryToggle(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/longevity/demo/toggle", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleDemoMockTelemetryToggle)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Demo/Investor Mode Normalized Reports") {
		t.Errorf("expected demo mockup reports display, got %s", rr.Body.String())
	}
}

func TestHandleGetSessionExpirationStatus(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/session/expiration", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetSessionExpirationStatus)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "seconds_remaining") {
		t.Errorf("expected expiration seconds mapping, got %s", rr.Body.String())
	}
}

func TestHandleRevokeSession(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/session/revoke", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleRevokeSession)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
}

func TestCSRFMiddleware(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/clinical-notes", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	rr := httptest.NewRecorder()
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	csrfGuard := CSRFMiddleware(nextHandler)
	csrfGuard.ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden on missing token, got %v", rr.Code)
	}
}

func TestRateLimiterMiddleware(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/auth/login", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("X-Brute-Force-Attack", "true")

	rr := httptest.NewRecorder()
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	limiter := RateLimiterMiddleware(nextHandler)
	limiter.ServeHTTP(rr, req)

	if rr.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429 Too Many Requests on brute force, got %v", rr.Code)
	}
}

func TestHandleSaveProfileTimezone(t *testing.T) {
	form := url.Values{}
	form.Set("timezone", "EST")

	req, err := http.NewRequest("POST", "/api/profile/timezone", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleSaveProfileTimezone)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Profile timezone preference saved as") {
		t.Errorf("expected timezone confirmation, got %s", rr.Body.String())
	}
}

func TestHandleGetHRVChart(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/wearables/hrv/chart", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetHRVChart)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "<svg") {
		t.Errorf("expected HRV SVG, got %s", rr.Body.String())
	}
}

func TestHandleCancelConsultation(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/consultations/cancel", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleCancelConsultation)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Consultation Cancelled") {
		t.Errorf("expected cancellation message, got %s", rr.Body.String())
	}
}

func TestHandleExportQuestBiomarkersCSV(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/reports/quest/csv", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleExportQuestBiomarkersCSV)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Apolipoprotein B (apoB)") {
		t.Errorf("expected Quest CSV content, got %s", rr.Body.String())
	}
}

func TestHandleGetUserSecurityLogs(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/profile/security-logs", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetUserSecurityLogs)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "SUCCESS_LOGIN") {
		t.Errorf("expected security logs content, got %s", rr.Body.String())
	}
}

func TestHandleGetCGMGlucoseBounds(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/wearables/cgm-tir/bounds", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetCGMGlucoseBounds)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Avg Glucose:") {
		t.Errorf("expected CGM bounds, got %s", rr.Body.String())
	}
}

func TestHandleExportClinicalNotesMarkdown(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/clinical-notes/export/markdown", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleExportClinicalNotesMarkdown)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Clinical Notes History") {
		t.Errorf("expected markdown content, got %s", rr.Body.String())
	}
}

func TestHandleGetGutMicrobiomeCustomAdvice(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/gut-diversity/advice/custom?category=diet", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetGutMicrobiomeCustomAdvice)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Akkermansia abundance") {
		t.Errorf("expected Diet advice, got %s", rr.Body.String())
	}
}

func TestHandleGetClientBillingInvoicesHistory(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/billing/invoices/history", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetClientBillingInvoicesHistory)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "PAID") {
		t.Errorf("expected invoice list, got %s", rr.Body.String())
	}
}

func TestHandleUpdateUserMFAConfig(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/profile/mfa/config", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleUpdateUserMFAConfig)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "configured as:") {
		t.Errorf("expected MFA update confirmation, got %s", rr.Body.String())
	}
}

func TestHandleGetGutPhylumHistoryChart(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/gut-diversity/phylum/history", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetGutPhylumHistoryChart)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "<svg") {
		t.Errorf("expected phylum history SVG, got %s", rr.Body.String())
	}
}

func TestHandleGetKnowsItAllParserMockProgress(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/knowsitall/upload-paper/progress", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetKnowsItAllParserMockProgress)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "completed") {
		t.Errorf("expected parser status json, got %s", rr.Body.String())
	}
}

func TestHandleGetWearableStatusBadges(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/wearables/status/badges", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetWearableStatusBadges)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Oura Connected") {
		t.Errorf("expected connection badges, got %s", rr.Body.String())
	}
}

func TestHandleGetHorvathAgingPace(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/longevity/horvath-simulation/pace", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetHorvathAgingPace)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Pace of Aging:") {
		t.Errorf("expected Horvath pace aging value, got %s", rr.Body.String())
	}
}

func TestHandlePrintClinicalNotesPDF(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/clinical-notes/print/pdf", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandlePrintClinicalNotesPDF)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if rr.Header().Get("Content-Type") != "application/pdf" {
		t.Errorf("expected PDF MIME content-type, got %s", rr.Header().Get("Content-Type"))
	}
}

func TestHandleSearchPrebioticFoods(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/gut-diversity/foods/search?food_query=garlic", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleSearchPrebioticFoods)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Akkermansia Promoter") {
		t.Errorf("expected garlic prebiotic score, got %s", rr.Body.String())
	}
}

func TestHandleUpdateBillingCurrency(t *testing.T) {
	form := url.Values{}
	form.Set("currency", "EUR")

	req, err := http.NewRequest("POST", "/api/billing/currency/preference", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleUpdateBillingCurrency)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "currency saved as") {
		t.Errorf("expected currency selection validation, got %s", rr.Body.String())
	}
}

func TestHandleGetCardioVO2MaxChart(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/fitness/vo2max/chart", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetCardioVO2MaxChart)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "<svg") {
		t.Errorf("expected VO2 Max chart SVG, got %s", rr.Body.String())
	}
}

func TestHandleGetHRVRecoveryAlerts(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/wearables/hrv/alerts", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetHRVRecoveryAlerts)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Autonomic Recovery: Optimal") {
		t.Errorf("expected recovery status warning, got %s", rr.Body.String())
	}
}

func TestHandleRequestPasswordReset(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/profile/password/reset", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleRequestPasswordReset)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "dispatched") {
		t.Errorf("expected password reset text, got %s", rr.Body.String())
	}
}

func TestHandleSetGutPhylaAlertThreshold(t *testing.T) {
	form := url.Values{}
	form.Set("bact_limit", "45")

	req, err := http.NewRequest("POST", "/api/diagnostics/gut-diversity/phylum/alert", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleSetGutPhylaAlertThreshold)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "upper threshold set as") {
		t.Errorf("expected phylum limits validation message, got %s", rr.Body.String())
	}
}

func TestHandleGetConsultationCalendarICS(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/consultations/calendar/ics", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetConsultationCalendarICS)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "VCALENDAR") {
		t.Errorf("expected calendar invite ics format, got %s", rr.Body.String())
	}
}

func TestHandleSaveProfileAvatar(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/profile/avatar", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleSaveProfileAvatar)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "avatar image uploaded") {
		t.Errorf("expected upload feedback message, got %s", rr.Body.String())
	}
}

func TestHandleGetHorvathSimulationPercentile(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/longevity/horvath-simulation/percentile", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetHorvathSimulationPercentile)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Cohort Percentile:") {
		t.Errorf("expected percentile data, got %s", rr.Body.String())
	}
}

func TestHandlePrintGutDiversityAdvice(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/gut-diversity/advice/print", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandlePrintGutDiversityAdvice)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if rr.Header().Get("Content-Type") != "application/pdf" {
		t.Errorf("expected PDF content-type, got %s", rr.Header().Get("Content-Type"))
	}
}

func TestHandleSendBillingInvoiceEmail(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/billing/invoices/email?id=OPT-8976", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleSendBillingInvoiceEmail)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "OPT-8976 dispatched") {
		t.Errorf("expected dispatch confirmation, got %s", rr.Body.String())
	}
}

func TestHandleUpdatePublicationTags(t *testing.T) {
	form := url.Values{}
	form.Set("pmid", "35012345")
	form.Set("new_tags", "Longevity, Fasting")

	req, err := http.NewRequest("POST", "/api/knowsitall/publication/tags", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleUpdatePublicationTags)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Fasting") {
		t.Errorf("expected updated tag validation, got %s", rr.Body.String())
	}
}

func TestHandleGetHRVMonthlyChart(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/wearables/hrv/monthly-chart", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetHRVMonthlyChart)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "<svg") {
		t.Errorf("expected monthly chart SVG, got %s", rr.Body.String())
	}
}

func TestHandleUpdateSMSMFAPhone(t *testing.T) {
	form := url.Values{}
	form.Set("mfa_phone", "+15551234567")

	req, err := http.NewRequest("POST", "/api/profile/mfa/sms", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleUpdateSMSMFAPhone)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "+15551234567") {
		t.Errorf("expected phone validation, got %s", rr.Body.String())
	}
}

func TestHandleExportGutPhylaPDF(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/gut-diversity/phylum/pdf", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleExportGutPhylaPDF)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if rr.Header().Get("Content-Type") != "application/pdf" {
		t.Errorf("expected PDF content-type, got %s", rr.Header().Get("Content-Type"))
	}
}

func TestHandleGetKnowsItAllParserErrors(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/knowsitall/upload-paper/errors", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetKnowsItAllParserErrors)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "PASSED") {
		t.Errorf("expected diagnostic check logs list, got %s", rr.Body.String())
	}
}

func TestHandleRegisterConsultationBackupPhone(t *testing.T) {
	form := url.Values{}
	form.Set("backup_phone", "+15559876543")

	req, err := http.NewRequest("POST", "/api/consultations/backup-phone", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleRegisterConsultationBackupPhone)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "+15559876543") {
		t.Errorf("expected backup phone register alert, got %s", rr.Body.String())
	}
}

func TestHandleListClientsSorting(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/clients?sort=date", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "coach-id-123", "coach")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleListClients)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
}

func TestHandleUpdateProfileGender(t *testing.T) {
	form := url.Values{}
	form.Set("gender", "female")

	req, err := http.NewRequest("POST", "/api/profile/gender", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleUpdateProfileGender)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "FEMALE") {
		t.Errorf("expected gender selection confirmation, got %s", rr.Body.String())
	}
}

func TestHandleGetHorvathSimulationDunedinPACE(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/longevity/horvath-simulation/dunedinpace", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetHorvathSimulationDunedinPACE)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "DunedinPACE Rate:") {
		t.Errorf("expected DunedinPACE rate stats, got %s", rr.Body.String())
	}
}

func TestHandleSaveSearchDelayConfig(t *testing.T) {
	form := url.Values{}
	form.Set("delay_val", "500ms")

	req, err := http.NewRequest("POST", "/api/clients/config/search-delay", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "coach-id-123", "coach")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleSaveSearchDelayConfig)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
}

func TestHandleSendGutDiversityAdviceEmail(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/diagnostics/gut-diversity/advice/email", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleSendGutDiversityAdviceEmail)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "dispatched to your registered mailbox") {
		t.Errorf("expected email dispatch confirmation, got %s", rr.Body.String())
	}
}

func TestHandleToggleBillingReceipt(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/billing/receipts/toggle", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleToggleBillingReceipt)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "ENABLED") {
		t.Errorf("expected billing receipt toggled state confirmation, got %s", rr.Body.String())
	}
}

func TestHandleAddPublicationComment(t *testing.T) {
	form := url.Values{}
	form.Set("pmid", "35012345")
	form.Set("comment", "This is an important study.")

	req, err := http.NewRequest("POST", "/api/knowsitall/publication/comment", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleAddPublicationComment)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "important study") {
		t.Errorf("expected annotation text response, got %s", rr.Body.String())
	}
}

func TestHandleGetHRVSleepCorrelation(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/wearables/hrv/sleep-correlation", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetHRVSleepCorrelation)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "<svg") {
		t.Errorf("expected correlation chart SVG, got %s", rr.Body.String())
	}
}

func TestHandleGetSecurityLocations(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/profile/security-locations", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetSecurityLocations)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Boston, MA") {
		t.Errorf("expected session location log rows, got %s", rr.Body.String())
	}
}

func TestHandleResetGutPhylumAlertThreshold(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/diagnostics/gut-diversity/phylum/alert/reset", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleResetGutPhylumAlertThreshold)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "reset to default ratio") {
		t.Errorf("expected reset message, got %s", rr.Body.String())
	}
}

func TestHandleGetKnowsItAllParserRawJSON(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/knowsitall/upload-paper/raw-json", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetKnowsItAllParserRawJSON)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "paper_title") {
		t.Errorf("expected raw parser json layout, got %s", rr.Body.String())
	}
}

func TestHandleCancelConsultationCalendarICS(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/consultations/calendar/cancel", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleCancelConsultationCalendarICS)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "invite cancellation request received") {
		t.Errorf("expected invite cancellation response text, got %s", rr.Body.String())
	}
}

func TestHandleDeleteProfileAvatar(t *testing.T) {
	req, err := http.NewRequest("DELETE", "/api/profile/avatar", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleDeleteProfileAvatar)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "avatar deleted") {
		t.Errorf("expected avatar delete confirmation, got %s", rr.Body.String())
	}
}

func TestHandleGetHorvathSimulationGrimAge(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/longevity/horvath-simulation/grimage", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetHorvathSimulationGrimAge)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "GrimAge Sim:") {
		t.Errorf("expected GrimAge simulation stats, got %s", rr.Body.String())
	}
}

func TestHandleGetSearchDelayConfig(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/clients/config/search-delay", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetSearchDelayConfig)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
}

func TestHandlePrintGutDiversityAdvicePDF(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/gut-diversity/advice/pdf", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandlePrintGutDiversityAdvicePDF)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
}

func TestHandleGetBillingReceiptPreference(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/billing/receipts/preference", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetBillingReceiptPreference)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
}

func TestHandleDeletePublicationComment(t *testing.T) {
	req, err := http.NewRequest("DELETE", "/api/knowsitall/publication/comment", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleDeletePublicationComment)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
}

func TestHandleGetHRVSleepCorrelationMonthly(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/wearables/hrv/sleep-correlation/monthly", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetHRVSleepCorrelationMonthly)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
}

func TestHandleDeleteSecurityLocations(t *testing.T) {
	req, err := http.NewRequest("DELETE", "/api/profile/security-locations", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleDeleteSecurityLocations)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
}

func TestHandleGetGutPhylumAlertThreshold(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/gut-diversity/phylum/alert", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetGutPhylumAlertThreshold)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
}

func TestHandleUpdateKnowsItAllParserRawJSON(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/knowsitall/upload-paper/raw-json", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleUpdateKnowsItAllParserRawJSON)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
}

func TestHandleResendConsultationCalendarICS(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/consultations/calendar/resend", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleResendConsultationCalendarICS)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
}

func TestHandleGetProfileTimezone(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/profile/timezone", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetProfileTimezone)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "EST") {
		t.Errorf("expected timezone name, got %s", rr.Body.String())
	}
}

func TestHandleGetHorvathSimulationGrimAgeHistory(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/longevity/horvath-simulation/grimage-history", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetHorvathSimulationGrimAgeHistory)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "GrimAge Baseline:") {
		t.Errorf("expected GrimAge simulation logs list, got %s", rr.Body.String())
	}
}

func TestHandleResetSearchDelayConfig(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/clients/config/search-delay/reset", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "coach-id-123", "coach")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleResetSearchDelayConfig)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "300ms") {
		t.Errorf("expected reset confirmation tag, got %s", rr.Body.String())
	}
}

func TestHandleSendGutDiversityAdvicePDFEmail(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/diagnostics/gut-diversity/advice/pdf/email", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleSendGutDiversityAdvicePDFEmail)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "report emailed successfully") {
		t.Errorf("expected PDF email dispatch confirmation, got %s", rr.Body.String())
	}
}

func TestHandleUpdateBillingReceiptPreference(t *testing.T) {
	form := url.Values{}
	form.Set("receipt_format", "pdf")

	req, err := http.NewRequest("POST", "/api/billing/receipts/preference", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleUpdateBillingReceiptPreference)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "PDF") {
		t.Errorf("expected format confirmation message, got %s", rr.Body.String())
	}
}

func TestHandleUpdatePublicationComment(t *testing.T) {
	form := url.Values{}
	form.Set("pmid", "35012345")
	form.Set("comment", "Study methodology is robust.")

	req, err := http.NewRequest("PUT", "/api/knowsitall/publication/comment", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleUpdatePublicationComment)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "methodology is robust") {
		t.Errorf("expected updated comment response, got %s", rr.Body.String())
	}
}

func TestHandleGetHRVSleepCorrelationYearly(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/wearables/hrv/sleep-correlation/yearly", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetHRVSleepCorrelationYearly)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "<svg") {
		t.Errorf("expected yearly correlation chart SVG, got %s", rr.Body.String())
	}
}

func TestHandleGetSecurityLocationsCount(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/profile/security-locations/count", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetSecurityLocationsCount)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Active") {
		t.Errorf("expected locations total count label, got %s", rr.Body.String())
	}
}

func TestHandleUpdateGutPhylumAlertThreshold(t *testing.T) {
	form := url.Values{}
	form.Set("bact_limit", "45")

	req, err := http.NewRequest("PUT", "/api/diagnostics/gut-diversity/phylum/alert", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleUpdateGutPhylumAlertThreshold)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "limits updated to ratio") {
		t.Errorf("expected update confirmation message, got %s", rr.Body.String())
	}
}

func TestHandleUpdateKnowsItAllParserRawJSONMetadata(t *testing.T) {
	form := url.Values{}
	form.Set("raw_json", `{"updated": true}`)

	req, err := http.NewRequest("PUT", "/api/knowsitall/upload-paper/raw-json", strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleUpdateKnowsItAllParserRawJSONMetadata)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
}

func TestHandleGetConsultationCalendarInviteStatus(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/consultations/calendar/status", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetConsultationCalendarInviteStatus)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "DELIVERED") {
		t.Errorf("expected calendar delivery status tag, got %s", rr.Body.String())
	}
}

func TestHandleGetProfileGender(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/profile/gender", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetProfileGender)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Male") {
		t.Errorf("expected gender value, got %s", rr.Body.String())
	}
}

func TestHandleGetHorvathSimulationDunedinPaceHistory(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/longevity/horvath-simulation/dunedinpace-history", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetHorvathSimulationDunedinPaceHistory)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "DunedinPACE Baseline:") {
		t.Errorf("expected DunedinPACE simulation logs list, got %s", rr.Body.String())
	}
}

func TestHandleGetClinicianSearchDelayOption(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/clients/config/search-delay/option", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "coach-id-123", "coach")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetClinicianSearchDelayOption)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Option:") {
		t.Errorf("expected delay config option tags, got %s", rr.Body.String())
	}
}

func TestHandlePrintGutDiversityAdviceHTML(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/gut-diversity/advice/html", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandlePrintGutDiversityAdviceHTML)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "html") {
		t.Errorf("expected printable HTML sheets, got %s", rr.Body.String())
	}
}

func TestHandleGetBillingReceiptPreferenceFormat(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/billing/receipts/preference/format", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetBillingReceiptPreferenceFormat)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Format:") {
		t.Errorf("expected format configuration labels, got %s", rr.Body.String())
	}
}

func TestHandleGetPublicationCommentsHistory(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/knowsitall/publication/comment?pmid=35012345", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetPublicationCommentsHistory)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "@Dr. Yerkes") {
		t.Errorf("expected comment annotations history lists, got %s", rr.Body.String())
	}
}

func TestHandleGetHRVSleepCorrelationYearlyMonthly(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/wearables/hrv/sleep-correlation/yearly/monthly", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetHRVSleepCorrelationYearlyMonthly)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "<svg") {
		t.Errorf("expected yearly sleep correlation monthly trend SVG charts, got %s", rr.Body.String())
	}
}

func TestHandleSearchSecurityLocations(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/profile/security-locations/search?search_ip=192.168.1.50", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleSearchSecurityLocations)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "192.168.1.50") {
		t.Errorf("expected location search query matching, got %s", rr.Body.String())
	}
}

func TestHandleGetConsultationCalendarInviteLogs(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/consultations/calendar/logs", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetConsultationCalendarInviteLogs)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "ICS Invitation Created") {
		t.Errorf("expected invite delivery audits log lists, got %s", rr.Body.String())
	}
}

func TestHandleSearchHorvathSimulationGrimAgeHistory(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/longevity/horvath-simulation/grimage-history/search?query=Baseline", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleSearchHorvathSimulationGrimAgeHistory)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Filtered:") {
		t.Errorf("expected search filtering values, got %s", rr.Body.String())
	}
}

func TestHandleUpdateClinicianSearchDelayOptionDefault(t *testing.T) {
	req, err := http.NewRequest("POST", "/api/clients/config/search-delay/default", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "coach-id-123", "coach")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleUpdateClinicianSearchDelayOptionDefault)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Default:") {
		t.Errorf("expected default delay config tags, got %s", rr.Body.String())
	}
}

func TestHandleGetBillingReceiptPreferenceLogs(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/billing/receipts/preference/logs", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetBillingReceiptPreferenceLogs)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Preference update log:") {
		t.Errorf("expected updates audit log feeds, got %s", rr.Body.String())
	}
}

func TestHandleSearchPublicationComments(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/knowsitall/publication/comment/search?comment_query=Methodology", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleSearchPublicationComments)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Matches:") {
		t.Errorf("expected searched comment list elements, got %s", rr.Body.String())
	}
}

func TestHandleGetHRVSleepCorrelationYearlyMonthlyDetails(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/wearables/hrv/sleep-correlation/yearly/monthly/details", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetHRVSleepCorrelationYearlyMonthlyDetails)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Trend Details:") {
		t.Errorf("expected detailed sleep correlation hover stats, got %s", rr.Body.String())
	}
}

func TestHandleGetKnowsItAllParserRawJSONMetadataLogs(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/knowsitall/upload-paper/raw-json/logs", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetKnowsItAllParserRawJSONMetadataLogs)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Metadata update:") {
		t.Errorf("expected parser metadata edits history log, got %s", rr.Body.String())
	}
}

func TestHandleSearchConsultationCalendarInviteLogs(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/consultations/calendar/logs/search?query=ICS", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleSearchConsultationCalendarInviteLogs)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Query:") {
		t.Errorf("expected searched Delivery Log table values, got %s", rr.Body.String())
	}
}

func TestHandleGetFitnessAlertsZone1(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/fitness/alerts/zone1", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetFitnessAlertsZone1)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Alert status:") {
		t.Errorf("expected Zone 1 warnings check status labels, got %s", rr.Body.String())
	}
}

func TestHandleSearchHorvathSimulationDunedinPaceHistory(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/longevity/horvath-simulation/dunedinpace-history/search?query=Baseline", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleSearchHorvathSimulationDunedinPaceHistory)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Filtered:") {
		t.Errorf("expected DunedinPACE simulation search results, got %s", rr.Body.String())
	}
}

func TestHandleGetClinicianSearchDelayOptionDefaultLogs(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/clients/config/search-delay/default/logs", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "coach-id-123", "coach")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetClinicianSearchDelayOptionDefaultLogs)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Logs:") {
		t.Errorf("expected default delay update history logs, got %s", rr.Body.String())
	}
}

func TestHandleGetBillingReceiptPreferenceLogsSearch(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/billing/receipts/preference/logs/search?query=PDF", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetBillingReceiptPreferenceLogsSearch)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Query:") {
		t.Errorf("expected searched billing preference logs, got %s", rr.Body.String())
	}
}

func TestHandleGetFitnessAlertsZone1Logs(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/fitness/alerts/zone1/logs", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetFitnessAlertsZone1Logs)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Logs:") {
		t.Errorf("expected zone 1 warning check validation logs, got %s", rr.Body.String())
	}
}

func TestHandleSearchHRVSleepCorrelationYearlyMonthlyDetails(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/wearables/hrv/sleep-correlation/yearly/monthly/details/search?query=Coefficient", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleSearchHRVSleepCorrelationYearlyMonthlyDetails)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Query:") {
		t.Errorf("expected searched yearly monthly sleep details, got %s", rr.Body.String())
	}
}

func TestHandleSearchKnowsItAllParserRawJSONMetadataLogs(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/knowsitall/upload-paper/raw-json/logs/search?query=title", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleSearchKnowsItAllParserRawJSONMetadataLogs)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Query:") {
		t.Errorf("expected searched raw JSON edits logs, got %s", rr.Body.String())
	}
}

func TestHandleSearchHorvathSimulationDunedinPaceHistoryLogs(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/longevity/horvath-simulation/dunedinpace-history/search/logs?search_logs=Baseline", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleSearchHorvathSimulationDunedinPaceHistoryLogs)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Filtered:") {
		t.Errorf("expected DunedinPACE history search logs, got %s", rr.Body.String())
	}
}

func TestHandleGetClinicianSearchDelayOptionDefaultLogsSearch(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/clients/config/search-delay/default/logs/search?query=300ms", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "coach-id-123", "coach")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetClinicianSearchDelayOptionDefaultLogsSearch)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Query:") {
		t.Errorf("expected filtered delay config search logs, got %s", rr.Body.String())
	}
}

func TestHandleGetGutDiversityAdviceHTMLLogs(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/gut-diversity/advice/html/logs?query=Calibration", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetGutDiversityAdviceHTMLLogs)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Query:") {
		t.Errorf("expected gut diversity print logs, got %s", rr.Body.String())
	}
}

func TestHandleGetFitnessAlertsZone1LogsSearch(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/fitness/alerts/zone1/logs/search?query=Alert", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetFitnessAlertsZone1LogsSearch)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Query:") {
		t.Errorf("expected filtered Zone 1 warning logs, got %s", rr.Body.String())
	}
}

func TestHandleGetGutPhylumAlertThresholdResetLogs(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/diagnostics/gut-diversity/phylum/alert/reset/logs?query=Reset", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetGutPhylumAlertThresholdResetLogs)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Query:") {
		t.Errorf("expected filtered gut resets logs, got %s", rr.Body.String())
	}
}
