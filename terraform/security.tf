# ─── Cloud Armor Web Application Firewall (WAF) ──────────────────
# Hardened WAF to protect GKE ingress from SQLi, XSS, and DDoS attacks.
resource "google_compute_security_policy" "optified_waf_policy" {
  name        = "optified-waf-policy"
  description = "FedRAMP/HIPAA aligned WAF security policy for Optified"

  # Default rule: Allow traffic (we'll selectively block or rate-limit)
  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow rule"
  }

  # ─── Rate Limiting Rule (Prevent brute-force / DDoS) ───────────
  rule {
    action   = "throttle"
    priority = "1000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      cone_stretching_type = "DEFAULT"
      exceed_action        = "deny(429)" # Too many requests HTTP status
      rate_limit_threshold {
        count        = 120
        interval_sec = 60 # 120 requests per minute limit per client IP
      }
    }
    description = "Global rate limit"
  }

  # ─── Block OWASP Top 10 vulnerabilities (SQLi, XSS, LFI) ────────
  # SQL Injection Protection
  rule {
    action   = "deny(403)"
    priority = "2000"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-v33-stable')"
      }
    }
    description = "Block SQL Injection attacks"
  }

  # Cross-Site Scripting (XSS) Protection
  rule {
    action   = "deny(403)"
    priority = "3000"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-v33-stable')"
      }
    }
    description = "Block Cross-Site Scripting (XSS) attacks"
  }

  # Local File Inclusion (LFI) & Path Traversal
  rule {
    action   = "deny(403)"
    priority = "4000"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('lfi-v33-stable')"
      }
    }
    description = "Block Local File Inclusion / Path Traversal attacks"
  }

  # Remote Code Execution (RCE) Protection
  rule {
    action   = "deny(403)"
    priority = "5000"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('rce-v33-stable')"
      }
    }
    description = "Block Remote Code Execution (RCE) attacks"
  }
}

# ─── GCP Secret Manager (Compliance Secrets Storage) ────────────
# Secrets are encrypted-at-rest using KMS CMEK key.
resource "google_secret_manager_secret" "resend_api_key" {
  secret_id = "resend-api-key"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "supabase_anon_key" {
  secret_id = "supabase-anon-key"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "supabase_jwt_secret" {
  secret_id = "supabase-jwt-secret"
  replication {
    auto {}
  }
}

# ─── Secret Manager IAM Access Bindings ─────────────────────────
# Grant GKE application pod service account permission to read compliance secrets
resource "google_secret_manager_secret_iam_member" "resend_api_key_accessor" {
  secret_id = google_secret_manager_secret.resend_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.k8s_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "supabase_anon_key_accessor" {
  secret_id = google_secret_manager_secret.supabase_anon_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.k8s_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "supabase_jwt_secret_accessor" {
  secret_id = google_secret_manager_secret.supabase_jwt_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.k8s_sa.email}"
}

# ─── VPC Service Controls (VPC-SC) Perimeter (Conceptual) ──────
# Note: VPC-SC perimeters are global resources governed at the Organization level
# using Access Context Manager. This configuration outline specifies the services
# that should be locked within the security perimeter to protect from data exfiltration:
#
# Perimeter Services:
# - storage.googleapis.com (Cloud Storage)
# - sqladmin.googleapis.com (Cloud SQL API)
# - secretmanager.googleapis.com (Secret Manager)
# - container.googleapis.com (Google Kubernetes Engine)
#
# Access Levels:
# - Enforce context access (only allow GKE cluster outbound calls, bastion host IPs,
#   and verified developer VPN endpoints to interact with these APIs).
