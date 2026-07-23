output "application_url" {
  description = "Public Aeolus URL"
  value       = local.app_origin
}

output "alb_dns_name" {
  description = "ALB hostname used before custom DNS is configured"
  value       = aws_lb.app.dns_name
}

output "api_ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "web_ecr_repository_url" {
  value = aws_ecr_repository.web.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.app.name
}

output "github_deploy_role_arn" {
  description = "Set this as the GitHub Actions AWS_ROLE_ARN repository secret"
  value       = aws_iam_role.github_deploy.arn
}

output "estimated_monthly_budget_usd" {
  value = var.monthly_budget_usd
}
