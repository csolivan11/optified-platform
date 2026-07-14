package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/csolivan11/optified-platform/backend/internal/db"
	"github.com/csolivan11/optified-platform/backend/internal/repository"
)

// MobileMetric represents a single metric sample sent from iOS or Android devices
type MobileMetric struct {
	Metric     string    `json:"metric"`
	Value      float64   `json:"value"`
	Unit       string    `json:"unit"`
	RecordedAt time.Time `json:"recorded_at"`
}

// WearablesSyncPayload represents the body of the /api/wearables/sync endpoint
type WearablesSyncPayload struct {
	Provider string         `json:"provider"` // 'apple_health', 'oura', 'whoop', 'fitbit'
	Metrics  []MobileMetric `json:"metrics"`
}

// HandleWearablesSync handles POST submissions from iOS (HealthKit) or Android (Health Connect) client apps
func HandleWearablesSync(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	clientID, _ := ctx.Value(UserIDKey).(string)
	clientRole, _ := ctx.Value(UserRoleKey).(string)

	if clientID == "" {
		http.Error(w, "Unauthorized: Session client identifier missing", http.StatusUnauthorized)
		return
	}

	// Read body payload
	body, err := io.ReadAll(r.Body)
	if err != nil {
		slog.Error("failed to read sync body", "error", err)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	var payload WearablesSyncPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		slog.Error("failed to parse sync payload", "error", err)
		http.Error(w, "Invalid JSON structure", http.StatusBadRequest)
		return
	}

	// Validate provider enum value
	validProviders := map[string]bool{
		"oura":         true,
		"whoop":        true,
		"garmin":       true,
		"apple_health": true,
		"fitbit":       true,
	}
	if !validProviders[payload.Provider] {
		http.Error(w, "Invalid wearable provider", http.StatusBadRequest)
		return
	}

	// Connect to database and upsert metrics
	conn, err := db.Pool.Acquire(ctx)
	if err != nil {
		slog.Error("database connection pool acquisition failed", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer conn.Release()

	tx, err := conn.Begin(ctx)
	if err != nil {
		slog.Error("failed to begin database transaction", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	upsertCount := 0
	for _, m := range payload.Metrics {
		// Log JSON string for raw_payload column
		rawPayloadBytes, _ := json.Marshal(m)
		
		_, err := tx.Exec(ctx,
			`INSERT INTO public.wearable_data_points (client_id, provider, metric, value, unit, recorded_at, raw_payload)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 ON CONFLICT (client_id, provider, metric, recorded_at)
			 DO UPDATE SET value = EXCLUDED.value, raw_payload = EXCLUDED.raw_payload;`,
			clientID, payload.Provider, m.Metric, m.Value, m.Unit, m.RecordedAt, string(rawPayloadBytes),
		)
		if err != nil {
			slog.Error("failed to upsert wearable metric", "metric", m.Metric, "error", err)
			continue
		}

		if m.Metric == "sleep_score" || m.Metric == "hrv_rmssd" {
			col := "sleep_score"
			if m.Metric == "hrv_rmssd" {
				col = "hrv_rmssd"
			}
			query := fmt.Sprintf(`
				INSERT INTO phi_stub.sleep_logs (client_id, sleep_date, %[1]s)
				VALUES ($1, $2, $3)
				ON CONFLICT (client_id, sleep_date)
				DO UPDATE SET %[1]s = EXCLUDED.%[1]s;`, col)
			
			_, err = tx.Exec(ctx, query, clientID, m.RecordedAt.Format("2006-01-02"), m.Value)
			if err != nil {
				slog.Error("failed to sync sleep log metrics", "col", col, "error", err)
			}
		}

		upsertCount++
	}

	// Append entry to compliance audit logs
	ip := r.RemoteAddr
	ua := r.UserAgent()
	resType := "wearables_data"
	action := "sync_wearable_metrics"
	metaBytes, _ := json.Marshal(map[string]interface{}{
		"provider":      payload.Provider,
		"metrics_count": len(payload.Metrics),
		"saved_count":   upsertCount,
	})
	metaStr := string(metaBytes)

	auditLog := repository.AuditLog{
		ActorID:        clientID,
		ActorRole:      clientRole,
		Action:         action,
		ResourceType:   &resType,
		TargetClientID: &clientID,
		IPAddress:      &ip,
		UserAgent:      &ua,
		Metadata:       &metaStr,
	}

	auditRepo := &repository.AuditLogRepo{}
	if err := auditRepo.Create(ctx, auditLog); err != nil {
		slog.Error("failed to log wearables compliance audit action", "error", err)
	}

	if err := tx.Commit(ctx); err != nil {
		slog.Error("failed to commit wearables transaction", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	slog.Info("Successfully synchronized wearable metrics", "client_id", clientID, "count", upsertCount)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"synced":  upsertCount,
	})
}

// FetchOuraSleepMetrics calls Oura REST API v2 using stored access tokens and updates local DB
func FetchOuraSleepMetrics(ctx context.Context, clientID string, accessToken string) error {
	slog.Info("Querying Oura REST API v2...", "client_id", clientID)
	
	// Create secure REST request
	url := fmt.Sprintf("https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=%s", 
		time.Now().AddDate(0, 0, -3).Format("2006-01-02")) // Sync last 3 days
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("oura API returned error code %d", resp.StatusCode)
	}

	// Parsing Oura API response structure stub
	var ouraResp struct {
		Data []struct {
			Day             string    `json:"day"`
			Score           float64   `json:"score"`
			Timestamp       time.Time `json:"timestamp"`
			RestingHeartRate float64   `json:"resting_heart_rate"`
			HRV             float64   `json:"hrv"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&ouraResp); err != nil {
		return err
	}

	conn, err := db.Pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	for _, d := range ouraResp.Data {
		// Log Sleep Score
		_, _ = conn.Exec(ctx,
			`INSERT INTO public.wearable_data_points (client_id, provider, metric, value, unit, recorded_at)
			 VALUES ($1, 'oura', 'sleep_score', $2, 'score', $3)
			 ON CONFLICT (client_id, provider, metric, recorded_at) DO NOTHING;`,
			clientID, d.Score, d.Timestamp,
		)
		// Log HRV RMSSD
		if d.HRV > 0 {
			_, _ = conn.Exec(ctx,
				`INSERT INTO public.wearable_data_points (client_id, provider, metric, value, unit, recorded_at)
				 VALUES ($1, 'oura', 'hrv_rmssd', $2, 'ms', $3)
				 ON CONFLICT (client_id, provider, metric, recorded_at) DO NOTHING;`,
				clientID, d.HRV, d.Timestamp,
			)
		}
	}

	// Update connection last_sync_at status
	_, _ = conn.Exec(ctx,
		`UPDATE public.wearable_connections 
		 SET last_sync_at = now() 
		 WHERE client_id = $1 AND provider = 'oura';`,
		clientID,
	)

	return nil
}
