terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  type        = string
  description = "The target GCP project ID."
  default     = "optified-prod"
}

variable "region" {
  type        = string
  description = "Primary deployment region."
  default     = "us-east1"
}

variable "organization_id" {
  type        = string
  description = "GCP Organization ID (Required for Assured Workloads)."
  default     = "123456789012" # Place holder, user will override
}

variable "billing_account" {
  type        = string
  description = "GCP Billing Account ID."
  default     = "012345-6789AB-CDEF01"
}

# ─── Assured Workload Compliance Folder ─────────────────────────
# Creates a folder governed by the FedRAMP Moderate / HIPAA control set.
resource "google_assured_workloads_workload" "optified_compliance_workload" {
  provider                  = google
  compliance_regime         = "FEDRAMP_MODERATE" # Or "HIPAA" or "EU_REGIONS_AND_SUPPORT"
  display_name              = "optified-compliance-workload"
  location                  = "us-east1"
  organization              = var.organization_id
  billing_account           = "billingAccounts/${var.billing_account}"

  kms_settings {
    next_rotation_time = "2026-10-15T00:00:00Z"
    rotation_period    = "7776000s" # 90 days rotation
  }

  resource_settings {
    resource_id   = "optified-prod-workload"
    resource_type = "CONSUMER_PROJECT"
  }

  labels = {
    environment = "production"
    application = "optified"
  }
}
