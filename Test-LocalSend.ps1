param([string]$DotNetExe = 'dotnet')
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $DotNetExe) { $DotNetExe = (Resolve-Path -LiteralPath $DotNetExe).Path }
else { $DotNetExe = (Get-Command $DotNetExe -ErrorAction Stop).Source }
Push-Location $PSScriptRoot
try {
    foreach ($suite in @(
        @{ Project = 'Tests/LocalSend.Core/LocalSend.Core.Tests.csproj'; Folder = 'core'; Minimum = 24 },
        @{ Project = 'Tests/LocalSend.UI/LocalSend.UI.Tests.csproj'; Folder = 'ui'; Minimum = 2 }
    )) {
        $results = Join-Path $PSScriptRoot ('artifacts/localsend-tests/' + $suite.Folder)
        New-Item -ItemType Directory -Path $results -Force | Out-Null
        # Some adapters return exit 0 when policy prevents discovering any tests.
        # Require a new TRX with the expected tests, not just a successful process.
        $reportName = 'run-' + [guid]::NewGuid().ToString('N') + '.trx'
        & $DotNetExe test $suite.Project --logger "trx;LogFileName=$reportName" --results-directory $results
        if ($LASTEXITCODE -ne 0) { throw "Test process failed for $($suite.Project)" }
        $report = Join-Path $results $reportName
        if (!(Test-Path -LiteralPath $report)) { throw 'No test report was produced.' }
        [xml]$trx = Get-Content -LiteralPath $report -Raw
        $counters = $trx.TestRun.ResultSummary.Counters
        if ([int]$counters.executed -lt $suite.Minimum -or [int]$counters.passed -ne [int]$counters.executed -or [int]$counters.failed -ne 0) {
            throw "Incomplete or failed tests in $report"
        }
        Write-Output "$($suite.Folder): $($counters.passed) tests passed."
    }
    Write-Output 'These suites exercise only the new feature. They do not certify the complete application.'
}
finally { Pop-Location }
