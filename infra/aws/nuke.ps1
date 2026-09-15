# Destroy the whole Olus stack, then sweep for anything Terraform did not own.
# Requires typing NUKE. There is no undo; the SQLite state file and every backup
# in the bucket go with it.
#
#   powershell -ExecutionPolicy Bypass -File infra/aws/nuke.ps1

param(
  [string]$Profile = 'olus-admin',
  [string]$Region  = 'us-east-1'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
  throw 'terraform is not on PATH. See infra/aws/README.md.'
}

Write-Host 'This destroys the Olus AWS stack: instance, EIP, CloudFront, ECR images,'
Write-Host 'the backup bucket AND its contents, snapshots, log group, SNS topic.'
Write-Host ''
if ((Read-Host 'Type NUKE to proceed') -cne 'NUKE') { Write-Host 'Aborted.'; exit 1 }

$account = aws sts get-caller-identity --profile $Profile --query Account --output text
$bucket  = "olus-backups-$account"

# The bucket has force_destroy = true, so terraform can delete it non-empty.
# Emptying first anyway makes the destroy faster and keeps the failure mode
# obvious if force_destroy is ever removed.
Write-Host "Emptying s3://$bucket ..."
aws s3 rm "s3://$bucket" --recursive --profile $Profile --region $Region
if ($LASTEXITCODE -ne 0) { Write-Host '  (bucket absent or already empty)' }

Push-Location $PSScriptRoot
try {
  $env:AWS_PROFILE = $Profile
  terraform destroy -auto-approve
  if ($LASTEXITCODE -ne 0) { Write-Host 'terraform destroy reported errors; the sweep below shows what is left.' }
} finally {
  Pop-Location
}

Write-Host ''
Write-Host "=== Sweep: anything still tagged Project=olus in $Region ==="
Write-Host 'Nothing below is deleted automatically. The delete command is printed.'

function Show-Strays($Label, $Items, $CmdFormat) {
  if (-not $Items -or @($Items).Count -eq 0) { Write-Host "  ${Label}: clean"; return }
  Write-Host "  ${Label}: $(@($Items).Count) left"
  foreach ($i in @($Items)) { Write-Host ('    ' + ($CmdFormat -f $i)) }
}

$p = @('--profile', $Profile, '--region', $Region)
$suffix = "--region $Region --profile $Profile"

$ec2 = (aws ec2 describe-instances @p --filters 'Name=tag:Project,Values=olus' 'Name=instance-state-name,Values=pending,running,stopping,stopped' --query 'Reservations[].Instances[].InstanceId' --output json | ConvertFrom-Json)
Show-Strays 'instances' $ec2 "aws ec2 terminate-instances --instance-ids {0} $suffix"

$vols = (aws ec2 describe-volumes @p --filters 'Name=tag:Project,Values=olus' --query 'Volumes[].VolumeId' --output json | ConvertFrom-Json)
Show-Strays 'volumes' $vols "aws ec2 delete-volume --volume-id {0} $suffix"

$snaps = (aws ec2 describe-snapshots @p --owner-ids self --filters 'Name=tag:Project,Values=olus' --query 'Snapshots[].SnapshotId' --output json | ConvertFrom-Json)
Show-Strays 'snapshots' $snaps "aws ec2 delete-snapshot --snapshot-id {0} $suffix"

$eips = (aws ec2 describe-addresses @p --filters 'Name=tag:Project,Values=olus' --query 'Addresses[].AllocationId' --output json | ConvertFrom-Json)
Show-Strays 'elastic IPs' $eips "aws ec2 release-address --allocation-id {0} $suffix"

# CloudFront is global and list-distributions has no tag filter, so match the comment.
$dists = (aws cloudfront list-distributions --profile $Profile --query "DistributionList.Items[?Comment=='olus'].Id" --output json | ConvertFrom-Json)
Show-Strays 'cloudfront distributions' $dists "aws cloudfront get-distribution-config --id {0} --profile $Profile   # set Enabled=false, update, then delete-distribution"

$repos = (aws ecr describe-repositories @p --query "repositories[?starts_with(repositoryName,'olus')].repositoryName" --output json | ConvertFrom-Json)
Show-Strays 'ecr repositories' $repos "aws ecr delete-repository --repository-name {0} --force $suffix"

$buckets = (aws s3api list-buckets --profile $Profile --query "Buckets[?starts_with(Name,'olus-')].Name" --output json | ConvertFrom-Json)
Show-Strays 's3 buckets' $buckets "aws s3 rb s3://{0} --force --profile $Profile"

$groups = (aws logs describe-log-groups @p --log-group-name-prefix '/olus' --query 'logGroups[].logGroupName' --output json | ConvertFrom-Json)
Show-Strays 'log groups' $groups "aws logs delete-log-group --log-group-name {0} $suffix"

$topics = (aws sns list-topics @p --query "Topics[?contains(TopicArn,'olus')].TopicArn" --output json | ConvertFrom-Json)
Show-Strays 'sns topics' $topics "aws sns delete-topic --topic-arn {0} $suffix"

Write-Host ''
Write-Host 'The budget olus-monthly, the olus-admin IAM user and the killswitch policy'
Write-Host 'from bootstrap-iam.ps1 are NOT touched, on purpose: they are the guardrails and'
Write-Host 'should outlive the stack.'
