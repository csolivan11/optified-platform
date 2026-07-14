package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/csolivan11/optified-platform/backend/internal/db"
)

// ─── Profile models ────────────────────────────────────────────
type Profile struct {
	ID          string    `json:"id"`
	Role        string    `json:"role"` // 'client', 'coach', 'admin'
	FirstName   string    `json:"first_name"`
	LastName    string    `json:"last_name"`
	DisplayName string    `json:"display_name"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ClinicalNote struct {
	ID        string     `json:"id"`
	ClientID  string     `json:"client_id"`
	AuthorID  string     `json:"author_id"`
	Content   string     `json:"content"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	DeletedAt *time.Time `json:"deleted_at"`
}

type AuditLog struct {
	ID             string          `json:"id"`
	ActorID        string          `json:"actor_id"`
	ActorRole      string          `json:"actor_role"`
	Action         string          `json:"action"`
	ResourceType   *string         `json:"resource_type"`
	ResourceID     *string         `json:"resource_id"`
	TargetClientID *string         `json:"target_client_id"`
	Metadata       json.RawMessage `json:"metadata"`
	IPAddress      *string         `json:"ip_address"`
	UserAgent      *string         `json:"user_agent"`
	CreatedAt      time.Time       `json:"created_at"`
}

// ─── Profile Repository ─────────────────────────────────────────
type ProfileRepo struct{}

func (r *ProfileRepo) GetByID(ctx context.Context, id string) (*Profile, error) {
	row := db.Pool.QueryRow(ctx, 
		`SELECT id, role, first_name, last_name, display_name, created_at, updated_at 
		 FROM public.profiles WHERE id = $1`, id)
	
	var p Profile
	err := row.Scan(&p.ID, &p.Role, &p.FirstName, &p.LastName, &p.DisplayName, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *ProfileRepo) ListClients(ctx context.Context) ([]Profile, error) {
	rows, err := db.Pool.Query(ctx, 
		`SELECT id, role, first_name, last_name, display_name, created_at, updated_at 
		 FROM public.profiles WHERE role = 'client' ORDER BY last_name, first_name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Profile
	for rows.Next() {
		var p Profile
		if err := rows.Scan(&p.ID, &p.Role, &p.FirstName, &p.LastName, &p.DisplayName, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	return list, nil
}

// ─── Clinical Notes Repository (PHI Workload) ───────────────────
type ClinicalNotesRepo struct{}

func (r *ClinicalNotesRepo) ListForClient(ctx context.Context, clientId string) ([]ClinicalNote, error) {
	rows, err := db.Pool.Query(ctx, 
		`SELECT id, client_id, author_id, content, created_at, updated_at, deleted_at 
		 FROM phi_stub.clinical_notes 
		 WHERE client_id = $1 AND deleted_at IS NULL 
		 ORDER BY created_at DESC`, clientId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ClinicalNote
	for rows.Next() {
		var n ClinicalNote
		if err := rows.Scan(&n.ID, &n.ClientID, &n.AuthorID, &n.Content, &n.CreatedAt, &n.UpdatedAt, &n.DeletedAt); err != nil {
			return nil, err
		}
		list = append(list, n)
	}
	return list, nil
}

func (r *ClinicalNotesRepo) Create(ctx context.Context, n ClinicalNote) (*ClinicalNote, error) {
	row := db.Pool.QueryRow(ctx, 
		`INSERT INTO phi_stub.clinical_notes (client_id, author_id, content) 
		 VALUES ($1, $2, $3) 
		 RETURNING id, client_id, author_id, content, created_at, updated_at, deleted_at`, 
		n.ClientID, n.AuthorID, n.Content)
	
	var res ClinicalNote
	err := row.Scan(&res.ID, &res.ClientID, &res.AuthorID, &res.Content, &res.CreatedAt, &res.UpdatedAt, &res.DeletedAt)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// ─── Audit Log Repository ──────────────────────────────────────
type AuditLogRepo struct{}

func (r *AuditLogRepo) Create(ctx context.Context, l AuditLog) error {
	var metadataJSON []byte
	if l.Metadata != nil {
		metadataJSON = l.Metadata
	} else {
		metadataJSON = []byte("{}")
	}

	_, err := db.Pool.Exec(ctx, 
		`INSERT INTO public.audit_log (actor_id, actor_role, action, resource_type, resource_id, target_client_id, metadata, ip_address, user_agent) 
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, 
		l.ActorID, l.ActorRole, l.Action, l.ResourceType, l.ResourceID, l.TargetClientID, metadataJSON, l.IPAddress, l.UserAgent)
	
	if err != nil {
		return fmt.Errorf("failed to append to immutable audit log: %w", err)
	}
	return nil
}

func (r *AuditLogRepo) ListForTarget(ctx context.Context, targetClientId string) ([]AuditLog, error) {
	rows, err := db.Pool.Query(ctx, 
		`SELECT id, actor_id, actor_role, action, resource_type, resource_id, target_client_id, metadata, ip_address, user_agent, created_at 
		 FROM public.audit_log 
		 WHERE target_client_id = $1 
		 ORDER BY created_at DESC LIMIT 50`, targetClientId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []AuditLog
	for rows.Next() {
		var l AuditLog
		var ipStr *string
		if err := rows.Scan(&l.ID, &l.ActorID, &l.ActorRole, &l.Action, &l.ResourceType, &l.ResourceID, &l.TargetClientID, &l.Metadata, &ipStr, &l.UserAgent, &l.CreatedAt); err != nil {
			return nil, err
		}
		l.IPAddress = ipStr
		list = append(list, l)
	}
	return list, nil
}
