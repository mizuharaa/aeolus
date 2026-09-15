# Read-only. Where is the stack, is it up, what has it cost this month.
#
#   powershell -ExecutionPolicy Bypass -File infra/aws/status.ps1

param(
  [string]$Profile = 'olus-admin',
  [string]$Region  = 'us-east-1',
  [string]$ApiUrl  = 'https://api.olus.sh'
)

$ErrorActionPreference = 'Continue'
$p = @('--profile', $Profile, '--region', $Region)

Write-Host '--- instance ---'
$inst = (aws ec2 describe-instances @p `
  --filters 'Name=tag:Project,Values=olus' 'Name=instance-state-name,Values=pending,running,stopping,stopped' `
  --query 'Reservations[].Instances[].{Id:InstanceId,Type:InstanceType,State:State.Name,Ip:PublicIpAddress,Launched:LaunchTime}' `
  --output json | ConvertFrom-Json)
if ($inst) { $inst | Format-Table -AutoSize } else { Write-Host 'none (destroyed, or terminated)' }

Write-Host '--- elastic ip ---'
$eip = (aws ec2 describe-addresses @p --filters 'Name=tag:Project,Values=olus' `
  --query 'Addresses[].{Ip:PublicIp,AssociatedTo:InstanceId}' --output json | ConvertFrom-Json)
if ($eip) { $eip | Format-Table -AutoSize } else { Write-Host 'none' }

Write-Host '--- cloudfront ---'
$domain = (aws cloudfront list-distributions --profile $Profile `
  --query "DistributionList.Items[?Comment=='olus'].DomainName | [0]" --output text)
if ([string]::IsNullOrWhiteSpace($domain) -or $domain -eq 'None') {
  Write-Host 'no olus distribution'
} else {
  Write-Host "https://$domain"
  Write-Host '--- health ---'
  # The public API hostname, not the distribution name: this is what the Vercel
  # site calls, so a 200 also proves the api CNAME still points here.
  try {
    $r = Invoke-WebRequest -Uri "$ApiUrl/health" -TimeoutSec 20 -UseBasicParsing
    Write-Host "HTTP $($r.StatusCode)  $($r.Content)"
  } catch {
    Write-Host "unreachable: $($_.Exception.Message)"
    Write-Host '(a stopped instance, the api container still coming up, or DNS not cut over yet)'
  }
}

Write-Host '--- month-to-date cost ---'
$start = (Get-Date -Day 1).ToString('yyyy-MM-dd')
$end   = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')
$cost = (aws ce get-cost-and-usage --profile $Profile `
  --time-period "Start=$start,End=$end" --granularity MONTHLY --metrics UnblendedCost `
  --query 'ResultsByTime[0].Total.UnblendedCost.Amount' --output text)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($cost)) {
  Write-Host 'Cost Explorer returned nothing. It has to be enabled once in the console'
  Write-Host '(Billing > Cost Explorer) and then takes up to 24h to backfill.'
} else {
  Write-Host ('$' + [math]::Round([double]$cost, 2) + ' account-wide since ' + $start)
}
