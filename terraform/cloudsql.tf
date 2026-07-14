# ─── Cloud SQL Database Instance ────────────────────────────────
# Managed PostgreSQL hardened for HIPAA and FedRAMP Moderate compliance.
resource "google_sql_database_instance" "optified_postgres" {
  name             = "optified-prod-db"
  database_version = "POSTGRES_15"
  region           = var.region

  # Associate with Cloud KMS Key for Customer-Managed Encryption at Rest
  encryption_key_name = google_kms_crypto_key.db_key.id

  settings {
    tier = "db-custom-2-7680" # 2 vCPU, 7.5GB RAM (Standard compliance starting sizing)

    # ─── High Availability & Backups ────────────────────────────
    # HA regional deployment handles physical zone failures
    availability_type = "REGIONAL"

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00" # Offset hour
      point_in_time_recovery_enabled = true    # Required for disaster recovery compliance
      transaction_log_retention_days = 7
      backup_retention_settings {
        retention_unit   = "COUNT"
        retained_backups = 30 # Retain 30 days of backups
      }
    }

    # ─── Network Isolation ──────────────────────────────────────
    ip_configuration {
      ipv4_enabled    = false # No public IP allowed!
      private_network = google_compute_network.optified_vpc.id
      require_ssl     = true  # Enforce TLS in-transit
    }

    # ─── Hardening & Audit Logging Flags ───────────────────────
    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on" # Enable passwordless IAM Database authentication
    }

    database_flags {
      name  = "log_connections"
      value = "on" # Audit when connections occur
    }

    database_flags {
      name  = "log_disconnections"
      value = "on" # Audit when connections close
    }

    database_flags {
      name  = "log_min_messages"
      value = "warning" # Avoid log flooding but capture errors
    }

    location_preference {
      zone = "${var.region}-a"
    }
  }

  depends_on = [
    google_service_networking_connection.optified_private_vpc_connection
  ]
}

# ─── Databases ──────────────────────────────────────────────────
resource "google_sql_database" "optified_db" {
  name     = "optified"
  instance = google_sql_database_instance.optified_postgres.name
}

# ─── IAM DB Auth Permissions ────────────────────────────────────
# Grants GKE app service account role to authenticate to the DB via IAM
resource "google_project_iam_member" "db_client_role" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.k8s_sa.email}"
}

resource "google_project_iam_member" "db_instance_user" {
  project = var.project_id
  role    = "roles/cloudsql.instanceUser"
  member  = "serviceAccount:${google_service_account.k8s_sa.email}"
}
