package main

import (
	"context"
	"embed"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/csolivan11/optified-platform/backend/internal/api"
	"github.com/csolivan11/optified-platform/backend/internal/db"
)

//go:embed templates/*
var templatesFS embed.FS

func main() {
	// Configure JSON structured logging to stdout (GCP Cloud Logging native format)
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	slog.Info("Starting Optified Compliance Server in GKE...", "time", time.Now().Format(time.RFC3339))

	// Initialize embedded templates
	if err := api.InitTemplates(templatesFS); err != nil {
		slog.Error("Template parsing failed", "error", err)
		os.Exit(1)
	}

	// Base context for startup/shutdown lifecycle
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Initialize secure database pool
	if err := db.InitDB(ctx); err != nil {
		slog.Error("Database initialization failed", "error", err)
		os.Exit(1)
	}
	defer func() {
		slog.Info("Closing database connection pool...")
		if db.Pool != nil {
			db.Pool.Close()
		}
	}()

	// Configure HTTP Router
	router := api.ConfigureRouter()

	port := getEnv("PORT", "3000")
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Run server in a goroutine so it doesn't block shutdown signals
	go func() {
		slog.Info("Optified HTTP server running", "port", port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("Server listen failed", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for SIGINT or SIGTERM shutdown signal
	<-ctx.Done()
	slog.Info("Shutdown signal received, starting graceful termination...")

	// Create context with timeout for pending connections
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("Forced server shutdown", "error", err)
	}

	slog.Info("Optified Compliance Server terminated successfully.")
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
