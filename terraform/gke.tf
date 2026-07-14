# ─── GKE Hardened Autopilot Cluster ─────────────────────────────
# GKE Autopilot automatically manages node provisioning, scaling, OS patching,
# and enforces strict security baselines (Shielded Nodes, Workload Identity).
resource "google_container_cluster" "optified_gke_cluster" {
  name     = "optified-prod-cluster"
  location = var.region

  # Use GKE Autopilot mode
  enable_autopilot = true

  # Attach to the private VPC subnet
  network    = google_compute_network.optified_vpc.id
  subnetwork = google_compute_subnetwork.optified_subnet.id

  # ─── Network Isolation Configuration ──────────────────────────
  ip_allocation_policy {
    cluster_secondary_range_name  = "optified-gke-pods"
    services_secondary_range_name = "optified-gke-services"
  }

  private_cluster_config {
    # Nodes only have private IPs, never exposed to the public internet
    enable_private_nodes = true
    # Keep control plane endpoint public but lock it down with Authorized Networks
    enable_private_endpoint = false
    master_global_access_config {
      enabled = true
    }
  }

  # Control Plane Authorized Networks (Lock down kubectl access)
  master_authorized_networks_config {
    gcp_public_cidrs_access_enabled = false
    cidr_blocks {
      cidr_block   = "10.0.0.0/20" # Allow access from within the VPC subnet (e.g. bastion)
      display_name = "Internal Subnet"
    }
    # User should add their corporate office IP or VPN gateway CIDR blocks here:
    # cidr_blocks {
    #   cidr_block   = "YOUR_VPN_GATEWAY_CIDR"
    #   display_name = "Corporate VPN"
    # }
  }

  # ─── Enterprise Compliance Features ───────────────────────────
  # Enforces cryptographic verification of GKE node boot integrity
  shielded_nodes {
    enabled = true
  }

  # Enforce binary authorization (only verified container images run)
  binary_authorization {
    evaluation_mode = "PROJECT_SINGLETON_POLICY_ENFORCE"
  }

  # Release channel decides update cadence (Regular is recommended for production compliance)
  release_channel {
    channel = "REGULAR"
  }

  # Cost/operational tags
  resource_labels = {
    environment = "production"
    owner       = "optified-ops"
  }

  depends_on = [
    google_service_networking_connection.optified_private_vpc_connection
  ]
}

# ─── Workload Identity IAM Binding ──────────────────────────────
# Binds the Kubernetes Service Account to the GCP Service Account
resource "google_service_account" "k8s_sa" {
  account_id   = "optified-app-k8s"
  display_name = "Kubernetes Service Account for Optified NextJS Pods"
}

resource "google_service_account_iam_member" "workload_identity_binding" {
  service_account_id = google_service_account.k8s_sa.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[optified/optified-app-sa]"
}
