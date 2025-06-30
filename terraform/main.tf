# Terraform configuration for GCP infrastructure
terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Variables
variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "indieshots-prod"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

# Provider configuration
provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "sql.googleapis.com",
    "container.googleapis.com"
  ])

  service = each.value
  project = var.project_id

  disable_dependent_services = true
}

# Cloud SQL instance (optional, can use existing Neon)
resource "google_sql_database_instance" "postgres" {
  count            = var.use_cloud_sql ? 1 : 0
  name             = "indieshots-db"
  database_version = "POSTGRES_15"
  region           = var.region
  deletion_protection = false

  settings {
    tier = "db-f1-micro"
    
    disk_size = 10
    disk_type = "PD_SSD"
    
    backup_configuration {
      enabled = true
      start_time = "03:00"
      location = var.region
    }
    
    ip_configuration {
      ipv4_enabled = true
      authorized_networks {
        value = "0.0.0.0/0"
        name  = "all"
      }
    }
  }
}

resource "google_sql_database" "database" {
  count    = var.use_cloud_sql ? 1 : 0
  name     = "indieshots"
  instance = google_sql_database_instance.postgres[0].name
}

resource "google_sql_user" "user" {
  count    = var.use_cloud_sql ? 1 : 0
  name     = "indieshots"
  instance = google_sql_database_instance.postgres[0].name
  password = var.db_password
}

# Secret Manager secrets
resource "google_secret_manager_secret" "secrets" {
  for_each = toset([
    "database-url",
    "openai-api-key",
    "jwt-secret",
    "firebase-api-key",
    "firebase-project-id"
  ])

  secret_id = each.value
  
  replication {
    automatic = true
  }
}

# Cloud Run service
resource "google_cloud_run_service" "indieshots" {
  name     = "indieshots"
  location = var.region

  template {
    spec {
      containers {
        image = "gcr.io/${var.project_id}/indieshots:latest"
        
        ports {
          container_port = 8080
        }
        
        resources {
          limits = {
            cpu    = "1000m"
            memory = "512Mi"
          }
        }
        
        env {
          name  = "NODE_ENV"
          value = "production"
        }
        
        dynamic "env" {
          for_each = google_secret_manager_secret.secrets
          content {
            name = upper(replace(env.key, "-", "_"))
            value_from {
              secret_key_ref {
                name = env.value.secret_id
                key  = "latest"
              }
            }
          }
        }
      }
      
      container_concurrency = 80
      timeout_seconds = 300
    }
    
    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale" = "10"
        "autoscaling.knative.dev/minScale" = "0"
        "run.googleapis.com/execution-environment" = "gen2"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [google_project_service.required_apis]
}

# IAM policy for public access
resource "google_cloud_run_service_iam_member" "public_access" {
  service  = google_cloud_run_service.indieshots.name
  location = google_cloud_run_service.indieshots.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Custom domain mapping (optional)
resource "google_cloud_run_domain_mapping" "domain" {
  count    = var.custom_domain != "" ? 1 : 0
  location = var.region
  name     = var.custom_domain

  spec {
    route_name = google_cloud_run_service.indieshots.name
  }
}

# Variables for optional features
variable "use_cloud_sql" {
  description = "Use Cloud SQL instead of external database"
  type        = bool
  default     = false
}

variable "db_password" {
  description = "Database password for Cloud SQL"
  type        = string
  default     = ""
  sensitive   = true
}

variable "custom_domain" {
  description = "Custom domain for the application"
  type        = string
  default     = ""
}

# Outputs
output "service_url" {
  description = "URL of the Cloud Run service"
  value       = google_cloud_run_service.indieshots.status[0].url
}

output "database_connection_name" {
  description = "Connection name for Cloud SQL instance"
  value       = var.use_cloud_sql ? google_sql_database_instance.postgres[0].connection_name : ""
}