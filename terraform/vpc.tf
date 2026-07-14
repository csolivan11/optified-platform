# ─── VPC Network ────────────────────────────────────────────────
resource "google_compute_network" "optified_vpc" {
  name                    = "optified-vpc"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

# ─── Private Subnet with Private Google Access ──────────────────
resource "google_compute_subnetwork" "optified_subnet" {
  name                     = "optified-subnet"
  ip_cidr_range            = "10.0.0.0/20"
  region                   = var.region
  network                  = google_compute_network.optified_vpc.id
  private_ip_google_access = true # Required for calling GCP APIs without public IP

  # Secondary ranges for Kubernetes pods and services (GKE requirements)
  secondary_ip_range {
    range_name    = "optified-gke-pods"
    ip_cidr_range = "172.16.0.0/14"
  }
  secondary_ip_range {
    range_name    = "optified-gke-services"
    ip_cidr_range = "172.20.0.0/20"
  }
}

# ─── Private IP Access for Managed Services (Cloud SQL) ─────────
# Allocated range for Cloud SQL Private Service Access (PSA)
resource "google_compute_global_address" "optified_psa_ip_range" {
  name          = "optified-psa-ip-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.optified_vpc.id
}

# Peer VPC network with Google Services (Service Networking API)
resource "google_service_networking_connection" "optified_private_vpc_connection" {
  network                 = google_compute_network.optified_vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.optified_psa_ip_range.name]
}

# ─── Outbound Traffic Routing (Cloud Router + NAT) ──────────────
resource "google_compute_router" "optified_router" {
  name    = "optified-router"
  region  = var.region
  network = google_compute_network.optified_vpc.id
}

# Cloud NAT allows nodes and pods (private IPs) to send traffic outbound to
# external APIs (like Resend) but prevents external networks from initiating ingress.
resource "google_compute_router_nat" "optified_nat" {
  name                               = "optified-nat"
  router                             = google_compute_router.optified_router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}
