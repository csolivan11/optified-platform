package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

func TestConvertBiomarkerUnits(t *testing.T) {
	// 5.5 mmol/L should convert to ~99.1 mg/dL for glucose
	got := ConvertBiomarkerUnits(5.5, "mmol/L", "mg/dL")
	want := 5.5 * 18.0182
	if got != want {
		t.Errorf("ConvertBiomarkerUnits failed: got %v want %v", got, want)
	}

	// 180.182 mg/dL should convert to 10.0 mmol/L
	got = ConvertBiomarkerUnits(180.182, "mg/dL", "mmol/L")
	want = 10.0
	if got != want {
		t.Errorf("ConvertBiomarkerUnits failed: got %v want %v", got, want)
	}
}

func TestIsSignificantDeviation(t *testing.T) {
	// If baseline sleep HRV is 70 ms, and current drop is 50 ms (more than 20% drop), warn is true
	if !IsSignificantDeviation(50, 70) {
		t.Errorf("expected deviation warning to trigger")
	}

	// If current is 68 ms (less than 20% drop), warn is false
	if IsSignificantDeviation(65, 70) {
		t.Errorf("expected deviation warning to not trigger")
	}
}

func TestWebhookReplayAttackMitigation(t *testing.T) {
	// An expired timestamp (e.g. 10 minutes ago) must fail the request check
	expiredTime := time.Now().Unix() - 600
	body := []byte(`{"client_id":"dummy","vendor":"pnoe"}`)
	req, err := http.NewRequest("POST", "/api/webhook/ingest", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	req.Header.Set("X-Webhook-Timestamp", strconv.FormatInt(expiredTime, 10))
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleWebhookIngest)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected status %v for expired replay timestamp, got %v", http.StatusBadRequest, rr.Code)
	}
}
