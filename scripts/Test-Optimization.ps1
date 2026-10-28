param([string]$DotNetExe = 'dotnet', [switch]$NoRestore)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $DotNetExe) { $DotNetExe = (Resolve-Path -LiteralPath $DotNetExe).Path }
else { $DotNetExe = (Get-Command $DotNetExe -ErrorAction Stop).Source }

$notchSuites = @(
    'OptimizationRegressionTests','SecondPassOptimizationTests','HotPathRegressionTests',
    'LocalSendWindowTests.Pending','ElasticSliderPresentationTests','AgentDashboardTests',
    'AgentMonitorTests','LocalSendTests','ProgressEngineTests','NotchRevealMotionTests',
    'DockDrag','DockGestureTests','SettingsHitTargetTests','TopPomodoroTests',
    'PomodoroControllerTests','TimerColumnTests','SideDockWindowTests','NotchScrollChromeTests',
    'Countdown','MainWindowTimerInteractionTests','MediaColumnLayoutTests',
    'ClipboardTrayRegressionTests','MainWindowGesturePresentationTests','HoverDetectionServiceTests',
    'MainWindowThumbnailPresentationTests','MainWindowMorphHandoffTests','MainWindowGlassPresentationTests',
    'StutterRegressionTests','NotchTransitionCoordinatorTests','TransitionRegressionTests',
    'AudioViewTransitionTests','AgentTransitionTests','LifetimeAuditRegressionTests',
    'ServiceOptimizationTests','RuntimeLogTests','ProgressViewModelPerformanceTests',
    'SystemMonitorPresenterLifetimeTests','AudioMixerServiceLifetimeTests',
    'WindowTitleScannerLifetimeTests','PrivacyIndicatorLifetimeTests'
)
$notchFilter = ($notchSuites | ForEach-Object { 'FullyQualifiedName~' + $_ }) -join '|'
$notchReportName = 'optimization-' + [guid]::NewGuid().ToString('N') + '.trx'
$notchRoot = Split-Path -Parent $PSScriptRoot
$notchResults = Join-Path $notchRoot 'artifacts\optimization-tests'
$notchArguments = @('test','Tests/VNotch.Tests.csproj','-c','Release','--filter',$notchFilter,
    '--logger',('trx;LogFileName=' + $notchReportName),'--results-directory',$notchResults,'-v','minimal')
if ($NoRestore) { $notchArguments += '--no-restore' }
Push-Location $notchRoot
try {
    & $DotNetExe @notchArguments
    if ($LASTEXITCODE -ne 0) { throw 'Optimization regression tests failed.' }
    $notchReport = Join-Path $notchResults $notchReportName
    if (!(Test-Path -LiteralPath $notchReport)) { throw 'No test report was produced.' }
    [xml]$notchTrx = Get-Content -LiteralPath $notchReport -Raw
    $notchCounts = $notchTrx.TestRun.ResultSummary.Counters
    if ([int]$notchCounts.executed -lt 406 -or [int]$notchCounts.failed -ne 0 -or [int]$notchCounts.passed -ne [int]$notchCounts.executed) {
        throw 'Some optimization regressions were missing, skipped or failed.'
    }
    Write-Output "$($notchCounts.passed) optimization regressions passed. Full-suite findings are documented separately."
}
finally { Pop-Location }
