using System.Diagnostics;
using VNotch.Controllers;
using VNotch.ViewModels;
using Xunit;

namespace VNotch.Tests;

public sealed class PomodoroControllerTests
{
    // Dispatch is deliberately held: these tests advance the real monotonic
    // tracker directly, without waiting for wall time or starting UI threads.
    private static void Finish(CountdownController clock) => clock.Advance(
        clock.Tracker.LastCountdownTimestamp + (long)((clock.Remaining.TotalSeconds + 1) * Stopwatch.Frequency));

    [Fact]
    public void FourCompletedFocusSessionsEarnALongRestThenStartANewCycle()
    {
        using var clock = new CountdownController(new TimerViewModel(), _ => { });
        using var focus = new PomodoroController(clock);
        focus.SetEnabled(true); clock.Start();
        for (int round = 1; round <= 4; round++)
        {
            Assert.Equal(PomodoroPhase.Focus, focus.Phase);
            Assert.Equal(round, focus.Round);
            Assert.Equal(TimeSpan.FromMinutes(25), clock.Duration);
            Finish(clock);
            Assert.Equal(round, focus.CompletedSessions);
            Assert.True(clock.IsRunning);
            Assert.Equal(round == 4 ? PomodoroPhase.LongBreak : PomodoroPhase.ShortBreak, focus.Phase);
            Assert.Equal(TimeSpan.FromMinutes(round == 4 ? 15 : 5), clock.Duration);
            Finish(clock);
        }
        Assert.Equal(PomodoroPhase.Focus, focus.Phase);
        Assert.Equal(1, focus.Round);
        Assert.Equal(4, focus.CompletedSessions);
    }

    [Fact]
    public void SkipDoesNotCountWorkAndKeepsPausedSessionsPaused()
    {
        using var clock = new CountdownController(new TimerViewModel(), _ => { });
        using var focus = new PomodoroController(clock);
        focus.SetEnabled(true);
        focus.Skip();
        Assert.Equal(PomodoroPhase.ShortBreak, focus.Phase);
        Assert.False(clock.IsRunning);
        Assert.Equal(0, focus.CompletedSessions);
        focus.Skip(); clock.Start(); focus.Skip();
        Assert.True(clock.IsRunning);
        Assert.Equal(0, focus.CompletedSessions);
        focus.ResetPhase();
        Assert.False(clock.IsRunning);
        Assert.Equal(TimeSpan.FromMinutes(5), clock.Remaining);
    }

    [Fact]
    public void PauseResumeRetainsTimeAndReturningToTimerRestoresCustomDuration()
    {
        var vm = new TimerViewModel(); vm.SetCustomDuration(TimeSpan.FromMinutes(12));
        using var clock = new CountdownController(vm, _ => { });
        using var focus = new PomodoroController(clock);
        focus.SetEnabled(true); clock.Start();
        clock.Advance(clock.Tracker.LastCountdownTimestamp + Stopwatch.Frequency * 60);
        clock.Pause();
        var remaining = clock.Remaining;
        Assert.InRange(remaining.TotalSeconds, 1439, 1441);
        clock.Resume();
        Assert.Equal(remaining, clock.Remaining);
        focus.SetEnabled(false);
        Assert.False(clock.IsRunning);
        Assert.Equal(TimeSpan.FromMinutes(12), clock.Duration);
        Assert.Equal(clock.Duration, clock.Remaining);
        clock.Start(); Finish(clock);
        Assert.False(clock.IsRunning);
        Assert.Equal(0, focus.CompletedSessions);
    }

    [Fact]
    public void LateWakeupCompletesOnlyOneFocusSession()
    {
        using var clock = new CountdownController(new TimerViewModel(), _ => { });
        using var focus = new PomodoroController(clock);
        focus.SetEnabled(true); clock.Start();
        clock.Advance(clock.Tracker.LastCountdownTimestamp + Stopwatch.Frequency * 60 * 60 * 6);
        Assert.Equal(1, focus.CompletedSessions);
        Assert.Equal(PomodoroPhase.ShortBreak, focus.Phase);
        Assert.Equal(TimeSpan.FromMinutes(5), clock.Remaining);
    }
}
