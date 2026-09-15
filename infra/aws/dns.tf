# Custom domain. DNS for olus.sh is hosted at Vercel (the registrar), not Route
# 53, so Terraform cannot write the validation records itself. Two applies:
#
#   1. domain_validated = false (default): the certificate is requested and
#      `terraform output vercel_dns_commands` prints the `vercel dns add` lines
#      for the ACM validation CNAMEs and the api cutover. Run them.
#   2. domain_validated = true: Terraform waits for ACM to issue, then attaches
#      the certificate and the alias to CloudFront.
#
# Only api.olus.sh lives here. The apex and www are Vercel's (the Next.js site),
# so this certificate has no www SAN and CloudFront claims no apex alias.
#
# Certificates for CloudFront must live in us-east-1, which is this provider.
locals {
  domain_enabled = var.api_domain != ""
  domain_live    = local.domain_enabled && var.domain_validated
  domain_names   = local.domain_enabled ? [var.api_domain] : []
  # `vercel dns` addresses records by zone plus a name relative to it, and the
  # zone is the apex: api.olus.sh -> zone olus.sh, name "api".
  dns_zone = local.domain_enabled ? join(".", slice(split(".", var.api_domain), 1, length(split(".", var.api_domain)))) : ""
}

resource "aws_acm_certificate" "app" {
  count = local.domain_enabled ? 1 : 0

  domain_name       = var.api_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Only created once the records are in place; apply blocks here until ACM
# reports ISSUED, so a typo in Vercel DNS fails loudly instead of silently.
resource "aws_acm_certificate_validation" "app" {
  count = local.domain_live ? 1 : 0

  certificate_arn = aws_acm_certificate.app[0].arn
  validation_record_fqdns = [
    for o in aws_acm_certificate.app[0].domain_validation_options : o.resource_record_name
  ]
}
