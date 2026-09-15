# Olus AWS bootstrap: run ONCE from a root `aws login` session.
# Creates the admin IAM user this machine will use, the budget kill switch,
# and the role AWS Budgets uses to pull it. Idempotent: safe to re-run.
#
#   powershell -ExecutionPolicy Bypass -File infra/aws/bootstrap-iam.ps1
#
# After it finishes, run `aws logout` so the root session is gone.

# Windows PowerShell 5.1 treats native stderr as a terminating error under
# 'Stop', and `aws ... get-*` writes "not found" to stderr for things that do
# not exist yet. So: Continue, and check exit codes by hand.
$ErrorActionPreference = 'Continue'

function Test-Aws {
  # True when the aws command exits 0. Output is discarded.
  $null = & aws @args 2>&1
  return ($LASTEXITCODE -eq 0)
}
function Invoke-Aws {
  # Runs aws, prints its stderr, and stops the script on a non-zero exit.
  $out = & aws @args 2>&1
  if ($LASTEXITCODE -ne 0) { $out | Out-String | Write-Host; throw "aws $($args[0..1] -join ' ') failed" }
  return $out
}

$account = (aws sts get-caller-identity --query Account --output text)
$arn     = (aws sts get-caller-identity --query Arn --output text)
Write-Host "Signed in as $arn"
if ($arn -notmatch ':root$') { throw 'Run this from the root aws login session; it creates the first IAM user.' }

$tmp = $env:TEMP

# 1. Admin user for the CLI. AdministratorAccess is deliberate: Terraform needs
#    to create IAM roles. The user has no console password, and API access is
#    bounded by the budget kill switch below.
if (-not (Test-Aws iam get-user --user-name olus-admin)) {
  Invoke-Aws iam create-user --user-name olus-admin --tags 'Key=Project,Value=olus' | Out-Null
  Write-Host 'created user olus-admin'
} else { Write-Host 'user olus-admin exists' }
Invoke-Aws iam attach-user-policy --user-name olus-admin --policy-arn arn:aws:iam::aws:policy/AdministratorAccess | Out-Null

$existing = (Invoke-Aws iam list-access-keys --user-name olus-admin --query 'AccessKeyMetadata[].AccessKeyId' --output text)
if ([string]::IsNullOrWhiteSpace($existing)) {
  $k = (Invoke-Aws iam create-access-key --user-name olus-admin --output json) | Out-String | ConvertFrom-Json
  aws configure set aws_access_key_id     $k.AccessKey.AccessKeyId     --profile olus-admin
  aws configure set aws_secret_access_key $k.AccessKey.SecretAccessKey --profile olus-admin
  aws configure set region us-east-1 --profile olus-admin
  aws configure set output json      --profile olus-admin
  Write-Host "stored access key $($k.AccessKey.AccessKeyId) as CLI profile olus-admin"
} else {
  Write-Host "olus-admin already has key(s): $existing (profile not rewritten)"
}

# 2. Kill-switch policy: what the budget attaches at $30. Denies anything that
#    starts new spend. Running things are stopped by the SSM action added after
#    the instance exists (see README.md, "Budget stop action").
$deny = '{"Version":"2012-10-17","Statement":[{"Sid":"BudgetKillSwitch","Effect":"Deny","Action":["ec2:RunInstances","ec2:StartInstances","ec2:CreateVolume","ec2:AllocateAddress","cloudfront:CreateDistribution","ecr:PutImage","elasticloadbalancing:*","rds:*","ecs:RunTask","ecs:UpdateService","lambda:CreateFunction"],"Resource":"*"}]}'
Set-Content -Path "$tmp\olus-deny.json" -Value $deny -Encoding ascii
$denyArn = "arn:aws:iam::${account}:policy/olus-budget-killswitch"
if (-not (Test-Aws iam get-policy --policy-arn $denyArn)) {
  Invoke-Aws iam create-policy --policy-name olus-budget-killswitch --policy-document "file://$tmp/olus-deny.json" --tags 'Key=Project,Value=olus' | Out-Null
  Write-Host 'created policy olus-budget-killswitch'
} else { Write-Host 'policy olus-budget-killswitch exists' }

# 3. Role that AWS Budgets assumes to apply the policy and stop instances.
$trust = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"budgets.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
Set-Content -Path "$tmp\olus-trust.json" -Value $trust -Encoding ascii
if (-not (Test-Aws iam get-role --role-name olus-budgets-action)) {
  Invoke-Aws iam create-role --role-name olus-budgets-action --assume-role-policy-document "file://$tmp/olus-trust.json" --tags 'Key=Project,Value=olus' | Out-Null
  Write-Host 'created role olus-budgets-action'
} else { Write-Host 'role olus-budgets-action exists' }
$perm = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["iam:AttachUserPolicy","iam:AttachRolePolicy","iam:DetachUserPolicy","iam:DetachRolePolicy","ec2:StopInstances","ec2:DescribeInstances","ssm:StartAutomationExecution","ssm:GetAutomationExecution"],"Resource":"*"}]}'
Set-Content -Path "$tmp\olus-perm.json" -Value $perm -Encoding ascii
Invoke-Aws iam put-role-policy --role-name olus-budgets-action --policy-name budgets-actions --policy-document "file://$tmp/olus-perm.json" | Out-Null

# 4. Budget action: at 100% of the $30 budget, attach the deny policy to
#    olus-admin automatically. IAM is eventually consistent, so the new role
#    may take a few seconds to become assumable by Budgets; retry briefly.
$actions = (Invoke-Aws budgets describe-budget-actions-for-budget --account-id $account --budget-name olus-monthly --query 'Actions[].ActionId' --output text)
if ([string]::IsNullOrWhiteSpace($actions)) {
  $ok = $false
  foreach ($try in 1..6) {
    $null = & aws budgets create-budget-action `
      --account-id $account --budget-name olus-monthly `
      --notification-type ACTUAL --action-type APPLY_IAM_POLICY `
      --action-threshold 'ActionThresholdValue=100,ActionThresholdType=PERCENTAGE' `
      --definition "IamActionDefinition={PolicyArn=$denyArn,Users=[olus-admin]}" `
      --execution-role-arn "arn:aws:iam::${account}:role/olus-budgets-action" `
      --approval-model AUTOMATIC `
      --subscribers 'SubscriptionType=EMAIL,Address=luong.alois@gmail.com' 2>&1
    if ($LASTEXITCODE -eq 0) { $ok = $true; break }
    Start-Sleep -Seconds 10
  }
  if ($ok) { Write-Host 'created budget action: deny policy at $30' } else { Write-Host 'WARNING: budget action not created; re-run this script in a minute' }
} else { Write-Host "budget action exists: $actions" }

Write-Host ''
Write-Host 'Verify (should print the olus-admin ARN):'
aws sts get-caller-identity --profile olus-admin --query Arn --output text
Write-Host ''
Write-Host 'Now run:  aws logout   (ends the root session)'
