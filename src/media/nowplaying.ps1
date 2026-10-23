# Bridge between the Windows System Media Transport Controls and the notch.
#
# Writes one compact JSON object per line to stdout and reads one command per
# line from stdin ("toggle", "play", "pause", "next", "prev"). Runs until stdin
# closes, so it dies with its parent instead of lingering as an orphan.
#
# PowerShell 5.1 (powershell.exe) is deliberate: it is the only shell on a
# stock Windows 11 that can project WinRT types. pwsh.exe dropped that.

param(
  [int] $PollMs = 900
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
. (Join-Path $PSScriptRoot 'session-policy.ps1')

# Song titles are routinely non-ASCII; keep stdout UTF-8.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IInputStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null

# WinRT hands back IAsyncOperation; PowerShell has no await, so reach for the
# generic AsTask extension and block on the resulting Task.
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and
  $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($operation, $resultType) {
  if ($null -eq $operation) { return $null }
  $task = $asTaskGeneric.MakeGenericMethod($resultType).Invoke($null, @($operation))
  # A wait with no timeout would wedge the whole bridge if a player stalls.
  if (-not $task.Wait(4000)) { throw 'winrt call timed out' }
  return $task.Result
}

function Write-Line($object) {
  [Console]::Out.WriteLine(($object | ConvertTo-Json -Compress -Depth 4))
}

# The awaited WinRT stream arrives as a bare System.__ComObject that
# PowerShell's own casts refuse to project onto a WinRT interface. Calling the
# AsStreamForRead extension through reflection lets the CLR do the
# QueryInterface instead, and hands back an ordinary .NET Stream.
$asStreamForRead = [System.IO.WindowsRuntimeStreamExtensions].GetMethod(
  'AsStreamForRead', [type[]] @([Windows.Storage.Streams.IInputStream]))

function Read-Thumbnail($properties) {
  $reference = $properties.Thumbnail
  if ($null -eq $reference) { return $null }

  $stream = Await ($reference.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
  if ($null -eq $stream) { return $null }

  $source = $asStreamForRead.Invoke($null, @($stream))
  try {
    $buffer = New-Object System.IO.MemoryStream
    try {
      $source.CopyTo($buffer)
      # Cover art is a few tens of KB; anything huge is not worth a data URI.
      if ($buffer.Length -eq 0 -or $buffer.Length -gt 4194304) { return $null }
      $bytes = $buffer.ToArray()
    } finally {
      $buffer.Dispose()
    }
  } finally {
    $source.Dispose()
  }

  $mime = 'image/jpeg'
  if ($bytes.Length -gt 8 -and $bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50) { $mime = 'image/png' }
  elseif ($bytes.Length -gt 12 -and $bytes[0] -eq 0x42 -and $bytes[1] -eq 0x4D) { $mime = 'image/bmp' }

  return 'data:' + $mime + ';base64,' + [Convert]::ToBase64String($bytes)
}

function Get-EpochMs($dateTimeOffset) {
  try {
    # An untouched timeline reports year 1601; that is not a timestamp.
    if ($dateTimeOffset.Year -lt 2000) { return 0 }
    return [long] $dateTimeOffset.ToUnixTimeMilliseconds()
  } catch {
    return 0
  }
}

# --- session manager --------------------------------------------------------

$manager = $null
$selectedSource = ''
$selection = New-SelectionState
$recoveryStarted = 0L
$nextPollMs = $PollMs

function Get-Manager {
  if ($null -ne $script:manager) { return $script:manager }
  $script:manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  return $script:manager
}

function Get-Session {
  $mgr = Get-Manager
  if ($null -eq $mgr) { return $null }
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $current = $mgr.GetCurrentSession()
  # AUMIDs identify applications, not browser tabs. Prefer the OS-current
  # instance within each application; do not promise per-tab pinning.
  $byApp = @{}
  $candidates = @()
  $sessions = @()
  if ($null -ne $current) { $sessions += $current }
  $sessions += @($mgr.GetSessions())
  foreach ($session in $sessions) {
    try {
      $id = [string] $session.SourceAppUserModelId
      if (-not $id -or $byApp.ContainsKey($id)) { continue }
      $playback = $session.GetPlaybackInfo()
      $timeline = $session.GetTimelineProperties()
      $updated = Get-EpochMs $timeline.LastUpdatedTime
      $candidates += [pscustomobject] @{
        Id = $id; Session = $session
        Playing = [string] $playback.PlaybackStatus -eq 'Playing'
        IsCurrent = $null -ne $current -and [string] $current.SourceAppUserModelId -eq $id
        IsMusic = $id -match 'spotify|zunemusic|musicbee|foobar|aimp|wmplayer|vlc'
        FreshTimeline = $updated -gt 0 -and $now -ge $updated -and $now - $updated -lt 3000
      }
      $byApp[$id] = $true
    } catch {
      # One disappearing player must not discard every other session.
    }
  }
  $choice = Select-MediaCandidate $candidates $script:selection $script:selectedSource $now
  if ($null -ne $choice) { return $choice.Session }
  return $null
}

# --- media keys -------------------------------------------------------------

# Some players register with the SMTC but refuse its control calls. A media key
# goes through the same path the keyboard does, which they do honour.
Add-Type -Namespace Notch -Name Keys -MemberDefinition @'
  [System.Runtime.InteropServices.DllImport("user32.dll")]
  public static extern void keybd_event(byte vk, byte scan, uint flags, System.UIntPtr extra);
'@ | Out-Null

$VK = @{ toggle = 0xB3; play = 0xB3; pause = 0xB3; next = 0xB0; prev = 0xB1 }

function Send-MediaKey($action) {
  $code = $VK[$action]
  if ($null -eq $code) { return $false }
  [Notch.Keys]::keybd_event([byte] $code, 0, 0, [System.UIntPtr]::Zero)
  [Notch.Keys]::keybd_event([byte] $code, 0, 2, [System.UIntPtr]::Zero)
  return $true
}

function Write-CommandResult($action, $via, $requestId = '', $targetApp = '') {
  $payload = @{ type = 'command'; action = $action; via = $via }
  if ($requestId) { $payload.id = $requestId; $payload.app = $targetApp }
  Write-Line $payload
}

function Invoke-Action($action, $value = 0, $requestId = '', $targetApp = '') {
  if ($action -eq 'source') {
    $script:selectedSource = [string] $value
    $script:selection = New-SelectionState
    $script:lastTrackKey = ''
    Write-CommandResult $action 'source' $requestId $targetApp
    return
  }
  $viaWinRt = $false
  $session = $null
  try {
    if ($targetApp) {
      $osCurrent = (Get-Manager).GetCurrentSession()
      if ($null -ne $osCurrent -and [string] $osCurrent.SourceAppUserModelId -eq $targetApp) { $session = $osCurrent }
      else {
        foreach ($candidate in (Get-Manager).GetSessions()) {
          if ([string] $candidate.SourceAppUserModelId -eq $targetApp) { $session = $candidate; break }
        }
      }
    } else { $session = Get-Session }
    if ($null -ne $session) {
      switch ($action) {
        'toggle' { $viaWinRt = Await ($session.TryTogglePlayPauseAsync()) ([bool]) }
        'play'   { $viaWinRt = Await ($session.TryPlayAsync()) ([bool]) }
        'pause'  { $viaWinRt = Await ($session.TryPauseAsync()) ([bool]) }
        'next'   { $viaWinRt = Await ($session.TrySkipNextAsync()) ([bool]) }
        'prev'   { $viaWinRt = Await ($session.TrySkipPreviousAsync()) ([bool]) }
        'seek'   {
          $timeline = $session.GetTimelineProperties()
          $duration = ($timeline.EndTime - $timeline.StartTime).TotalSeconds
          $relative = [math]::Max(0, [math]::Min([double] $value, $duration))
          $ticks = $timeline.StartTime.Ticks + [long] ($relative * 10000000)
          $viaWinRt = Await ($session.TryChangePlaybackPositionAsync($ticks)) ([bool])
        }
      }
    }
  } catch {
    $viaWinRt = $false
  }

  if ($viaWinRt) {
    Write-CommandResult $action 'winrt' $requestId $targetApp
    return
  }

  $sent = $false
  try {
    # Play/Pause requests are explicit and idempotent. Do not send a toggle key
    # when WinRT already reached the requested state, or to another player.
    if ($null -ne $session -and $action -in @('play', 'pause')) {
      $status = [string] $session.GetPlaybackInfo().PlaybackStatus
      if (($action -eq 'play' -and $status -eq 'Playing') -or ($action -eq 'pause' -and $status -ne 'Playing')) {
        Write-CommandResult $action 'unchanged' $requestId $targetApp
        return
      }
    }
    $current = (Get-Manager).GetCurrentSession()
    if (-not $targetApp -or ($null -ne $current -and [string] $current.SourceAppUserModelId -eq $targetApp)) {
      $sent = Send-MediaKey $action
    }
  } catch { $sent = $false }
  Write-CommandResult $action $(if ($sent) { 'mediakey' } else { 'none' }) $requestId $targetApp
}

# --- poll loop --------------------------------------------------------------

# Cover art only has to travel once per track, so remember what we sent.
$lastTrackKey = ''

function Poll {
  $session = Get-Session
  $sources = @((Get-Manager).GetSessions() | ForEach-Object { [string] $_.SourceAppUserModelId } | Select-Object -Unique)

  if ($null -eq $session) {
    $script:lastTrackKey = ''
    Set-RecoveryPoll $true
    Write-Line @{ type = 'state'; session = $false; sources = $sources; selectedSource = $script:selectedSource }
    return
  }

  $properties = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
  $playback = $session.GetPlaybackInfo()
  $timeline = $session.GetTimelineProperties()

  $title = ''
  $artist = ''
  $album = ''
  if ($null -ne $properties) {
    $title = [string] $properties.Title
    $artist = [string] $properties.Artist
    $album = [string] $properties.AlbumTitle
  }
  Set-RecoveryPoll (-not $title -and -not $artist)

  $appId = [string] $session.SourceAppUserModelId
  $status = 'unknown'
  $canPlay = $false
  $canPause = $false
  $canNext = $false
  $canPrev = $false
  $canSeek = $false
  if ($null -ne $playback) {
    $status = [string] $playback.PlaybackStatus
    if ($null -ne $playback.Controls) {
      $canPlay = [bool] $playback.Controls.IsPlayEnabled
      $canPause = [bool] $playback.Controls.IsPauseEnabled
      $canNext = [bool] $playback.Controls.IsNextEnabled
      $canPrev = [bool] $playback.Controls.IsPreviousEnabled
      $canSeek = [bool] $playback.Controls.IsPlaybackPositionEnabled
    }
  }

  $position = 0
  $duration = 0
  $lastUpdated = 0
  if ($null -ne $timeline) {
    $position = [math]::Round(($timeline.Position - $timeline.StartTime).TotalSeconds, 2)
    $duration = [math]::Round(($timeline.EndTime - $timeline.StartTime).TotalSeconds, 2)
    $lastUpdated = Get-EpochMs $timeline.LastUpdatedTime
  }
  if ($position -lt 0) { $position = 0 }
  if ($duration -lt 0) { $duration = 0 }

  $payload = @{
    type        = 'state'
    session     = $true
    title       = $title
    artist      = $artist
    album       = $album
    app         = $appId
    status      = $status
    position    = $position
    duration    = $duration
    lastUpdated = $lastUpdated
    canPlay     = $canPlay
    canPause    = $canPause
    canNext     = $canNext
    canPrev     = $canPrev
    canSeek     = $canSeek
    sources     = $sources
    selectedSource = $script:selectedSource
  }

  $trackKey = $appId + '|' + $title + '|' + $artist + '|' + $album
  if ($trackKey -ne $script:lastTrackKey) {
    $script:lastTrackKey = $trackKey
    $thumb = $null
    try { $thumb = Read-Thumbnail $properties } catch { $thumb = $null }
    # An explicit null clears stale art; omitting the key would keep it.
    $payload.thumb = $thumb
  }

  Write-Line $payload
}

function Set-RecoveryPoll([bool] $recovering) {
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  if (-not $recovering) { $script:recoveryStarted = 0L }
  elseif ($script:recoveryStarted -eq 0) { $script:recoveryStarted = $now }
  $script:nextPollMs = Get-RecoveryPollMs ($now - $script:recoveryStarted) $PollMs $recovering
}

Write-Line @{ type = 'hello'; pollMs = $PollMs }

# Console.In would block the poll loop, so read the raw pipe asynchronously.
$stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput(), [System.Text.Encoding]::UTF8)
$pending = $null

while ($true) {
  try {
    Poll
  } catch {
    # Never let one bad poll end the bridge; the manager may just be busy.
    Write-Line @{ type = 'error'; message = [string] $_.Exception.Message }
    $script:manager = $null
  }

  $deadline = [DateTime]::UtcNow.AddMilliseconds($script:nextPollMs)
  while ([DateTime]::UtcNow -lt $deadline) {
    if ($null -eq $pending) { $pending = $stdin.ReadLineAsync() }

    if ($pending.IsCompleted) {
      $line = $pending.Result
      $pending = $null
      if ($null -eq $line) { exit 0 }   # parent went away
      $action = $line.Trim().ToLowerInvariant()
      $value = 0
      $requestId = ''
      $targetApp = ''
      if ($action.StartsWith('{')) {
        try {
          $command = $line | ConvertFrom-Json
          $action = [string] $command.action
          $value = $command.value
          $requestId = [string] $command.id
          $targetApp = [string] $command.app
        } catch { continue }
      }
      if ($action -eq 'quit') { exit 0 }
      if ($action) {
        try {
          Invoke-Action $action $value $requestId $targetApp
        } catch {
          Write-Line @{ type = 'error'; message = [string] $_.Exception.Message }
        }
        # Report the new state straight away instead of after the full interval.
        break
      }
      continue
    }

    Start-Sleep -Milliseconds 60
  }
}
