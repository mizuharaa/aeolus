variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Project name used as prefix for all resource names"
  type        = string
  default     = "aeolus"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones to use"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

# ── ECS / Fargate ──────────────────────────────────────────────────────────────

variable "api_cpu" {
  description = "CPU units for the API ECS task (1024 = 1 vCPU)"
  type        = number
  default     = 1024
}

variable "api_memory" {
  description = "Memory (MiB) for the API ECS task"
  type        = number
  default     = 2048
}

variable "api_desired_count" {
  description = "Number of API task replicas"
  type        = number
  default     = 2
}

variable "api_container_port" {
  description = "Container port for the FastAPI application"
  type        = number
  default     = 8000
}

# ── RDS (PostgreSQL + TimescaleDB) ────────────────────────────────────────────

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "Allocated storage (GiB) for RDS"
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Name of the PostgreSQL database"
  type        = string
  default     = "aeolus"
}

variable "db_username" {
  description = "Master username for RDS"
  type        = string
  default     = "aeolus_app"
  sensitive   = true
}

variable "db_password" {
  description = "Master password for RDS (use AWS Secrets Manager in prod)"
  type        = string
  sensitive   = true
}

variable "db_backup_retention_days" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 7
}

# ── ElastiCache (Redis) ───────────────────────────────────────────────────────

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_nodes" {
  description = "Number of Redis cluster nodes"
  type        = number
  default     = 1
}

# ── ECR ───────────────────────────────────────────────────────────────────────

variable "ecr_image_tag" {
  description = "Docker image tag to deploy (set by CI/CD)"
  type        = string
  default     = "latest"
}

variable "ecr_scan_on_push" {
  description = "Enable ECR image scanning on push"
  type        = bool
  default     = true
}

# ── ALB ───────────────────────────────────────────────────────────────────────

variable "alb_deletion_protection" {
  description = "Enable ALB deletion protection"
  type        = bool
  default     = false
}

variable "health_check_path" {
  description = "ALB target group health check path"
  type        = string
  default     = "/health"
}

# ── Tags ──────────────────────────────────────────────────────────────────────

variable "common_tags" {
  description = "Common tags applied to all resources"
  type        = map(string)
  default = {
    Project     = "aeolus"
    ManagedBy   = "terraform"
    Owner       = "nimbus-ops"
  }
}
