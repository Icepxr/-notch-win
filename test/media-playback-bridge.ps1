# Offline tests of the actual command functions with mocked WinRT/media keys.
# No Windows media session, WinRT async operation or key injection is used.
$ErrorActionPreference = 'Stop'
$isletSource = Join-Path $PSScriptRoot '../src/media/nowplaying.ps1'
$isletTokens = $null
$isletErrors = $null
$isletAst = [System.Management.Automation.Language.Parser]::ParseFile($isletSource, [ref]$isletTokens, [ref]$isletErrors)
if ($isletErrors.Count) { throw 'Bridge script did not parse' }
foreach ($isletName in @('Write-CommandResult', 'Invoke-Action')) {
  $isletFunction = $isletAst.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $isletName }, $true)
  if (-not $isletFunction) { throw ('Missing function ' + $isletName) }
  Invoke-Expression $isletFunction.Extent.Text
}
$script:results = [System.Collections.Generic.List[object]]::new()
$script:keyCount = 0
$script:selectedSource = ''
function Write-Line($value) { $script:results.Add($value) }
function Await($operation, $resultType) { return $operation }
function Send-MediaKey($action) { $script:keyCount++; return $true }
function Get-Manager { return $script:manager }
function Get-Session { return $script:current }
function New-FakeSession($app) {
  $session = [pscustomobject] @{ SourceAppUserModelId = $app; Status = 'Playing'; Accept = $true; Calls = 0 }
  $session | Add-Member ScriptMethod TryPauseAsync { $this.Calls++; if ($this.Accept) { $this.Status = 'Paused' }; return $this.Accept }
  $session | Add-Member ScriptMethod TryPlayAsync { $this.Calls++; if ($this.Accept) { $this.Status = 'Playing' }; return $this.Accept }
  $session | Add-Member ScriptMethod GetPlaybackInfo { return [pscustomobject] @{ PlaybackStatus = $this.Status } }
  return $session
}
$script:target = New-FakeSession 'Spotify.exe'
$script:other = New-FakeSession 'chrome.exe'
$script:current = $script:other
$script:sessions = @($script:target, $script:other)
$script:manager = [pscustomobject] @{}
$script:manager | Add-Member ScriptMethod GetSessions { return $script:sessions }
$script:manager | Add-Member ScriptMethod GetCurrentSession { return $script:current }
Invoke-Action 'pause' 0 'request-1' 'Spotify.exe'
if ($script:target.Calls -ne 1 -or $script:other.Calls -ne 0 -or $script:results[-1].id -ne 'request-1' -or $script:results[-1].via -ne 'winrt') { throw 'Target routing / correlated acknowledgement failed' }
$script:target.Accept = $false
Invoke-Action 'pause' 0 'request-2' 'Spotify.exe'
if ($script:results[-1].via -ne 'unchanged' -or $script:keyCount -ne 0) { throw 'An already-paused target must not receive a toggle key' }
$script:target.Status = 'Stopped'
Invoke-Action 'pause' 0 'request-stopped' 'Spotify.exe'
if ($script:results[-1].via -ne 'unchanged' -or $script:keyCount -ne 0) { throw 'Pause must not resume an already-stopped player' }
$script:target.Status = 'Paused'
Invoke-Action 'play' 0 'request-3' 'Spotify.exe'
if ($script:results[-1].via -ne 'none' -or $script:keyCount -ne 0) { throw 'Fallback must not control another current player' }
$script:current = $script:target
Invoke-Action 'play' 0 'request-4' 'Spotify.exe'
if ($script:results[-1].via -ne 'mediakey' -or $script:keyCount -ne 1) { throw 'Current-player fallback failed' }
$script:sessions = @($script:other); $script:current = $script:other
Invoke-Action 'pause' 0 'request-5' 'Spotify.exe'
if ($script:results[-1].via -ne 'none' -or $script:keyCount -ne 1) { throw 'A vanished target must not toggle another player' }
Write-Output 'PowerShell playback: original command functions, target routing, ack IDs, idempotency and safe fallback passed'
