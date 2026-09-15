# Stop the Olus instance without destroying anything. Use when the bill or the
# nerves need it; -Resume brings it back.
#
#   powershell -ExecutionPolicy Bypass -File infra/aws/panic.ps1
#   powershell -ExecutionPolicy Bypass -File infra/aws/panic.ps1 -Resume

param(
  [string]$Profile = 'olus-admin',
  [string]$Region  = 'us-east-1',
  [switch]$Resume
)

$ErrorActionPreference = 'Stop'

$wanted = if ($Resume) { 'stopped' } else { 'running' }
$json = aws ec2 describe-instances `
  --profile $Profile --region $Region `
  --filters "Name=tag:Project,Values=olus" "Name=instance-state-name,Values=$wanted" `
  --query 'Reservations[].Instances[].{Id:InstanceId,Type:InstanceType,State:State.Name,Ip:PublicIpAddress}' `
  --output json
$instances = $json | ConvertFrom-Json

if (-not $instances -or $instances.Count -eq 0) {
  Write-Host "No olus instances in state '$wanted'. Nothing to do."
  exit 0
}

$instances | Format-Table -AutoSize
$ids = @($instances | ForEach-Object { $_.Id })

if ($Resume) {
  aws ec2 start-instances --profile $Profile --region $Region --instance-ids $ids | Out-Null
  Write-Host ''
  Write-Host "Started: $($ids -join ', ')"
  Write-Host 'The Elastic IP stays associated across a stop/start, so CloudFront keeps'
  Write-Host 'pointing at the right origin. No terraform apply needed.'
  Write-Host 'olus.service brings the api container up; allow ~90s before /health is 200.'
} else {
  aws ec2 stop-instances --profile $Profile --region $Region --instance-ids $ids | Out-Null
  Write-Host ''
  Write-Host "Stopped: $($ids -join ', ')"
  Write-Host 'Residual monthly cost while stopped, roughly $5:'
  Write-Host '  gp3 20 GB root volume      $1.60'
  Write-Host '  Elastic IP (now idle)      $3.65'
  Write-Host '  snapshots + ECR + S3       <$1.00'
  Write-Host 'Compute stops billing immediately. Resume with:  panic.ps1 -Resume'
}
