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
        // TargetView is committed before the collapse's hit-test handoff.
        // Wait for the actual non-interactive phase we intend to grab from.
        await WpfFrameWaiter.UntilAsync(() => Animating(w) && Coordinator(w).TargetView == NotchView.Compact &&
            !w.NotchBorder.IsHitTestVisible, "Ctrl collapse starts its hit-test handoff", ct);
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

    [Theory]
    [InlineData(NotchEdge.Top, NotchEdge.Left, true)]
    [InlineData(NotchEdge.Top, NotchEdge.Right, true)]
    [InlineData(NotchEdge.Left, NotchEdge.Top, true)]
    [InlineData(NotchEdge.Right, NotchEdge.Top, true)]
    [InlineData(NotchEdge.Left, NotchEdge.Right, true)]
    [InlineData(NotchEdge.Right, NotchEdge.Left, true)]
    [InlineData(NotchEdge.Top, NotchEdge.Left, false)]
    [InlineData(NotchEdge.Right, NotchEdge.Top, false)]
    public void LandingMorphsTheLiveShellAndPositionOnTheSameFrames(NotchEdge source, NotchEdge target, bool island)
        => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(source, island);
        var w = fixture.Window; w.Show();
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
        var screen = Screen(w);
        var input = new DockPointerState(Center(w), true, true, false);
        w.DockPointerReader = () => input;
        Press(w);
        input = input with { Position = Target(screen, target) + new Vector(target == NotchEdge.Top ? 80 : 0, 35) };
        await WpfFrameWaiter.UntilAsync(() => (Center(w) - input.Position).Length < 2, "drag follows", ct);
        var start = Center(w);
        var fromSize = w.NotchBorder.RenderSize;
        var fromRadius = w.NotchBorder.CornerRadius;
        input = input with { LeftDown = false, ControlDown = false };
        typeof(MainWindow).GetMethod("EndDockDrag", Private)!.Invoke(w, null);
        w.UpdateLayout();
        Assert.True(w.IsDockMoveInProgress);
        Assert.InRange((Center(w) - start).Length, 0, 2);
        Assert.Equal(fromSize.Width, w.NotchBorder.Width);
        Assert.Equal(fromSize.Height, w.NotchBorder.Height);
        Assert.Equal(fromRadius, w.NotchBorder.CornerRadius);
        Assert.Equal(0, w.NotchLiveContent.Opacity);
        Assert.Equal(0, w.LeftEar.Opacity);

        var frames = new List<(Point Center, Size Size, CornerRadius Radius)>();
        bool saved = false;
        await WpfFrameWaiter.UntilAsync(() =>
        {
            w.UpdateLayout();
            frames.Add((Center(w), w.NotchBorder.RenderSize, w.NotchBorder.CornerRadius));
            if (!saved && w.NotchBorder.ActualWidth is > 95 and < 185)
            {
                SideDockWindowTests.Save(w.NotchWrapper, $"dock-morph-{source}-{target}-{island}.png", System.Windows.Media.Brushes.DimGray);
                saved = true;
            }
            return !w.IsDockMoveInProgress;
        }, "morph and host land together", ct);
        var end = Center(w);
        var toSize = w.NotchBorder.RenderSize;
        var toRadius = w.NotchBorder.CornerRadius;
        Assert.True(frames.Count >= 3, "Landing must contain intermediate painted frames.");
        foreach (var frame in frames)
        {
            Assert.InRange(frame.Size.Width, Math.Min(fromSize.Width, toSize.Width) - .01, Math.Max(fromSize.Width, toSize.Width) + .01);
            Assert.InRange(frame.Size.Height, Math.Min(fromSize.Height, toSize.Height) - .01, Math.Max(fromSize.Height, toSize.Height) + .01);
            if (Math.Abs(fromSize.Width - toSize.Width) < 1) continue;
            double t = (frame.Size.Width - fromSize.Width) / (toSize.Width - fromSize.Width);
            Assert.InRange((frame.Center - (start + (end - start) * t)).Length, 0, 3);
            Assert.InRange(Math.Abs(frame.Radius.TopLeft - (fromRadius.TopLeft + (toRadius.TopLeft - fromRadius.TopLeft) * t)), 0, .01);
        }
        AssertCentred(w, target, screen);
        Assert.Null(typeof(MainWindow).GetField("_dockLandingRendering", Private)!.GetValue(w));
        await WpfFrameWaiter.UntilAsync(() => w.NotchLiveContent.Opacity >= .999, "foreground returns", ct);
        Assert.InRange(Math.Abs(w.LeftEar.Opacity - (double)w.LeftEar.GetAnimationBaseValue(UIElement.OpacityProperty)), 0, .001);
        Assert.True(w.NotchBorder.IsHitTestVisible);
    });

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public void ANewGrabInterruptsTheLandingWithoutSnappingOrLeavingAnIntermediateShape(bool moveAgain)
        => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(NotchEdge.Top);
        var w = fixture.Window; w.Show();
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
        var screen = Screen(w);
        var input = new DockPointerState(Center(w), true, true, false);
        w.DockPointerReader = () => input;
        Press(w);
        input = input with { Position = Target(screen, NotchEdge.Left), LeftDown = false };
        await WpfFrameWaiter.UntilAsync(() => w.NotchBorder.ActualWidth is > 70 and < 210 && w.IsDockMoveInProgress,
            "first landing has a live intermediate shape", ct);
        var width = w.NotchBorder.ActualWidth;
        var center = Center(w);
        input = input with { Position = center, LeftDown = true };
        Press(w);
        Assert.Equal(width, w.NotchBorder.Width);
        Assert.InRange((Center(w) - center).Length, 0, 2);
        if (moveAgain)
        {
            input = input with { Position = Target(screen, NotchEdge.Right) };
            await WpfFrameWaiter.UntilAsync(() => (Center(w) - input.Position).Length < 2, "new grab follows", ct);
        }
        input = input with { LeftDown = false, ControlDown = false };
        await WpfFrameWaiter.UntilAsync(() => !w.IsDockMoveInProgress && !Animating(w), "new landing settles", ct);
        Assert.Equal(moveAgain ? NotchEdge.Right : NotchEdge.Left, w.DockEdge);
        AssertCentred(w, w.DockEdge, screen);
        Assert.Null(typeof(MainWindow).GetField("_dockLandingRendering", Private)!.GetValue(w));
        await WpfFrameWaiter.UntilAsync(() => w.NotchLiveContent.Opacity >= .999, "foreground restores after interruption", ct);
    });

    [Fact]
    public void ReducedMotionLandsImmediatelyAndClosingDuringMotionDetachesTheFrameHandler()
        => SharedStaTestRunner.RunAsync(async ct =>
    {
        bool previous = AnimationConfig.ReduceMotion;
        try
        {
            await using var fixture = Fixture(NotchEdge.Top);
            var w = fixture.Window; w.Show();
            await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
            w.DockPointerReader = () => new DockPointerState(new Point(500, 300), false, false, false);
            AnimationConfig.SetReduceMotion(true);
            w.MoveDockTo(NotchEdge.Left);
            Assert.False(w.IsDockMoveInProgress);
            AssertCentred(w, NotchEdge.Left, Screen(w));
            Assert.Equal(1, w.NotchLiveContent.Opacity);
            AnimationConfig.SetReduceMotion(false);
            w.MoveDockTo(NotchEdge.Top);
            await WpfFrameWaiter.UntilAsync(() => w.NotchBorder.ActualWidth is > 70 and < 210, "menu morph starts", ct);
            w.Close();
            Assert.False(w.IsDockMoveInProgress);
            Assert.Null(typeof(MainWindow).GetField("_dockLandingRendering", Private)!.GetValue(w));
        }
        finally { AnimationConfig.SetReduceMotion(previous); }
    });

    [Theory]
    [InlineData(NotchEdge.Top, NotchEdge.Right)]
    [InlineData(NotchEdge.Right, NotchEdge.Left)]
    [InlineData(NotchEdge.Left, NotchEdge.Top)]
    public void MusicReturnsInsideTheNewShellAndCanStillExpandAfterMoving(NotchEdge source, NotchEdge target)
        => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(source);
        var w = fixture.Window;
        await NotchRevealMotionTests.StartMusic(w, ct);
        var artwork = w.CompactThumbnail.Source;
        var screen = Screen(w);
        var input = new DockPointerState(Center(w), true, true, false);
        w.DockPointerReader = () => input;
        Press(w);
        input = input with { Position = Target(screen, target), LeftDown = false, ControlDown = false };
        await WpfFrameWaiter.UntilAsync(() => !w.IsDockMoveInProgress && !Animating(w) && w.NotchLiveContent.Opacity >= .999,
            "music landing settles", ct);
        AssertCentred(w, target, screen);
        Assert.Same(artwork, w.CompactThumbnail.Source);
        Assert.Equal(Visibility.Visible, w.MusicCompactContent.Visibility);
        var cover = w.CompactThumbnailBorder.TransformToVisual(w.NotchBorder)
            .TransformBounds(new Rect(w.CompactThumbnailBorder.RenderSize));
        Assert.InRange(cover.Left, -1, w.NotchBorder.ActualWidth);
        Assert.InRange(cover.Right, 0, w.NotchBorder.ActualWidth + 1);
        Assert.InRange(cover.Top, -1, w.NotchBorder.ActualHeight);
        Assert.InRange(cover.Bottom, 0, w.NotchBorder.ActualHeight + 1);
        SideDockWindowTests.Save(w.NotchWrapper, $"dock-music-landed-{source}-{target}.png", System.Windows.Media.Brushes.DimGray);
        Coordinator(w).RequestView(NotchView.Media, "expand after moving");
        await WpfFrameWaiter.UntilAsync(() => !Animating(w) && Coordinator(w).CurrentView == NotchView.Media,
            "music expands after landing", ct);
        Assert.Equal(1, w.NotchLiveContent.Opacity);
        Assert.True(w.NotchBorder.IsHitTestVisible);
        Assert.Equal(NotchDock.IsVertical(target), w.MediaPlayback.CentreInColumn);
    });

    [Theory]
    [InlineData(NotchEdge.Top, NotchEdge.Left)]
    [InlineData(NotchEdge.Left, NotchEdge.Top)]
    public void MusicBeginningDuringLandingDoesNotTakeOverTheShellAnimation(NotchEdge source, NotchEdge target)
        => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(source);
        var w = fixture.Window; w.Show();
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
        var screen = Screen(w);
        var input = new DockPointerState(Center(w), true, true, false);
        w.DockPointerReader = () => input;
        Press(w);
        input = input with { Position = Target(screen, target), LeftDown = false, ControlDown = false };
        await WpfFrameWaiter.UntilAsync(() => typeof(MainWindow).GetField("_dockLandingRendering", Private)!.GetValue(w) != null,
            "landing starts", ct);
        typeof(MainWindow).GetMethod("ApplyMediaUpdate", Private)!.Invoke(w, new object[] { new MediaInfo
        {
            CurrentTrack = "Music starts during docking", CurrentArtist = "Motion study", MediaSource = "Browser", SourceAppId = "Test",
            IsAnyMediaPlaying = true, IsPlaying = true
        }});
        Assert.False(DependencyPropertyHelper.GetValueSource(w.NotchBorder, FrameworkElement.WidthProperty).IsAnimated,
            "A media width clock must not compete with the docking frame.");
        await WpfFrameWaiter.UntilAsync(() => !w.IsDockMoveInProgress && !Animating(w), "music and docking settle", ct);
        AssertCentred(w, target, screen);
        await WpfFrameWaiter.UntilAsync(() => w.NotchLiveContent.Opacity >= .999, "live media returns", ct);
        Assert.Equal(Visibility.Visible, w.MusicCompactContent.Visibility);
    });

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public void HidingDuringADragOrLandingCannotLeaveMoveHooksOrInvisibleContent(bool landing)
        => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(NotchEdge.Top);
        var w = fixture.Window; w.Show();
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
        var screen = Screen(w);
        var input = new DockPointerState(Center(w), true, true, false);
        w.DockPointerReader = () => input;
        if (landing)
        {
            w.MoveDockTo(NotchEdge.Left);
            await WpfFrameWaiter.UntilAsync(() => w.NotchBorder.ActualWidth is > 70 and < 210, "landing is mid-flight", ct);
            Assert.Equal(Visibility.Collapsed, w.NotchLiveContent.Visibility);
        }
        else
        {
            Press(w);
            Assert.NotNull(typeof(MainWindow).GetField("_dockDragRendering", Private)!.GetValue(w));
            input = input with { Position = Target(screen, NotchEdge.Left) };
            await WpfFrameWaiter.UntilAsync(() => (Center(w) - input.Position).Length < 2, "drag is active", ct);
        }
        w.Hide();
        // Rendering may cease entirely for a hidden/occluded overlay. Its
        // low-frequency watchdog still has to end the physical gesture.
        await Task.Delay(300, ct);
        Assert.False(w.IsDockMoveInProgress);
        Assert.Null(typeof(MainWindow).GetField("_dockDragRendering", Private)!.GetValue(w));
        Assert.Null(typeof(MainWindow).GetField("_dockLandingRendering", Private)!.GetValue(w));
        Assert.False(((DispatcherTimer)typeof(MainWindow).GetField("_dockDragTimer", Private)!.GetValue(w)!).IsEnabled);
        Assert.Equal(Visibility.Visible, w.NotchLiveContent.Visibility);
        input = input with { LeftDown = false, ControlDown = false };
        w.Show();
        await WpfFrameWaiter.NextAsync(ct);
        AssertCentred(w, landing ? NotchEdge.Left : NotchEdge.Top, screen);
        Assert.Equal(1, w.NotchLiveContent.Opacity);
    });

    [Theory]
    [InlineData(NotchEdge.Top)] [InlineData(NotchEdge.Left)] [InlineData(NotchEdge.Right)]
    public void ADragWithinTheSameEdgeKeepsItsArtworkVisible(NotchEdge edge)
        => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(edge);
        var w = fixture.Window;
        await NotchRevealMotionTests.StartMusic(w, ct);
        var screen = Screen(w);
        var input = new DockPointerState(Center(w), true, true, false);
        w.DockPointerReader = () => input;
        Press(w);
        input = input with { Position = Target(screen, edge) + (edge == NotchEdge.Top ? new Vector(80, 0) : new Vector(0, 80)) };
        await WpfFrameWaiter.UntilAsync(() => (Center(w) - input.Position).Length < 2, "same edge follows", ct);
        Assert.Equal(Visibility.Visible, w.NotchLiveContent.Visibility);
        Assert.Equal(1, w.NotchLiveContent.Opacity);
        input = input with { LeftDown = false, ControlDown = false };
        typeof(MainWindow).GetMethod("EndDockDrag", Private)!.Invoke(w, null);
        Assert.Equal(Visibility.Visible, w.NotchLiveContent.Visibility);
        Assert.Equal(1, w.NotchLiveContent.Opacity);
        await WpfFrameWaiter.UntilAsync(() => !w.IsDockMoveInProgress, "same edge settles", ct);
        AssertCentred(w, edge, screen);
        Assert.Equal(1, w.NotchLiveContent.Opacity);
        Assert.Null(typeof(MainWindow).GetField("_dockDragRendering", Private)!.GetValue(w));
    });

    [Fact]
    public void AQueuedOldRenderingCallbackCannotCancelANewerLanding()
        => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(NotchEdge.Top);
        var w = fixture.Window; w.Show();
        w.DockPointerReader = () => new DockPointerState(new Point(500, 400), false, false, false);
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
        w.MoveDockTo(NotchEdge.Left);
        await WpfFrameWaiter.UntilAsync(() => w.NotchBorder.ActualWidth is > 70 and < 210, "first landing", ct);
        var field = typeof(MainWindow).GetField("_dockLandingRendering", Private)!;
        var oldCallback = (EventHandler)field.GetValue(w)!;
        w.MoveDockTo(NotchEdge.Right);
        var currentCallback = field.GetValue(w);
        Assert.NotNull(currentCallback);
        oldCallback(null, EventArgs.Empty);
        Assert.Same(currentCallback, field.GetValue(w));
        Assert.True(w.IsDockMoveInProgress);
        await WpfFrameWaiter.UntilAsync(() => !w.IsDockMoveInProgress, "latest landing completes", ct);
        AssertCentred(w, NotchEdge.Right, Screen(w));
        Assert.Null(field.GetValue(w));
    });

    private static GreetingAcceptanceTests.MainWindowFixture Fixture(NotchEdge edge, bool island = true) => new("en", false,
        s => { s.EnableEdgeDocking = true; s.DockEdge = edge; s.EnableDynamicIslandMode = island; s.Width = 240; s.Height = 40;
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
