# 7-day retention: container logs at this volume stay inside the 5 GB free
# ingest tier, and longer retention is what turns CloudWatch into a real bill.
resource "aws_cloudwatch_log_group" "app" {
  name              = "/olus/app"
  retention_in_days = var.log_retention_days
}

resource "aws_sns_topic" "alerts" {
  name = "olus-alerts"
}

# Terraform creates this as "pending confirmation"; click the link in the email
# once or the alarms fire into nothing.
resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# The box is dead or the hypervisor lost it.
resource "aws_cloudwatch_metric_alarm" "status_check" {
  alarm_name          = "olus-status-check-failed"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  dimensions          = { InstanceId = aws_instance.app.id }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  alarm_description   = "olus-app failed an EC2 status check twice in a row"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

# cpu_credits = standard means a credit-starved instance gets throttled, not
# billed. This alarm is the warning that the app is about to feel very slow.
resource "aws_cloudwatch_metric_alarm" "cpu_credits" {
  alarm_name          = "olus-cpu-credits-low"
  namespace           = "AWS/EC2"
  metric_name         = "CPUCreditBalance"
  dimensions          = { InstanceId = aws_instance.app.id }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 20
  comparison_operator = "LessThanThreshold"
  alarm_description   = "olus-app is running out of CPU credits; the solver will crawl"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
}
