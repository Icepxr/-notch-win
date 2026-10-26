using System.Reflection;
using System.Windows;
using System.Windows.Threading;
using Microsoft.Extensions.DependencyInjection;
using VNotch.Controllers;
using VNotch.Controls;
using VNotch.Models;
using VNotch.Services;
using VNotch.Tests.Fakes;
using Xunit;

namespace VNotch.Tests;

[Collection("Localization")]
public sealed class TopPomodoroTests
{
    private const BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void VisibleTopModeSwitchRunsFocusAndKeepsFooterInsideThePanel(bool island) => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = new GreetingAcceptanceTests.MainWindowFixture("en", false,
            s => { s.EnableLocalOnlyMode = true; s.AutoCheckUpdates = false;
                s.EnableDynamicIslandMode = island; s.EnableEdgeDocking = true; s.DockEdge = NotchEdge.Top; },
            services => services.AddSingleton<IMediaDetectionService>(new FakeMediaDetectionService()));
        var w = fixture.Window; w.Show();
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup settles", ct);
        var coordinator = (NotchTransitionCoordinator)typeof(MainWindow).GetField("_transitionCoordinator", Private)!.GetValue(w)!;
        coordinator.RequestView(NotchView.Timer, "top-pomodoro");
        await WpfFrameWaiter.UntilAsync(() => !Animating(w) && coordinator.CurrentView == NotchView.Timer, "top timer settles", ct);
        var view = w.CountdownWidget;
        var mode = (FrameworkElement)view.FindName("ModeSelector");
        Assert.True(mode.IsVisible);
        Assert.True(w.ClockViewHeader.IsVisible);
        Assert.True(w.DockTimerScroll.ScrollableHeight < 1);
        ((ActionBorder)view.FindName("FocusModeButton")).InvokeAction();
        await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
        await WpfFrameWaiter.UntilAsync(() => !Animating(w) && w.NotchBorder.ActualHeight > 350, "top focus grows", ct);
        w.UpdateLayout();
        Assert.True(view.Pomodoro.IsEnabled);
        AssertFooterFits(w);
        SideDockWindowTests.Save(w.NotchWrapper, $"top-pomodoro-{island}.png");
        ((ActionBorder)view.FindName("CountdownStartBtn")).InvokeAction();
        Assert.True(view.Controller.IsRunning);
        view.Controller.Advance(view.Controller.Tracker.LastCountdownTimestamp + System.Diagnostics.Stopwatch.Frequency * 60 * 26);
        Assert.Equal(PomodoroPhase.ShortBreak, view.Pomodoro.Phase);
        Assert.True(view.Controller.IsRunning);
        ((ActionBorder)view.FindName("SkipPhaseButton")).InvokeAction();
        Assert.Equal(PomodoroPhase.Focus, view.Pomodoro.Phase);
        Assert.Equal(1, view.Pomodoro.CompletedSessions);

        // Exercise mode changes while the previous resize is still in flight.
        ((ActionBorder)view.FindName("TimerModeButton")).InvokeAction();
        await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
        ((ActionBorder)view.FindName("FocusModeButton")).InvokeAction();
        await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
        await WpfFrameWaiter.UntilAsync(() => !Animating(w) && w.NotchBorder.ActualHeight > 350, "latest mode wins", ct);
        AssertFooterFits(w);
    });

    private static void AssertFooterFits(MainWindow w)
    {
        w.UpdateLayout();
        var footer = (FrameworkElement)w.CountdownWidget.FindName("FocusFooter");
        var box = footer.TransformToVisual(w.NotchBorder).TransformBounds(new Rect(footer.RenderSize));
        Assert.True(footer.IsVisible);
        Assert.True(box.Left >= 0 && box.Right <= w.NotchBorder.ActualWidth + 1);
        Assert.True(box.Bottom <= w.NotchBorder.ActualHeight - 8, $"Footer {box} clips outside shell {w.NotchBorder.RenderSize}");
        Assert.InRange(w.DockTimerScroll.ScrollableHeight, 0, 1);
    }

    private static bool Animating(MainWindow w) => (bool)typeof(MainWindow).GetProperty("_isAnimating", Private)!.GetValue(w)!;
}
