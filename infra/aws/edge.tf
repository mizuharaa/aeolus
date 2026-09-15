# CloudFront is the reason this stack is $19 and not $42: it terminates TLS on a
# free *.cloudfront.net certificate, which is the only job the $23/month ALB in
# infra/terraform was doing. Request volume for a portfolio app stays inside the
# perpetual free tier (1 TB out, 10M requests).
#
# One origin only: the Next.js site is on Vercel, so everything that reaches
# this distribution is an API call.

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

# AllViewer forwards every header, cookie and query string, including the
# Sec-WebSocket-* upgrade headers. That, plus a caching-disabled policy, is what
# makes /ws/* work as a real WebSocket through CloudFront rather than a 400.
data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

resource "aws_cloudfront_distribution" "app" {
  enabled         = true
  comment         = "olus"
  is_ipv6_enabled = true
  http_version    = "http2and3"

  # PriceClass_100 = North America and Europe edges only; the other classes cost
  # more per request for traffic this app does not have.
  price_class = "PriceClass_100"

  # Origin is the Elastic IP's DNS name, not the instance's, so a stop/start
  # does not change it. CloudFront cannot take a bare IP as an origin.
  origin {
    origin_id   = "api"
    domain_name = aws_eip.app.public_dns

    custom_origin_config {
      http_port                = 8000
      https_port               = 443 # unused, http-only below, but required
      origin_protocol_policy   = "http-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 60 # > the 30s WS heartbeat
      origin_keepalive_timeout = 60
    }
  }

  # Nothing the API returns is cacheable at the edge, so one uncached behaviour
  # covers /health, /api/v1/* and everything else.
  default_cache_behavior {
    target_origin_id         = "api"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  ordered_cache_behavior {
    path_pattern             = "/ws/*"
    target_origin_id         = "api"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = false # compression breaks the upgrade handshake
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  aliases = local.domain_live ? local.domain_names : []

  # Default certificate until the ACM certificate is issued (dns.tf), then the
  # real one. Two blocks because the provider rejects a mix of the two.
  dynamic "viewer_certificate" {
    for_each = local.domain_live ? [] : [1]
    content {
      cloudfront_default_certificate = true
    }
  }

  dynamic "viewer_certificate" {
    for_each = local.domain_live ? [1] : []
    content {
      acm_certificate_arn      = aws_acm_certificate_validation.app[0].certificate_arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = { Name = "olus" }
}
