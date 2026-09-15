# Olus on AWS — one EC2 box behind CloudFront. Target ~$19/month.
#
# Replaces infra/terraform/ (ECS + ALB), which costs $23/month for the ALB
# alone. CloudFront's free tier does the TLS termination the ALB was doing.
#
# State is local: one operator, one laptop, no concurrent applies. To move it
# to S3 later, add a bucket by hand and uncomment:
#
#   backend "s3" {
#     bucket       = "olus-tfstate-<account_id>"
#     key          = "aws/terraform.tfstate"
#     region       = "us-east-1"
#     encrypt      = true
#     use_lockfile = true
#   }

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  # Every resource is tagged here so the panic/nuke scripts and the cost
  # explorer filter can find the whole stack by Project=olus.
  default_tags {
    tags = {
      Project     = "olus"
      ManagedBy   = "terraform"
      Environment = "prod"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  # Browser-facing origin. CloudFront's default certificate covers this.
  cloudfront_url = "https://${aws_cloudfront_distribution.app.domain_name}"
  # Baked into the instance at first boot, so it is the final hostname from day
  # one rather than something to re-apply.
  app_url = local.domain_enabled ? "https://${var.api_domain}" : local.cloudfront_url
  # The browser talks to this API from the Vercel site; the cloudfront.net URL
  # is kept so the API is testable before and after the domain is live.
  cors_origins = "https://olus.sh,https://www.olus.sh,${local.cloudfront_url}"
}

# A monthly budget named "olus-monthly" ($30, with the IAM kill switch from
# bootstrap-iam.ps1 attached) already exists and was created by hand. It is
# deliberately NOT managed here: Terraform destroying the budget would remove
# the guardrail at exactly the moment you are tearing things down. There is no
# aws_budgets_budget data source, so this comment is the reference.
