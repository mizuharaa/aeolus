variable "aws_region" {
  description = "AWS region for Aeolus"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Resource name prefix"
  type        = string
  default     = "aeolus"
}

variable "vpc_cidr" {
  description = "CIDR for the dedicated VPC"
  type        = string
  default     = "10.42.0.0/16"
}

variable "instance_type" {
  description = "Single ECS container instance; t3a.small keeps the stack near $45/month"
  type        = string
  default     = "t3a.small"
}

variable "root_volume_size_gb" {
  description = "Encrypted gp3 root disk size"
  type        = number
  default     = 20
}

variable "image_tag" {
  description = "Mutable bootstrap tag deployed by GitHub Actions"
  type        = string
  default     = "latest"
}

variable "service_desired_count" {
  description = "Use 0 for the first apply, then 1 after images are pushed"
  type        = number
  default     = 0

  validation {
    condition     = contains([0, 1], var.service_desired_count)
    error_message = "Aeolus must use zero or one task until simulation state is externalized."
  }
}

variable "domain_name" {
  description = "Optional Route 53 hostname, for example aeolus.example.com"
  type        = string
  default     = ""
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID; required with domain_name to enable HTTPS"
  type        = string
  default     = ""
}

variable "enable_deletion_protection" {
  description = "Protect the ALB from accidental deletion"
  type        = bool
  default     = false
}

variable "monthly_budget_usd" {
  description = "Monthly AWS budget guardrail"
  type        = number
  default     = 50
}

variable "budget_alert_email" {
  description = "Email for 80% and 100% forecast budget alerts"
  type        = string
  default     = ""
}

variable "github_repository" {
  description = "GitHub owner/repository allowed to assume the deployment role"
  type        = string
  default     = "mizuharaa/aeolus"
}

variable "create_github_oidc_provider" {
  description = "Create the account-level GitHub Actions OIDC provider"
  type        = bool
  default     = true
}

variable "github_oidc_provider_arn" {
  description = "Existing GitHub OIDC provider ARN when creation is disabled"
  type        = string
  default     = ""
}

variable "common_tags" {
  description = "Tags applied to all supported resources"
  type        = map(string)
  default = {
    Project   = "aeolus"
    ManagedBy = "terraform"
    Purpose   = "portfolio"
  }
}
