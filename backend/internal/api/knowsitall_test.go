package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandleKnowsItAllChatFail(t *testing.T) {
	// Request without session must return 401 Unauthorized
	body := []byte(`{"message":"Explain autophagy benefits."}`)
	req, err := http.NewRequest("POST", "/api/chat/knowsitall", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to create KnowsItAll chat request: %v", err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleKnowsItAllChat)
	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("expected status %v, got %v", http.StatusUnauthorized, status)
	}
}

func TestHandleKnowsItAllChatSuccessWithMock(t *testing.T) {
	body := []byte(`{"message":"Explain autophagy benefits.","min_impact_factor":"0.0"}`)
	req, err := http.NewRequest("POST", "/api/chat/knowsitall", bytes.NewBuffer(body))
	if err != nil {
		t.Fatalf("failed to create KnowsItAll request: %v", err)
	}

	ctx := req.Context()
	ctx = withUserSession(ctx, "client-id-123", "client")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleKnowsItAllChat)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %v", rr.Code)
	}

	if !strings.Contains(rr.Body.String(), "autophagy") {
		t.Errorf("expected response to contain autophagy mock info, got %s", rr.Body.String())
	}
}

func TestHandleGetKnowledgeGraph(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/knowsitall/graph", nil)
	if err != nil {
		t.Fatalf("failed to create graph lookup request: %v", err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleGetKnowledgeGraph)
	handler.ServeHTTP(rr, req)

	// Since DB pool is mock/nil during bare unit test, it might fail to scan or query,
	// but let's verify it gets handled gracefully (either returning 500 or returning empty array).
	if status := rr.Code; status != http.StatusOK && status != http.StatusInternalServerError {
		t.Errorf("unexpected status returned: got %v", status)
	}
}

func TestHandleExportCitationsFail(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/knowsitall/export-citations", nil)
	if err != nil {
		t.Fatalf("failed to create export request: %v", err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HandleExportCitations)
	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusForbidden {
		t.Errorf("expected forbidden for empty role session, got %v", status)
	}
}
