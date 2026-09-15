# The default VPC is free and already has an internet gateway and public
# subnets. A dedicated VPC would add a NAT Gateway ($32/month) for no benefit:
# the box needs plain outbound internet for ECR, the ADS-B feeds and NWS.
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# CloudFront's origin-facing egress ranges. Locking the container ports to this
# prefix list means the instance is not reachable directly, so nobody can bypass
# CloudFront (and its free TLS) by hitting the EIP.
data "aws_ec2_managed_prefix_list" "cloudfront_origin" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "app" {
  name        = "olus-app"
  description = "CloudFront to the Olus API port; no SSH (Session Manager instead)"
  vpc_id      = data.aws_vpc.default.id

  # 8000, not 80: the api container publishes its own port on the host and
  # CloudFront's origin points at it. Nothing listens on 80.
  # ONE rule referencing the prefix list, never a second: the CloudFront prefix
  # list counts as 55 rules against the group's default quota of 60, so another
  # reference fails the apply with RulesPerSecurityGroupLimitExceeded.
  ingress {
    description     = "CloudFront -> api"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront_origin.id]
  }

  # Outbound is open: ECR pulls, SSM, S3 backups, and the live aviation feeds.
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "olus-app" }
}

# Not every default subnet's AZ offers the instance type (use1-az3 lacks
# several Graviton sizes), and a bare sort()[0] can land there and fail the
# apply with "Unsupported". Pick only from AZs that actually sell the type.
data "aws_ec2_instance_type_offerings" "app" {
  filter {
    name   = "instance-type"
    values = [var.instance_type]
  }
  location_type = "availability-zone"
}

data "aws_subnets" "eligible" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "availability-zone"
    values = data.aws_ec2_instance_type_offerings.app.locations
  }
}
