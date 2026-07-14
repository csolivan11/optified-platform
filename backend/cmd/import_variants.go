package main

import (
	"context"
	"encoding/csv"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/csolivan11/optified-platform/backend/internal/db"
)

func main() {
	csvPath := flag.String("csv", "", "Path to the genomic variants CSV file to import")
	dbURL := flag.String("db", "", "PostgreSQL database connection URL")
	flag.Parse()

	if *csvPath == "" || *dbURL == "" {
		log.Fatalf("Usage: go run import_variants.go -csv <path> -db <postgres_url>")
	}

	ctx := context.Background()

	// Initialize Database Pool
	os.Setenv("DATABASE_URL", *dbURL)
	if err := db.Init(ctx); err != nil {
		log.Fatalf("Failed to initialize database pool: %v", err)
	}
	defer db.Close()

	// Read CSV file
	file, err := os.Open(*csvPath)
	if err != nil {
		log.Fatalf("Failed to open CSV file: %v", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		log.Fatalf("Failed to read CSV records: %v", err)
	}

	// Skip header row
	if len(records) > 0 {
		records = records[1:]
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Fatalf("Failed to start transaction: %v", err)
	}
	defer tx.Rollback(ctx)

	importedCount := 0
	for _, row := range records {
		if len(row) < 6 {
			continue
		}
		clientID := row[0]
		geneName := row[1]
		rsid := row[2]
		genotype := row[3]
		impactLevel := row[4]
		clinicalNote := row[5]

		_, err := tx.Exec(ctx,
			`INSERT INTO phi_stub.genomic_variants (client_id, gene_name, rsid, genotype, impact_level, clinical_note)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 ON CONFLICT (client_id, gene_name, rsid) DO UPDATE 
			 SET genotype = EXCLUDED.genotype, impact_level = EXCLUDED.impact_level, clinical_note = EXCLUDED.clinical_note;`,
			clientID, geneName, rsid, genotype, impactLevel, clinicalNote,
		)
		if err != nil {
			log.Printf("Warning: failed to import row %v: %v", row, err)
			continue
		}
		importedCount++
	}

	if err := tx.Commit(ctx); err != nil {
		log.Fatalf("Failed to commit transaction: %v", err)
	}

	fmt.Printf("Successfully imported %d genomic variant records!\n", importedCount)
}
