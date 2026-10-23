# Offline replay of the production policy. No WinRT/media key calls.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../src/media/session-policy.ps1')
$script:checks = 0
function Check($value, $label) { if (-not $value) { throw $label }; $script:checks++ }
function Candidate($id, $playing = $true, $os = $false, $music = $false, $fresh = $false) {
  return [pscustomobject] @{ Id = $id; Playing = $playing; IsCurrent = $os; IsMusic = $music; FreshTimeline = $fresh }
}
$spotify = Candidate 'Spotify.exe' $true $true $true
$browser = Candidate 'chrome.exe' $false
$state = New-SelectionState
Check ((Select-MediaCandidate @($spotify, $browser) $state '' 10000).Id -eq 'Spotify.exe') 'Startup picks the playing OS source'
$browser.Playing = $true
Check ((Select-MediaCandidate @($spotify, $browser) $state '' 10900).Id -eq 'chrome.exe') 'Starting another player wins over stale OS focus'
$spotify.IsCurrent = $false
foreach ($now in @(11800, 12700, 13600, 14500)) {
  Check ((Select-MediaCandidate @($browser, $spotify) $state '' $now).Id -eq 'chrome.exe') 'Enumeration order does not change selection'
}
$spotify.IsCurrent = $true
Check ((Select-MediaCandidate @($spotify, $browser) $state '' 75000).Id -eq 'chrome.exe') 'Recent-start selection stays stable after its temporary bonus expires'
$browser.Playing = $false
Check ((Select-MediaCandidate @($browser, $spotify) $state '' 15000).Id -eq 'Spotify.exe') 'Paused current yields immediately to playing source'
Check ((Select-MediaCandidate @($browser, $spotify) $state 'chrome.exe' 16000).Id -eq 'chrome.exe') 'Pin keeps paused application'
Check ($null -eq (Select-MediaCandidate @($spotify) $state 'chrome.exe' 17000)) 'Missing pin never falls back to another player'
Check ((Select-MediaCandidate @($spotify, $browser) $state 'chrome.exe' 18000).Id -eq 'chrome.exe') 'Returning pinned application is restored'
Check ((Select-MediaCandidate @($spotify, $browser) $state '' 19000).Id -eq 'Spotify.exe') 'Automatic selection can release a pin'
Check ($null -eq (Select-MediaCandidate @() $state '' 20000)) 'No sessions clears the source'
Check ($state.History.Count -eq 0) 'Closed apps are evicted from history'

$state = New-SelectionState
$browser.Playing = $true
$spotify.IsCurrent = $false
Select-MediaCandidate @($browser) $state '' 30000 | Out-Null
# An unproven contender must wait; normal source holds for 1.5 seconds.
$state.History['Spotify.exe'] = @{ Playing = $true; Started = 0L }
Check ((Select-MediaCandidate @($browser, $spotify) $state '' 30100).Id -eq 'chrome.exe') 'Unproven score changes do not steal a playing session'
Check ((Select-MediaCandidate @($browser, $spotify) $state '' 31599).Id -eq 'chrome.exe') 'Hysteresis does not depend on polling frequency'
Check ((Select-MediaCandidate @($browser, $spotify) $state '' 31600).Id -eq 'Spotify.exe') 'Stable contender eventually wins after hold'
$browser.IsCurrent = $true
Check ((Select-MediaCandidate @($browser, $spotify) $state '' 32000).Id -eq 'chrome.exe') 'Explicit OS-current evidence bypasses the hold'
Check ((Get-RecoveryPollMs 0 900 $true) -eq 350) 'Fast metadata probe'
Check ((Get-RecoveryPollMs 2000 900 $true) -eq 900) 'Recovery backs off without degrading normal responsiveness'
Check ((Get-RecoveryPollMs 8000 900 $true) -eq 900) 'Long gaps do not spin at fast polling'
Check ((Get-RecoveryPollMs 8000 4000 $true) -eq 3000) 'Slow configured polling retains the reference recovery ceiling'
Check ((Get-RecoveryPollMs 20000 900 $false) -eq 900) 'Healthy metadata restores normal polling'

# Exercise the actual WinRT adapter with disappearing and duplicate sessions.
$isletTokens = $null; $isletErrors = $null
$isletAst = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../src/media/nowplaying.ps1'), [ref]$isletTokens, [ref]$isletErrors)
Check ($isletErrors.Count -eq 0) 'Bridge parses under Windows PowerShell'
$isletFunction = $isletAst.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-Session' }, $true)
Invoke-Expression $isletFunction.Extent.Text
function Get-Manager { return $script:fakeManager }
function Get-EpochMs($value) { return 0 }
function FakeSession($id, $status, $broken = $false) {
  $value = [pscustomobject] @{ SourceAppUserModelId = $id; Status = $status; Broken = $broken }
  $value | Add-Member ScriptMethod GetPlaybackInfo { if ($this.Broken) { throw 'Closed' }; return [pscustomobject] @{ PlaybackStatus = $this.Status } }
  $value | Add-Member ScriptMethod GetTimelineProperties { return [pscustomobject] @{ LastUpdatedTime = 0 } }
  return $value
}
$script:osInstance = FakeSession 'chrome.exe' 'Playing'
$script:duplicate = FakeSession 'chrome.exe' 'Paused'
$script:bad = FakeSession 'gone.exe' 'Playing' $true
$script:sampled = @($script:bad, $script:duplicate)
$script:fakeManager = [pscustomobject] @{}
$script:fakeManager | Add-Member ScriptMethod GetCurrentSession { return $script:osInstance }
$script:fakeManager | Add-Member ScriptMethod GetSessions { return $script:sampled }
$script:selection = New-SelectionState; $script:selectedSource = ''
Check ([object]::ReferenceEquals((Get-Session), $script:osInstance)) 'Adapter prefers OS-current instance within an app and ignores a vanished session'
$script:selectedSource = 'missing.exe'
Check ($null -eq (Get-Session)) 'Adapter honors a missing pin without unrelated fallback'
Write-Output "Media selection: $script:checks replay/recovery checks passed"
