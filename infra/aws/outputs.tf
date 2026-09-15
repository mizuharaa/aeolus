output "instance_id" {
  description = "olus-app EC2 instance"
  value       = aws_instance.app.id
}

output "eip" {
  description = "Stable public IP; CloudFront's origin hostname is derived from it"
  value       = aws_eip.app.public_ip
}

output "api_url" {
  description = "Where the API answers once DNS is live"
  value       = local.app_url
}

output "cloudfront_domain" {
  description = "Distribution hostname; the target of the api CNAME"
  value       = aws_cloudfront_distribution.app.domain_name
}

output "ecr_api_url" {
  value = aws_ecr_repository.api.repository_url
}

output "backup_bucket" {
  value = aws_s3_bucket.backups.bucket
}

output "github_deploy_role_arn" {
  description = "Set as the AWS_ROLE_ARN repository secret"
  value       = aws_iam_role.github_deploy.arn
}

output "sns_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

output "ssm_session_command" {
  description = "Shell on the box; there is no SSH key"
  value       = "aws ssm start-session --target ${aws_instance.app.id}"
}

output "acm_validation_records" {
  description = "CNAMEs ACM needs to see in DNS before it issues the certificate"
  value = local.domain_enabled ? [
    for o in aws_acm_certificate.app[0].domain_validation_options : {
      name  = o.resource_record_name
      type  = o.resource_record_type
      value = o.resource_record_value
    }
  ] : []
}

# Vercel hosts the olus.sh zone. `vercel dns add` takes the record name relative
# to the zone, so the ACM names have the trailing ".olus.sh." stripped.
#
# The CAA records for the four Amazon CAs are already in the zone (added by
# hand), so they are not reprinted here. The `rm` line removes the api CNAME
# that points at Railway; running it and the `add` after it IS the cutover, and
# swapping them back (add api CNAME 0bd8wy4v.up.railway.app) is the rollback.
output "vercel_dns_commands" {
  description = "Run after the first apply, then set domain_validated = true and apply again"
  value = local.domain_enabled ? join("\n", concat(
    [
      for o in aws_acm_certificate.app[0].domain_validation_options :
      "vercel dns add ${local.dns_zone} ${trimsuffix(trimsuffix(o.resource_record_name, "."), ".${local.dns_zone}")} CNAME ${trimsuffix(o.resource_record_value, ".")}"
    ],
    [
      "vercel dns rm ${var.railway_api_record_id}",
      "vercel dns add ${local.dns_zone} ${trimsuffix(var.api_domain, ".${local.dns_zone}")} CNAME ${aws_cloudfront_distribution.app.domain_name}",
    ]
  )) : ""
}
