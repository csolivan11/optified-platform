package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandleHealth(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/health", nil)
	if err != nil {
		t.Fatalf("failed to create health check request: %v", err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleHealth)
	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var resp map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode health response JSON: %v", err)
	}

	if resp["status"] != "healthy" {
		t.Errorf("expected status 'healthy', got '%v'", resp["status"])
	}
}

func TestFormatCitations(t *testing.T) {
	input := "Smith et al. (PLoS ONE 2010) [PMID: 123456] demonstrates folate methylation gains."
	expected := "Smith et al. (PLoS ONE 2010) [[PMID: 123456](https://pubmed.ncbi.nlm.nih.gov/123456)] demonstrates folate methylation gains."
	
	output := formatCitations(input)
	if output != expected {
		t.Errorf("citation formatter failed:\n  got:  %q\n  want: %q", output, expected)
	}
}

func TestVerifyMFAFail(t *testing.T) {
	body := []byte(`{"user_id":"dummy","code":"12a456"}`) // invalid non-digit character
	req, err := http.NewRequest("POST", "/api/auth/mfa", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to create MFA verification request: %v", err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleVerifyMFA)
	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("expected status %v, got %v", http.StatusUnauthorized, status)
	}
}
