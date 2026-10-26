using System;

namespace VNotch.Controllers;

public enum PomodoroPhase { Focus, ShortBreak, LongBreak }

/// <summary>Sequences focus sessions using the same monotonic countdown as the normal timer.
/// No view or visibility owns the clock. A skipped focus never counts as completed work.</summary>
public sealed class PomodoroController : IDisposable
{
    private readonly CountdownController _countdown;
    private TimeSpan _timerDuration;
    public bool IsEnabled { get; private set; }
    public PomodoroPhase Phase { get; private set; } = PomodoroPhase.Focus;
    public int CompletedSessions { get; private set; }
    public int Round => CompletedSessions % 4 + 1;
    public TimeSpan PhaseDuration => Phase switch
    {
        PomodoroPhase.ShortBreak => TimeSpan.FromMinutes(5),
        PomodoroPhase.LongBreak => TimeSpan.FromMinutes(15),
        _ => TimeSpan.FromMinutes(25)
    };
    public event EventHandler? Changed;

    public PomodoroController(CountdownController countdown)
    {
        _countdown = countdown;
        _timerDuration = countdown.Duration;
        countdown.Completed += OnCompleted;
    }

    public void SetEnabled(bool enabled)
    {
        if (IsEnabled == enabled) return;
        if (enabled) _timerDuration = _countdown.Duration;
        _countdown.Reset();
        IsEnabled = enabled;
        Phase = PomodoroPhase.Focus;
        CompletedSessions = 0;
        _countdown.SetCustomDuration(enabled ? PhaseDuration : _timerDuration);
        Changed?.Invoke(this, EventArgs.Empty);
    }

    public void ResetPhase()
    {
        _countdown.Reset();
        if (IsEnabled) _countdown.SetCustomDuration(PhaseDuration);
        Changed?.Invoke(this, EventArgs.Empty);
    }

    public void Skip()
    {
        if (!IsEnabled) return;
        bool running = _countdown.IsRunning;
        _countdown.Reset();
        Phase = Phase == PomodoroPhase.Focus ? PomodoroPhase.ShortBreak : PomodoroPhase.Focus;
        LoadPhase(running);
    }

    private void OnCompleted(object? sender, CountdownCompletedEventArgs e)
    {
        if (!IsEnabled) return;
        if (Phase == PomodoroPhase.Focus)
        {
            CompletedSessions++;
            Phase = CompletedSessions % 4 == 0 ? PomodoroPhase.LongBreak : PomodoroPhase.ShortBreak;
        }
        else Phase = PomodoroPhase.Focus;
        // Each phase starts at the actual completion event. Sleep or a delayed
        // UI callback must not fabricate several completed focus sessions.
        LoadPhase(true);
    }

    private void LoadPhase(bool start)
    {
        _countdown.SetCustomDuration(PhaseDuration);
        if (start) _countdown.Start();
        Changed?.Invoke(this, EventArgs.Empty);
    }

    public void Dispose() => _countdown.Completed -= OnCompleted;
}
