param([string]$DotNetExe = 'dotnet')
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $DotNetExe) { $DotNetExe = (Resolve-Path -LiteralPath $DotNetExe).Path }
else { $DotNetExe = (Get-Command $DotNetExe -ErrorAction Stop).Source }
Push-Location $PSScriptRoot
try {
 foreach ($suite in @(
  @{Project='Tests/Dock/Dock.Tests.csproj';Name='dock';Minimum=67}
 )) {
  $directory=Join-Path $PSScriptRoot ('artifacts/dock-tests/'+$suite.Name)
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  # A run that discovers nothing can still exit 0, so require the report itself.
  $reportName='run-'+[guid]::NewGuid().ToString('N')+'.trx'
  & $DotNetExe test $suite.Project --logger "trx;LogFileName=$reportName" --results-directory $directory
  if ($LASTEXITCODE -ne 0) { throw "Tests failed: $($suite.Name)" }
  $report=Join-Path $directory $reportName
  if (!(Test-Path -LiteralPath $report)) { throw 'Test runner produced no report.' }
  [xml]$trx=Get-Content -LiteralPath $report -Raw
  $counts=$trx.TestRun.ResultSummary.Counters
  if ([int]$counts.executed -lt $suite.Minimum -or [int]$counts.passed -ne [int]$counts.executed -or [int]$counts.failed -ne 0) { throw 'Tests were skipped, blocked or failed.' }
  Write-Output "$($suite.Name): $($counts.passed) passed."
 }
 Write-Output 'This suite covers dock placement only. It does not certify the complete application.'
}
finally { Pop-Location }
