variable "aws_region" {
  description = "Region for everything except the CloudFront edge (which is global)"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "arm64 burstable. t4g.small is $12.26/month and has the 2 GB the OR-Tools solver needs"
  type        = string
  default     = "t4g.small"
}

variable "root_volume_size_gb" {
  description = "gp3 root disk. 20 GB holds the image plus the SQLite state file at $1.60/month"
  type        = number
  default     = 20
}

variable "image_tag" {
  description = "ECR tag the instance pulls at boot. GitHub Actions moves :latest"
  type        = string
  default     = "latest"
}

variable "alert_email" {
  description = "Subscribed to the SNS topic for the two CloudWatch alarms"
  type        = string
  default     = "luong.alois@gmail.com"
}

variable "snapshot_retain_count" {
  description = "Daily EBS snapshots kept. 7 of a 20 GB volume is about $0.50/month"
  type        = number
  default     = 7
}

variable "backup_retention_days" {
  description = "Days before the nightly SQLite copy expires from S3"
  type        = number
  default     = 30
}

variable "log_retention_days" {
  description = "CloudWatch retention. 7 days keeps ingest inside the free tier"
  type        = number
  default     = 7
}

variable "github_repository" {
  description = "Repository allowed to assume the deploy role, owner/name"
  type        = string
  default     = "mizuharaa/olus"
}

variable "create_github_oidc_provider" {
  description = "False if the account-level GitHub OIDC provider already exists (it is a singleton)"
  type        = bool
  default     = true
}

variable "github_oidc_provider_arn" {
  description = "Existing provider ARN, required when create_github_oidc_provider is false"
  type        = string
  default     = ""
}

variable "api_domain" {
  description = "Hostname CloudFront serves the API on. Empty = *.cloudfront.net only. DNS lives at Vercel; see dns.tf"
  type        = string
  default     = "api.olus.sh"
}

# The api CNAME currently points at the Railway deployment
# (0bd8wy4v.up.railway.app). Cutover deletes it by id and re-adds it pointing at
# CloudFront; rollback is the same two commands the other way round.
variable "railway_api_record_id" {
  description = "Vercel DNS record id of the existing api.olus.sh CNAME to Railway"
  type        = string
  default     = "rec_147db4e8cbc7a6f39cec2b19"
}

variable "domain_validated" {
  description = "Set true after the ACM validation CNAMEs exist in Vercel DNS; attaches the certificate and aliases to CloudFront"
  type        = bool
  default     = false
}

variable "docker_compose_version" {
  description = "Compose v2 plugin release pinned so a reboot cannot pull a new major"
  type        = string
  default     = "v2.29.7"
}

check "github_oidc_configuration" {
  assert {
    condition     = var.create_github_oidc_provider || var.github_oidc_provider_arn != ""
    error_message = "github_oidc_provider_arn is required when create_github_oidc_provider is false."
  }
}

