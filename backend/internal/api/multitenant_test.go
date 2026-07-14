package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandleQuestIngestPanicTrigger(t *testing.T) {
	// Querying webhook ingestion that parses a critical panic glucose value (e.g. 315 mg/dL)
	body := []byte(`{"client_id":"dummy-id","glucose":315.0}`)
	req, err := http.NewRequest("POST", "/api/webhook/quest", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to create Quest request: %v", err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleQuestIngest)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}
}

func TestVerifyHIPAAConsentCheck(t *testing.T) {
	// Check standard HIPAA consent signature verification triggers
	if !VerifyHIPAAConsent("dummy-profile-id") {
		t.Errorf("expected HIPAA consent sign-off status validation check to return true")
	}
}

func TestCheckSupplementContraindicationsConflict(t *testing.T) {
	// Verify calcium-iron conflict check flags
	conflictMsg := CheckSupplementContraindications("Iron")
	expected := "Contraindication: Iron should not be combined with Calcium as they bind and reduce absorption."
	if conflictMsg != expected {
		t.Errorf("expected %q conflict alert, got %q", expected, conflictMsg)
	}

	noConflict := CheckSupplementContraindications("L-5-MTHF")
	if noConflict != "No immediate contraindications found in KnowsItAll database." {
		t.Errorf("unexpected contraindication result: %q", noConflict)
	}
}
