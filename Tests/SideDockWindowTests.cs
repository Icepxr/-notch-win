using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Microsoft.Extensions.DependencyInjection;
using VNotch.Controllers;
using VNotch.Models;
using VNotch.Services;
using VNotch.Tests.Fakes;
using Xunit;

namespace VNotch.Tests;

[Collection("Localization")]
public sealed class SideDockWindowTests
{
    private const BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;

    [Theory]
    [InlineData(NotchEdge.Left, false)]
    [InlineData(NotchEdge.Right, true)]
    public void PagesRemainInsideTheSideShellAndRestoreAtTop(NotchEdge edge, bool island) => SharedStaTestRunner.RunAsync(async ct =>
    {
        var media = new FakeMediaDetectionService();
        await using var fixture = new GreetingAcceptanceTests.MainWindowFixture("en", false,
            s => { s.EnableLocalOnlyMode = true; s.EnableDiagnosticLogging = false;
                s.EnableEdgeDocking = true; s.DockEdge = edge; s.Width = 230;
                s.EnableDynamicIslandMode = island; s.DynamicIslandWidth = 230; },
            services => services.AddSingleton<IMediaDetectionService>(media));
        var w = fixture.Window;
        w.Show();
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup settles", ct);
        var coordinator = (NotchTransitionCoordinator)typeof(MainWindow).GetField("_transitionCoordinator", Private)!.GetValue(w)!;
        var authoredWidth = w.MediaPlayback.ColumnWidth;
        foreach (var page in new[] { NotchView.Media, NotchView.Timer, NotchView.Agents, NotchView.Secondary, NotchView.AudioMixer })
        {
            coordinator.RequestView(page, "side-layout-regression");
            await WpfFrameWaiter.UntilAsync(() => !Animating(w) && coordinator.CurrentView == page, "side page settles: " + page, ct);
            w.UpdateLayout();
            Assert.InRange(w.NotchBorder.ActualWidth, 298, 422);
            var nav = w.DockNavigation;
            Assert.True(nav.IsColumn);
            Assert.True(nav.ActualWidth <= w.NotchBorder.ActualWidth);
            // Native host space is larger than the visible panel. Compare with
            // the painted border, otherwise off-panel tabs appear to 'fit'.
            var navBox = nav.TransformToVisual(w.NotchBorder).TransformBounds(new Rect(nav.RenderSize));
            Assert.True(navBox.Left >= -1 && navBox.Right <= w.NotchBorder.ActualWidth + 1,
                $"{page}: navigation must remain on the panel ({navBox})");
            if (page == NotchView.Media)
            {
                Assert.True(w.MediaPlayback.CentreInColumn);
                Assert.InRange(w.ThumbnailBorder.Width, 100, 280);
            }
            if (page == NotchView.AudioMixer)
                Assert.InRange(w.NotchBorder.ActualHeight, 230, 380);
            if (page == NotchView.Timer)
            {
                Assert.Equal(ScrollBarVisibility.Auto, w.DockTimerScroll.VerticalScrollBarVisibility);
                Assert.True(w.DockTimerScroll.ViewportWidth > 150);
                Assert.InRange(w.DockTimerScroll.ScrollableHeight, 0, 1);
                var controls = (FrameworkElement)w.CountdownWidget.FindName("TimerControlBar");
                var box = controls.TransformToVisual(w.NotchBorder).TransformBounds(new Rect(controls.RenderSize));
                Assert.True(box.Bottom <= w.NotchBorder.ActualHeight, "Timer controls must fit without scrolling at the default screen size");
                ((VNotch.Controls.ActionBorder)w.CountdownWidget.FindName("FocusModeButton")).InvokeAction();
                await System.Windows.Threading.Dispatcher.Yield(System.Windows.Threading.DispatcherPriority.ApplicationIdle);
                await WpfFrameWaiter.UntilAsync(() =>
                {
                    w.UpdateLayout();
                    var footer = (FrameworkElement)w.CountdownWidget.FindName("FocusFooter");
                    return !Animating(w) && footer.ActualHeight > 24 &&
                        footer.TransformToVisual(w.NotchBorder).TransformBounds(new Rect(footer.RenderSize)).Bottom <= w.NotchBorder.ActualHeight + 1;
                }, "Pomodoro footer fits after resize", ct);
                Save(w.NotchWrapper, $"dock-{edge.ToString().ToLowerInvariant()}-pomodoro.png");
                ((VNotch.Controls.ActionBorder)w.CountdownWidget.FindName("CountdownStartBtn")).InvokeAction();
                coordinator.RequestView(NotchView.Agents, "focus-keeps-running-offscreen");
                await WpfFrameWaiter.UntilAsync(() => !Animating(w) && coordinator.CurrentView == NotchView.Agents, "focus hidden", ct);
                var clock = w.CountdownWidget.Controller;
                clock.Advance(clock.Tracker.LastCountdownTimestamp + System.Diagnostics.Stopwatch.Frequency * 60 * 26);
                Assert.Equal(PomodoroPhase.ShortBreak, w.CountdownWidget.Pomodoro.Phase);
                Assert.True(clock.IsRunning);
                Assert.False((bool)typeof(MainWindow).GetField("_isCountdownCompleteVisible", Private)!.GetValue(w)!);
                coordinator.RequestView(NotchView.Timer, "focus-rest-return");
                await WpfFrameWaiter.UntilAsync(() => !Animating(w) && coordinator.CurrentView == NotchView.Timer, "rest page settles", ct);
                Save(w.NotchWrapper, $"dock-{edge.ToString().ToLowerInvariant()}-rest.png");
                w.CountdownWidget.Pomodoro.SetEnabled(false);
                await System.Windows.Threading.Dispatcher.Yield(System.Windows.Threading.DispatcherPriority.ApplicationIdle);
                await WpfFrameWaiter.UntilAsync(() => !Animating(w), "timer mode restored", ct);
            }
            Save(w.NotchWrapper, $"dock-{edge.ToString().ToLowerInvariant()}-{page.ToString().ToLowerInvariant()}.png");
        }
        coordinator.RequestView(NotchView.Compact, "side-layout-regression");
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "collapse settles", ct);
        w.MoveDockTo(NotchEdge.Top);
        coordinator.RequestView(NotchView.Media, "top-layout-regression");
        await WpfFrameWaiter.UntilAsync(() => !Animating(w) && coordinator.CurrentView == NotchView.Media, "top page settles", ct);
        Assert.False(w.DockNavigation.IsColumn);
        Assert.False(w.MediaPlayback.CentreInColumn);
        Assert.Equal(340, w.MediaPlayback.ColumnWidth);
        Assert.Equal(ScrollBarVisibility.Disabled, w.DockTimerScroll.VerticalScrollBarVisibility);
        Assert.Equal(102, w.ThumbnailBorder.Width);
        coordinator.RequestView(NotchView.Timer, "top-timer-layout-regression");
        await WpfFrameWaiter.UntilAsync(() => !Animating(w) && coordinator.CurrentView == NotchView.Timer, "top timer settles", ct);
        Assert.Equal(Visibility.Visible, w.ClockViewHeader.Visibility);
        Assert.Equal(Visibility.Collapsed, ((FrameworkElement)w.CountdownWidget.FindName("RingHost")).Visibility);
        Assert.Equal(Visibility.Visible, ((FrameworkElement)w.CountdownWidget.FindName("ModeSelector")).Visibility);
        Assert.Equal(150, w.CountdownWidget.CountdownDisplayPanel.MinWidth);
        Assert.Same(w.CountdownWidget.FindName("TransportGrid"), w.CountdownWidget.CountdownDisplayPanel.Parent);
        Save(w.NotchWrapper, "dock-top-timer.png");
    });

    private static bool Animating(MainWindow w) => (bool)typeof(MainWindow).GetProperty("_isAnimating", Private)!.GetValue(w)!;

    internal static void Save(FrameworkElement surface, string name)
    {
        string folder = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../../.test-output"));
        Directory.CreateDirectory(folder);
        var image = new RenderTargetBitmap((int)Math.Ceiling(surface.ActualWidth), (int)Math.Ceiling(surface.ActualHeight), 96, 96, PixelFormats.Pbgra32);
        var drawing = new DrawingVisual();
        using (var dc = drawing.RenderOpen())
            dc.DrawRectangle(new VisualBrush(surface), null, new Rect(surface.RenderSize));
        image.Render(drawing);
        var png = new PngBitmapEncoder(); png.Frames.Add(BitmapFrame.Create(image));
        using var file = File.Create(Path.Combine(folder, name)); png.Save(file);
    }
}
