using System.Reflection;
using System.Windows;
using VNotch.Models;
using VNotch.Services;
using Xunit;
using static VNotch.Tests.DockDragWindowTests;

namespace VNotch.Tests;

[Collection("Localization")]
public sealed class DockDragLivePreviewTests
{
    private const BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;

    [Theory]
    [InlineData(NotchEdge.Top, NotchEdge.Left, true)]
    [InlineData(NotchEdge.Top, NotchEdge.Right, true)]
    [InlineData(NotchEdge.Left, NotchEdge.Top, true)]
    [InlineData(NotchEdge.Right, NotchEdge.Top, true)]
    [InlineData(NotchEdge.Left, NotchEdge.Right, true)]
    [InlineData(NotchEdge.Right, NotchEdge.Left, true)]
    [InlineData(NotchEdge.Top, NotchEdge.Left, false)]
    [InlineData(NotchEdge.Right, NotchEdge.Top, false)]
    public void ShapeSettlesAtTheCandidateWhileTheButtonIsStillHeld(NotchEdge source, NotchEdge target, bool island)
        => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(source, island);
        var w = fixture.Window; w.Show();
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
        var grip = new Point(.18, .77);
        var input = new DockPointerState(Grab(w, grip), true, true, false);
        w.DockPointerReader = () => input;
        Press(w);
        input = input with { Position = Target(Screen(w), target), ControlDown = false };
        var expected = NotchDock.CollapsedSize(target, 240, 40);
        var samples = new List<Size>();
        await WpfFrameWaiter.UntilAsync(() =>
        {
            w.UpdateLayout();
            samples.Add(w.NotchBorder.RenderSize);
            Assert.Equal(source, w.DockEdge); // Preview never commits settings.
            if (PreviewTarget(w) != null)
                Assert.InRange((Grab(w, grip) - input.Position).Length, 0, 2);
            return PreviewTarget(w) == target && Close(w.NotchBorder.RenderSize, expected);
        }, "candidate shape appears before release", ct);
        Assert.True(input.LeftDown);
        Assert.True(w.IsDockMoveInProgress);
        Assert.InRange((Grab(w, grip) - input.Position).Length, 0, 2);
        if (NotchDock.IsVertical(source) != NotchDock.IsVertical(target))
            Assert.Contains(samples, size => size.Width is > 50 and < 230);
        // Include both the material and shadow siblings. Capturing only the
        // foreground wrapper omits the black shell's composited backing.
        var capture = w.NotchBorder.TransformToVisual(w.NotchContainer).TransformBounds(new Rect(w.NotchBorder.RenderSize));
        var snapshot = SideDockWindowTests.Save(w.NotchContainer, $"live-held-{source}-{target}-{island}.png",
            System.Windows.Media.Brushes.DimGray, capture);
        var centerPixel = new byte[4];
        snapshot.CopyPixels(new Int32Rect(snapshot.PixelWidth / 2, snapshot.PixelHeight / 2, 1, 1), centerPixel, 4, 0);
        Assert.True(centerPixel[0] < 64 && centerPixel[1] < 64 && centerPixel[2] < 64,
            "The held preview must paint the dark shell at its centre, not only change layout bounds.");
        var held = w.NotchBorder.RenderSize;
        var corners = w.NotchBorder.CornerRadius;
        input = input with { LeftDown = false };
        typeof(MainWindow).GetMethod("EndDockDrag", Private)!.Invoke(w, null);
        Assert.Equal(held.Width, w.NotchBorder.Width);
        Assert.Equal(held.Height, w.NotchBorder.Height);
        Assert.Equal(corners, w.NotchBorder.CornerRadius);
        await WpfFrameWaiter.UntilAsync(() => !w.IsDockMoveInProgress, "release only lands", ct);
        AssertCentred(w, target, Screen(w));
    });

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public void AReversalOrEscapeReturnsFromTheLivePreviewWithoutAnOriginalSizeFlash(bool escape)
        => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(NotchEdge.Top);
        var w = fixture.Window;
        await NotchRevealMotionTests.StartMusic(w, ct);
        var input = new DockPointerState(Center(w), true, true, false);
        w.DockPointerReader = () => input;
        Press(w);
        input = input with { Position = Target(Screen(w), NotchEdge.Left) };
        await WpfFrameWaiter.UntilAsync(() => PreviewTarget(w) == NotchEdge.Left && w.NotchBorder.ActualWidth is > 70 and < 190,
            "live side morph is mid-flight", ct);
        if (escape) input = input with { EscapeDown = true };
        else
        {
            input = input with { Position = Target(Screen(w), NotchEdge.Top) };
            await WpfFrameWaiter.UntilAsync(() => PreviewTarget(w) == NotchEdge.Top && Close(w.NotchBorder.RenderSize, new Size(240, 40)),
                "dragging back restores the capsule while held", ct);
            Assert.True(input.LeftDown);
            await WpfFrameWaiter.UntilAsync(() => w.NotchLiveContent.Opacity >= .999, "artwork returns while held", ct);
            Assert.Equal(Visibility.Visible, w.NotchLiveContent.Visibility);
            input = input with { LeftDown = false, ControlDown = false };
        }
        await WpfFrameWaiter.UntilAsync(() => !w.IsDockMoveInProgress && !Animating(w), "original dock restored", ct);
        Assert.Equal(NotchEdge.Top, w.DockEdge);
        AssertCentred(w, NotchEdge.Top, Screen(w));
        await WpfFrameWaiter.UntilAsync(() => w.NotchLiveContent.Opacity >= .999, "foreground restores", ct);
    });

    [Fact]
    public void ALongCapsuleHasSurfaceRoomWhenPreviewedFromASide()
        => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(NotchEdge.Right, width: 700);
        var w = fixture.Window; w.Show();
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
        var originalHostWidth = w.Width;
        var input = new DockPointerState(Center(w), true, true, false);
        w.DockPointerReader = () => input;
        Press(w);
        input = input with { Position = Target(Screen(w), NotchEdge.Top) };
        await WpfFrameWaiter.UntilAsync(() => PreviewTarget(w) == NotchEdge.Top && Close(w.NotchBorder.RenderSize, new Size(700, 40)),
            "long horizontal preview fits", ct);
        Assert.True(w.Width >= 700);
        Assert.InRange((Center(w) - input.Position).Length, 0, 2);
        input = input with { EscapeDown = true };
        await WpfFrameWaiter.UntilAsync(() => !w.IsDockMoveInProgress, "cancel restores original host", ct);
        Assert.Equal(originalHostWidth, w.Width);
        AssertCentred(w, NotchEdge.Right, Screen(w));
    });

    [Theory]
    [InlineData(NotchEdge.Top, NotchEdge.Right)]
    [InlineData(NotchEdge.Left, NotchEdge.Top)]
    public void ReducedMotionStillPreviewsBeforeRelease(NotchEdge source, NotchEdge target)
        => SharedStaTestRunner.RunAsync(async ct =>
    {
        bool previous = AnimationConfig.ReduceMotion;
        try
        {
            await using var fixture = Fixture(source);
            var w = fixture.Window; w.Show();
            await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
            AnimationConfig.SetReduceMotion(true);
            var input = new DockPointerState(Center(w), true, true, false);
            w.DockPointerReader = () => input;
            Press(w);
            input = input with { Position = Target(Screen(w), target) };
            await WpfFrameWaiter.UntilAsync(() => PreviewTarget(w) == target && Close(w.NotchBorder.RenderSize, NotchDock.CollapsedSize(target, 240, 40)),
                "reduced-motion preview appears while held", ct);
            Assert.True(input.LeftDown);
            Assert.Equal(source, w.DockEdge);
            input = input with { LeftDown = false, ControlDown = false };
            await WpfFrameWaiter.UntilAsync(() => !w.IsDockMoveInProgress, "reduced-motion release", ct);
            AssertCentred(w, target, Screen(w));
        }
        finally { AnimationConfig.SetReduceMotion(previous); }
    });

    [Fact]
    public void ReleasingHalfwayThroughThePreviewContinuesFromItsLiveSize()
        => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(NotchEdge.Top);
        var w = fixture.Window; w.Show();
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
        var input = new DockPointerState(Center(w), true, true, false);
        w.DockPointerReader = () => input;
        Press(w);
        input = input with { Position = Target(Screen(w), NotchEdge.Right) };
        await WpfFrameWaiter.UntilAsync(() => PreviewTarget(w) == NotchEdge.Right && w.NotchBorder.ActualWidth is > 75 and < 195,
            "live preview is mid-morph", ct);
        var size = w.NotchBorder.RenderSize;
        var center = Center(w);
        input = input with { LeftDown = false, ControlDown = false };
        typeof(MainWindow).GetMethod("EndDockDrag", Private)!.Invoke(w, null);
        Assert.Equal(size.Width, w.NotchBorder.Width);
        Assert.Equal(size.Height, w.NotchBorder.Height);
        w.UpdateLayout();
        Assert.InRange((Center(w) - center).Length, 0, 2);
        await WpfFrameWaiter.UntilAsync(() => !w.IsDockMoveInProgress, "mid-preview release completes", ct);
        AssertCentred(w, NotchEdge.Right, Screen(w));
    });

    private static Point Grab(MainWindow w, Point fraction) => w.NotchBorder.PointToScreen(
        new Point(w.NotchBorder.ActualWidth * fraction.X, w.NotchBorder.ActualHeight * fraction.Y));
    private static NotchEdge? PreviewTarget(MainWindow w) =>
        (NotchEdge?)typeof(MainWindow).GetField("_dockPreviewTarget", Private)!.GetValue(w);
    private static bool Close(Size actual, Size expected) =>
        Math.Abs(actual.Width - expected.Width) < .01 && Math.Abs(actual.Height - expected.Height) < .01;
}
