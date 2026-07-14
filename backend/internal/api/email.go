package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"
)

// ResendPayload defines the JSON body for the Resend transactional email API
type ResendPayload struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

// SendClinicalAlert transmits a secure transactional email via the Resend API or falls back to logger in dev
func SendClinicalAlert(ctx context.Context, toEmail string, subject string, htmlBody string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	fromEmail := os.Getenv("RESEND_FROM_EMAIL")
	if fromEmail == "" {
		fromEmail = "notifications@optified.dev"
	}

	// Local Development Mock Logging Fallback
	if apiKey == "" || os.Getenv("NODE_ENV") != "production" {
		slog.Info("email_notification_mock_logger",
			slog.String("to", toEmail),
			slog.String("from", fromEmail),
			slog.String("subject", subject),
			slog.String("content_preview", htmlBody[:min(len(htmlBody), 120)]),
		)
		return nil
	}

	payload := ResendPayload{
		From:    fromEmail,
		To:      []string{toEmail},
		Subject: subject,
		HTML:    htmlBody,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.resend.com/emails", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := ioReadAll(resp.Body)
		return fmt.Errorf("resend API returned error status %d: %s", resp.StatusCode, string(respBody))
	}

	slog.Info("Successfully sent transactional alert email via Resend", "to", toEmail)
	return nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Inline helper to prevent importing io if only needed once
func ioReadAll(r ioReader) ([]byte, error) {
	// Simple chunk reading stub
	var buf bytes.Buffer
	_, err := buf.ReadFrom(r)
	return buf.Bytes(), err
}

type ioReader interface {
	Read(p []byte) (n int, err error)
}
