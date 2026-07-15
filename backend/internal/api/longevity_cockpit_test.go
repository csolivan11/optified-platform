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
