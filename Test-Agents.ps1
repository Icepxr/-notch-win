param([string]$DotNetExe = 'dotnet')
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $DotNetExe) { $DotNetExe = (Resolve-Path -LiteralPath $DotNetExe).Path }
else { $DotNetExe = (Get-Command $DotNetExe -ErrorAction Stop).Source }
Push-Location $PSScriptRoot
try {
 foreach ($suite in @(
  @{Project='Tests/Agents.Core/Agent.Core.Tests.csproj';Name='agent-core';Minimum=14},
  @{Project='Tests/Agents.UI/Agent.UI.Tests.csproj';Name='agent-ui';Minimum=8}
 )) {
  $directory=Join-Path $PSScriptRoot ('artifacts/agent-tests/'+$suite.Name)
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
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
}
finally { Pop-Location }
