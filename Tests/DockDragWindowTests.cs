using System.Reflection;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;
using Microsoft.Extensions.DependencyInjection;
using VNotch.Controllers;
using VNotch.Models;
using VNotch.Services;
using VNotch.Tests.Fakes;
using Xunit;

namespace VNotch.Tests;

[Collection("Localization")]
public sealed class DockDragWindowTests
{
    private const BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;

    [Theory]
    [InlineData(NotchEdge.Top, NotchEdge.Left, false)]
    [InlineData(NotchEdge.Top, NotchEdge.Right, true)]
    [InlineData(NotchEdge.Left, NotchEdge.Top, true)]
    [InlineData(NotchEdge.Right, NotchEdge.Top, false)]
    [InlineData(NotchEdge.Left, NotchEdge.Right, false)]
    [InlineData(NotchEdge.Right, NotchEdge.Left, true)]
    public void DragTracksPointerAndCommitsOnlyOnRelease(NotchEdge source, NotchEdge target, bool expanded) => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(source);
        var w = fixture.Window; w.Show();
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
        if (expanded)
        {
            Coordinator(w).RequestView(NotchView.Media, "drag-expanded-test");
            await WpfFrameWaiter.UntilAsync(() => !Animating(w), "expanded", ct);
        }
        w.UpdateLayout();
        var screen = Screen(w);
        var start = Center(w);
        var input = new DockPointerState(start, true, true, false);
        w.DockPointerReader = () => input;
        Press(w);
        Assert.True(w.IsDockMoveInProgress);
        var end = Target(screen, target);
        input = input with { Position = end, ControlDown = false };
        await WpfFrameWaiter.UntilAsync(() => (Center(w) - end).Length < 2, "grab follows pointer", ct);
        Assert.Equal(source, w.DockEdge);
        // Capture may be denied or lost on a non-activating overlay. Neither
        // may terminate the physical drag or leave hover permanently blocked.
        Mouse.Capture(null);
        input = input with { Position = end + new Vector(0, 8) };
        await WpfFrameWaiter.UntilAsync(() => (Center(w) - input.Position).Length < 2, "capture fallback follows", ct);
        input = input with { LeftDown = false };
        await WpfFrameWaiter.UntilAsync(() => !w.IsDockMoveInProgress && !Animating(w), "release lands", ct);
        Assert.Equal(target, w.DockEdge);
        AssertCentred(w, target, screen);
        Assert.False(Coordinator(w).IsTransitionActive);
    });

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public void EscapeRestoresSourceAndQuickReleaseCannotLeaveAWideSideBadge(bool cancel) => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(NotchEdge.Top);
        var w = fixture.Window; w.Show();
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
        Coordinator(w).RequestView(NotchView.Timer, "quick-drag-test");
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "timer open", ct);
        var screen = Screen(w);
        var input = new DockPointerState(Center(w), true, true, false);
        w.DockPointerReader = () => input;
        Press(w);
        input = input with { Position = Target(screen, NotchEdge.Right) };
        if (cancel)
        {
            await WpfFrameWaiter.UntilAsync(() => (Center(w) - input.Position).Length < 2, "drag moves", ct);
            input = input with { EscapeDown = true };
        }
        else input = input with { LeftDown = false }; // No MouseMove delivery before release.
        await WpfFrameWaiter.UntilAsync(() => !w.IsDockMoveInProgress && !Animating(w), "quick release / cancel settles", ct);
        var target = cancel ? NotchEdge.Top : NotchEdge.Right;
        Assert.Equal(target, w.DockEdge);
        AssertCentred(w, target, screen);
        Assert.True(w.NotchBorder.IsHitTestVisible);
    });

    [Fact]
    public void CtrlClickWithoutDraggingDoesNotCollapseAnExpandedPanel() => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(NotchEdge.Top);
        var w = fixture.Window; w.Show();
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
        Coordinator(w).RequestView(NotchView.Media, "ctrl-click-test");
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "expanded", ct);
        var input = new DockPointerState(Center(w), true, true, false);
        w.DockPointerReader = () => input;
        Press(w);
        input = input with { Position = input.Position + new Vector(2, 1), LeftDown = false, ControlDown = false };
        await WpfFrameWaiter.UntilAsync(() => !w.IsDockMoveInProgress, "ctrl-click ends", ct);
        Assert.Equal(NotchView.Media, Coordinator(w).CurrentView);
        Assert.Equal(NotchEdge.Top, w.DockEdge);
    });

    [Fact]
    public void HoldingCtrlCollapsesWithoutMouseMovementAndReleaseRestoresHover() => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(NotchEdge.Top);
        var w = fixture.Window; w.Show();
        var input = new DockPointerState(new Point(500, 400), false, false, false);
        w.DockPointerReader = () => input;
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
        Coordinator(w).RequestView(NotchView.Media, "arm-with-control");
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "expanded", ct);
        input = input with { ControlDown = true };
        await WpfFrameWaiter.UntilAsync(() => Coordinator(w).CurrentView == NotchView.Compact && !Animating(w), "Ctrl readies pill", ct);
        Assert.True(w.IsDockHoverSuppressed);
        Assert.False(w.IsDockMoveInProgress);
        input = input with { ControlDown = false };
        await WpfFrameWaiter.UntilAsync(() => !((DispatcherTimer)typeof(MainWindow).GetField("_dockArmingTimer", Private)!.GetValue(w)!).IsEnabled,
            "arming monitor stops after release", ct);
        Assert.False(w.IsDockHoverSuppressed);
        Assert.Equal(NotchEdge.Top, w.DockEdge);
    });

    [Fact]
    public void CtrlGrabDuringTheCollapseStillReceivesPointerInput() => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(NotchEdge.Top);
        var w = fixture.Window; w.Show();
        var input = new DockPointerState(new Point(500, 400), false, false, false);
        w.DockPointerReader = () => input;
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
        Coordinator(w).RequestView(NotchView.Media, "grab-during-collapse");
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "expanded", ct);
        input = input with { ControlDown = true };
        await WpfFrameWaiter.UntilAsync(() => Animating(w) && Coordinator(w).TargetView == NotchView.Compact, "Ctrl collapse starts", ct);
        Assert.False(w.NotchBorder.IsHitTestVisible);
        input = input with { Position = Center(w), LeftDown = true };
        var local = w.PointFromScreen(input.Position);
        Assert.True((bool)typeof(MainWindow).GetMethod("IsPointInteractive", Private)!.Invoke(w, new object[] { local })!);
        var press = new MouseButtonEventArgs(Mouse.PrimaryDevice, Environment.TickCount, MouseButton.Left)
        { RoutedEvent = Mouse.PreviewMouseDownEvent };
        w.RaiseEvent(press);
        Assert.True(press.Handled);
        Assert.True(w.IsDockMoveInProgress);
        var screen = Screen(w);
        input = input with { Position = Target(screen, NotchEdge.Left), LeftDown = false, ControlDown = false };
        await WpfFrameWaiter.UntilAsync(() => !w.IsDockMoveInProgress && !Animating(w), "grab lands after collapse", ct);
        Assert.Equal(NotchEdge.Left, w.DockEdge);
        AssertCentred(w, NotchEdge.Left, screen);
    });

    private static GreetingAcceptanceTests.MainWindowFixture Fixture(NotchEdge edge) => new("en", false,
        s => { s.EnableEdgeDocking = true; s.DockEdge = edge; s.EnableDynamicIslandMode = true;
            s.DynamicIslandWidth = 240; s.DynamicIslandHeight = 40;
            s.EnableLocalOnlyMode = true; s.AutoCheckUpdates = false; },
        services => services.AddSingleton<IMediaDetectionService>(new FakeMediaDetectionService()));

    private static void Press(MainWindow w)
    {
        var e = new MouseButtonEventArgs(Mouse.PrimaryDevice, Environment.TickCount, MouseButton.Left)
        { RoutedEvent = Mouse.PreviewMouseDownEvent };
        w.NotchBorder.RaiseEvent(e);
        Assert.True(e.Handled);
    }
    private static Point Center(MainWindow w) => w.NotchBorder.PointToScreen(new Point(w.NotchBorder.ActualWidth / 2, w.NotchBorder.ActualHeight / 2));
    private static Rect Screen(MainWindow w) => (Rect)typeof(MainWindow).GetProperty("DockScreen", Private)!.GetValue(w)!;
    private static bool Animating(MainWindow w) => (bool)typeof(MainWindow).GetProperty("_isAnimating", Private)!.GetValue(w)!;
    private static NotchTransitionCoordinator Coordinator(MainWindow w) => (NotchTransitionCoordinator)typeof(MainWindow).GetField("_transitionCoordinator", Private)!.GetValue(w)!;
    private static Point Target(Rect screen, NotchEdge edge) => edge switch
    {
        NotchEdge.Left => new(screen.Left + 50, screen.Top + screen.Height / 2),
        NotchEdge.Right => new(screen.Right - 50, screen.Top + screen.Height / 2),
        _ => new(screen.Left + screen.Width / 2, screen.Top + 30)
    };
    private static void AssertCentred(MainWindow w, NotchEdge edge, Rect screen)
    {
        w.UpdateLayout();
        var center = Center(w);
        if (edge == NotchEdge.Top)
        {
            Assert.InRange(Math.Abs(center.X - (screen.Left + screen.Width / 2)), 0, 2);
            Assert.InRange(w.NotchBorder.ActualWidth, 239, 241);
            Assert.InRange(w.NotchBorder.ActualHeight, 39, 41);
        }
        else
        {
            Assert.InRange(Math.Abs(center.Y - (screen.Top + screen.Height / 2)), 0, 2);
            Assert.InRange(w.NotchBorder.ActualWidth, 39, 41);
            Assert.InRange(w.NotchBorder.ActualHeight, 59, 61);
        }
    }
}
