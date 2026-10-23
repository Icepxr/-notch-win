# SPDX-License-Identifier: GPL-3.0-or-later
# Islet adaptation of V-Notch session selection/switch and metadata recovery
# policies (rainaku/V-Notch, Apache-2.0). Rewritten for sampled SMTC data rather
# than WPF events; source revision and upstream license: THIRD_PARTY_NOTICES.md.
# Pure policy: no WinRT, timers, media commands, or Windows API calls here.

function New-SelectionState {
  return @{ Current = ''; Pending = ''; PendingAt = 0L; Initialized = $false; History = @{} }
}

function Select-MediaCandidate($candidates, $state, [string] $pinned, [long] $now) {
  # Histories belong only to live applications. Never grow this map forever.
  $history = @{}
  foreach ($candidate in $candidates) {
    $old = $state.History[$candidate.Id]
    $started = 0L
    if ($null -ne $old) { $started = $old.Started }
    if ($candidate.Playing -and $state.Initialized -and ($null -eq $old -or -not $old.Playing)) { $started = $now }
    $history[$candidate.Id] = @{ Playing = $candidate.Playing; Started = $started }
  }
  $state.History = $history
  $state.Initialized = $true
  $latestStart = 0L
  foreach ($entry in $history.Values) {
    if ($entry.Playing -and $entry.Started -gt $latestStart) { $latestStart = $entry.Started }
  }

  # Selecting a source pins the application even if it pauses or disappears.
  # The UI can release a missing pin; never silently control another app.
  if ($pinned) {
    $state.Pending = ''
    $state.Current = $pinned
    return $candidates | Where-Object { $_.Id -eq $pinned } | Select-Object -First 1
  }

  $best = $null
  $bestScore = [int]::MinValue
  $current = $null
  foreach ($candidate in $candidates) {
    if ($candidate.Id -eq $state.Current) { $current = $candidate }
    # Playing always beats paused, including a paused OS-current session.
    $score = 0
    if ($candidate.Playing) { $score += 10000 }
    if ($candidate.IsCurrent) { $score += 1200 }
    if ($candidate.IsMusic) { $score += 300 }
    if ($candidate.Id -eq $state.Current) { $score += 100 }
    $started = $history[$candidate.Id].Started
    # The latest observed start stays preferred while it keeps playing. A
    # decaying bonus alone would jump back to stale OS focus after eight seconds.
    if ($candidate.Playing -and $started -gt 0 -and $started -eq $latestStart) { $score += 2000 }
    $age = $now - $started
    if ($candidate.Playing -and $started -gt 0 -and $age -ge 0 -and $age -lt 8000) {
      $score += 3000 - [int]($age * .15)
    }
    if ($candidate.FreshTimeline) { $score += 200 }
    if ($score -gt $bestScore) { $best = $candidate; $bestScore = $score }
  }

  if ($null -eq $best) { $state.Current = ''; $state.Pending = ''; return $null }
  if ($null -ne $current -and $best.Id -ne $current.Id -and $current.Playing) {
    if ($state.Pending -ne $best.Id) { $state.Pending = $best.Id; $state.PendingAt = $now }
    $started = $history[$best.Id].Started
    $recentStart = $started -gt 0 -and $now -ge $started -and $now - $started -lt 2000
    $holdMs = 1500
    if ($current.IsMusic) { $holdMs = 4000 }
    if (-not $best.IsCurrent -and -not $recentStart -and -not $best.FreshTimeline -and $now - $state.PendingAt -lt $holdMs) {
      return $current
    }
  }
  $state.Current = $best.Id
  $state.Pending = ''
  return $best
}

function Get-RecoveryPollMs([long] $elapsed, [int] $normalMs, [bool] $recovering) {
  if (-not $recovering) { return $normalMs }
  # Unlike V-Notch, this bridge has no WinRT event wake-up. Do not let recovery
  # backoff make a newly started player slower to discover than normal polling.
  if ($elapsed -lt 2000) { return [math]::Min($normalMs, 350) }
  if ($elapsed -lt 8000) { return [math]::Min($normalMs, 1000) }
  return [math]::Min($normalMs, 3000)
}
