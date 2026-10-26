using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using VNotch.Controls;
using VNotch.ViewModels;
using Xunit;

namespace VNotch.Tests;

public sealed class TimerColumnTests
{
    [Theory]
    [InlineData(218)]
    [InlineData(244)]
    [InlineData(344)]
    public void DialAndTransportFitAndTopRestoresTheAuthoredLayout(double width) => SharedStaTestRunner.RunAsync(() =>
    {
        using var view = new CountdownView(); view.Attach(new TimerViewModel());
        var display = (Border)view.FindName("CountdownDisplayPanel");
        var originalParent = display.Parent;
        view.SetCompact(true);
        view.Measure(new Size(width, double.PositiveInfinity)); view.Arrange(new Rect(0, 0, width, view.DesiredSize.Height)); view.UpdateLayout();
        foreach (var name in new[] { "CountdownDisplayPanel", "CountdownResetBtn", "CountdownStartBtn", "CountdownStepperCapsule", "ModeSelector", "ProgressRing" })
        {
            var part = (FrameworkElement)view.FindName(name);
            var box = part.TransformToVisual(view).TransformBounds(new Rect(part.RenderSize));
            Assert.True(box.Left >= -1 && box.Right <= width + 1, $"{name} outside {width}: {box}");
        }
        Assert.Same(view.FindName("RingHost"), display.Parent);
        ((ActionBorder)view.FindName("FocusModeButton")).InvokeAction();
        Assert.True(view.Pomodoro.IsEnabled);
        Assert.Equal(Visibility.Visible, ((FrameworkElement)view.FindName("FocusFooter")).Visibility);
        Assert.Equal(Visibility.Collapsed, ((FrameworkElement)view.FindName("CountdownStepperCapsule")).Visibility);
        ((ActionBorder)view.FindName("CountdownStartBtn")).InvokeAction();
        Assert.True(view.Controller.IsRunning);
        // Changing docking layout must never reset a running focus session.
        view.SetCompact(false);
        Assert.True(view.Controller.IsRunning);
        Assert.Same(originalParent, display.Parent);
        Assert.Equal(150, display.MinWidth);
        Assert.Equal(new Thickness(12, 0, 0, 0), display.Margin);
        Assert.Equal(Visibility.Collapsed, ((FrameworkElement)view.FindName("RingHost")).Visibility);
        ((MenuItem)view.FindName("SkipPhaseMenu")).RaiseEvent(new RoutedEventArgs(MenuItem.ClickEvent));
        Assert.Equal(VNotch.Controllers.PomodoroPhase.ShortBreak, view.Pomodoro.Phase);
        Assert.True(view.Controller.IsRunning);
        return Task.CompletedTask;
    });
}
