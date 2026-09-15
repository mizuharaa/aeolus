resource "aws_s3_bucket" "backups" {
  bucket = "olus-backups-${data.aws_caller_identity.current.account_id}"

  # So `terraform destroy` and nuke.ps1 do not stall on leftover backups.
  force_destroy = true
}

# No versioning resource: the objects are date-stamped nightly copies, so
# versions would only duplicate storage. Lifecycle expiry is the retention.
resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# SSE-S3, not KMS: a customer key adds $1/month plus per-request charges for a
# 200 KB SQLite file.
resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "expire"
    status = "Enabled"

    filter {}

    expiration {
      days = var.backup_retention_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# ECR, not Docker Hub: the instance pulls over the AWS network with no rate
# limit and no registry credentials to rotate. Storage is $0.10/GB/month.
resource "aws_ecr_repository" "api" {
  name                 = "olus-api"
  image_tag_mutability = "MUTABLE" # :latest has to move

  image_scanning_configuration {
    scan_on_push = true
  }
}

# Keep 5 images. Without this, every deploy adds ~200 MB forever.
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "keep last 5"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}
