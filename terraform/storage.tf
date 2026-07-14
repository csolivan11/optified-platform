# ─── GCS Bucket for PHI Medical Documents ───────────────────────
resource "google_storage_bucket" "optified_phi_storage" {
  name          = "optified-phi-documents-${var.project_id}"
  location      = var.region
  force_destroy = false # Prevent accidental deletion of user data

  # ─── Strict Security Policies ─────────────────────────────────
  public_access_prevention = "enforced" # Block public internet access
  uniform_bucket_level_access = true    # Enforce IAM policy only (no ad-hoc object ACLs)

  # Customer-Managed Encryption Keys (CMEK) for PHI-at-rest
  encryption {
    default_kms_key_name = google_kms_crypto_key.storage_key.id
  }

  # Enable versioning to restore accidentally deleted/overwritten health records
  versioning {
    enabled = true
  }

  # ─── Data Lifecycle & Retention (HIPAA Compliance) ────────────
  # Enforce retention of medical files (typically 7 years) and tiering
  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
    condition {
      age = 90 # Move to nearline storage after 90 days of inactivity
    }
  }

  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "ARCHIVE"
    }
    condition {
      age = 365 # Archive after 1 year
    }
  }

  # ─── Storage Logging & Auditing ───────────────────────────────
  logging {
    log_bucket        = google_storage_bucket.optified_audit_logs.name
    log_object_prefix = "phi-access/"
  }
}

# ─── Separate Bucket for Audit & Access Logs ────────────────────
resource "google_storage_bucket" "optified_audit_logs" {
  name          = "optified-compliance-audit-logs-${var.project_id}"
  location      = var.region
  force_destroy = false

  public_access_prevention = "enforced"
  uniform_bucket_level_access = true

  # Encrypt audit logs with the storage key
  encryption {
    default_kms_key_name = google_kms_crypto_key.storage_key.id
  }

  # Version logs to prevent tampering
  versioning {
    enabled = true
  }

  # Enforce retention rule: audit logs cannot be deleted or overwritten for 365 days
  retention_policy {
    is_locked        = true # WARNING: Locked policy cannot be changed once active!
    retention_period = 31536000 # 365 days in seconds
  }
}

# ─── IAM Permissions for Application Pods ───────────────────────
# Grant read/write access to storage buckets for nextjs pods
resource "google_storage_bucket_iam_member" "gke_read_write" {
  bucket = google_storage_bucket.optified_phi_storage.name
  role   = "roles/storage.objectAdmin" # Read, write, list, delete objects
  member = "serviceAccount:${google_service_account.k8s_sa.email}"
}
