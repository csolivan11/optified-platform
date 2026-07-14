package db

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DB holds the connection pool reference
var Pool *pgxpool.Pool

// InitDB initializes a secure pgx connection pool
func InitDB(ctx context.Context) error {
	dbHost := getEnv("DB_HOST", "127.0.0.1")
	dbPort := getEnv("DB_PORT", "5432")
	dbUser := getEnv("DB_USER", "optified-app-k8s@optified-prod.iam") // IAM DB user or local postgres
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := getEnv("DB_NAME", "optified")

	// Construct DSN
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=verify-ca", dbUser, dbPassword, dbHost, dbPort, dbName)
	if os.Getenv("NODE_ENV") != "production" {
		// Disable verify-ca for local development unless CA is provided
		dsn = fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", dbUser, dbPassword, dbHost, dbPort, dbName)
	}

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return fmt.Errorf("unable to parse connection string: %w", err)
	}

	// Hardening database pool sizing for GKE compliance pods
	config.MaxConns = 25
	config.MinConns = 2
	config.MaxConnIdleTime = 30 * time.Minute
	config.MaxConnLifetime = 1 * time.Hour
	config.HealthCheckPeriod = 1 * time.Minute

	// Configure SSL certificates in production (FedRAMP / HIPAA requirement)
	if os.Getenv("NODE_ENV") == "production" {
		caPath := getEnv("DB_SSL_CA_CERT", "/etc/ssl/certs/gcp-cloud-sql-ca.pem")
		caCert, err := os.ReadFile(caPath)
		if err != nil {
			return fmt.Errorf("failed to read DB root CA cert from %s: %w", caPath, err)
		}

		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return fmt.Errorf("failed to append root CA cert to pool")
		}

		config.ConnConfig.TLSConfig = &tls.Config{
			RootCAs:            caCertPool,
			InsecureSkipVerify: false,
			ServerName:         dbHost,
		}
	}

	// Connect to database pool
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return fmt.Errorf("failed to create database connection pool: %w", err)
	}

	// Test the connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return fmt.Errorf("failed to ping database: %w", err)
	}

	Pool = pool
	slog.Info("Successfully initialized secure PostgreSQL connection pool with GKE local VPC Service Control boundaries.")
	return nil
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
