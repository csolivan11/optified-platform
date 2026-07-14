# Query the current GCP Project metadata to retrieve the Project Number
data "google_project" "current" {}

# ─── KMS Key Ring ───────────────────────────────────────────────
resource "google_kms_key_ring" "optified_keyring" {
  name     = "optified-compliance-keyring"
  location = var.region
}

# ─── KMS Cryptographic Key: Cloud SQL ────────────────────────────
resource "google_kms_crypto_key" "db_key" {
  name            = "optified-db-key"
  key_ring        = google_kms_key_ring.optified_keyring.id
  rotation_period = "7776000s" # Rotate every 90 days (Compliance constraint)

  lifecycle {
    prevent_destroy = true # Protect data encryption key from accidental deletion
  }
}

# ─── KMS Cryptographic Key: Cloud Storage ────────────────────────
resource "google_kms_crypto_key" "storage_key" {
  name            = "optified-storage-key"
  key_ring        = google_kms_key_ring.optified_keyring.id
  rotation_period = "7776000s" # Rotate every 90 days

  lifecycle {
    prevent_destroy = true
  }
}

# ─── Service Identity IAM Bindings (Grant Decrypt/Encrypt) ──────
# Cloud SQL Service Account needs access to the DB key
resource "google_kms_crypto_key_iam_member" "cloudsql_kms" {
  crypto_key_id = google_kms_crypto_key.db_key.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-cloud-sql.iam.gserviceaccount.com"
}

# Cloud Storage Service Agent needs access to the Storage key
resource "google_kms_crypto_key_iam_member" "gcs_kms" {
  crypto_key_id = google_kms_crypto_key.storage_key.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:service-${data.google_project.current.number}@gs-project-accounts.iam.gserviceaccount.com"
}
