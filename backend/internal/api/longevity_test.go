package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCalculateBiologicalAgeHorvath(t *testing.T) {
	// Chronological age: 40, Methylation rate: 0.76. Biological age should be less than 40.
	bioAge := CalculateBiologicalAge(40.0, 0.76)
	expected := 40.0 * (0.76 / 0.85)
	if bioAge != expected {
		t.Errorf("expected bio age %v, got %v", expected, bioAge)
	}
}

func TestMFAExportAuditLogGateFail(t *testing.T) {
	// Attempt download of PHI CSV without query parameter validation token, must return 403
	req, err := http.NewRequest("GET", "/api/audit-logs/dummy-id/export", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	// Mock context variables role admin
	req = req.WithContext(http.HandlerFunc(nil).ServeHTTP) // bare stub context
	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleExportAuditLogs)
	handler.ServeHTTP(rr, req)

	// Since context role is missing, it will fail at Forbidden: Clinicians only
	if rr.Code != http.StatusForbidden {
		t.Errorf("expected forbidden code 403, got %v", rr.Code)
	}
}

func TestMFAExportAuditLogGateWithRoleFail(t *testing.T) {
	// In the presence of admin/coach role context but missing mfa_token query parameter, it must return 403
	req, err := http.NewRequest("GET", "/api/audit-logs/dummy-id/export", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	// Inject role variables
	ctx := req.Context()
	ctx = withUserSession(ctx, "coach-id", "coach")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleExportAuditLogs)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403 due to missing mfa_token, got %v", rr.Code)
	}
}
