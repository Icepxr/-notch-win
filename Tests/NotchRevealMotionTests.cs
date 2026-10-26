using System.Reflection;
using System.Windows;
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
public sealed class NotchRevealMotionTests
{
    private const BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;

    [Theory]
    [InlineData(NotchEdge.Top, false)] [InlineData(NotchEdge.Top, true)]
    [InlineData(NotchEdge.Left, false)] [InlineData(NotchEdge.Left, true)]
    [InlineData(NotchEdge.Right, false)] [InlineData(NotchEdge.Right, true)]
    public void CoversKeepTheirScreenAnchorsThroughoutOpenAndClose(NotchEdge edge, bool island) => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(edge, island);
        var w = fixture.Window;
        await StartMusic(w, ct);
        var compact = Box(w.CompactThumbnailBorder);
        var coordinator = Coordinator(w);
        coordinator.RequestView(NotchView.Media, "artwork-open");
        var opening = await Capture(w, ct);
        var expanded = Box(w.ThumbnailBorder);
        Assert.True(opening.Count >= 2, "Sample real intermediate WPF frames.");
        AssertStable(opening, expanded, compact);
        AssertMonotonic(opening, growing: true);
        SideDockWindowTests.Save(w.NotchWrapper, $"reveal-{edge}-{island}-open.png");
        coordinator.RequestCollapse("artwork-close");
        var closing = await Capture(w, ct);
        AssertStable(closing, expanded, compact);
        AssertMonotonic(closing, growing: false);
        AssertBox(compact, Box(w.CompactThumbnailBorder), "settled compact cover");
        Assert.Equal(Visibility.Collapsed, w.AnimationThumbnailBorder.Visibility);
        Assert.True(w.NotchBorder.IsHitTestVisible);
        Assert.Equal(NotchView.Compact, coordinator.CurrentView);
    });

    [Theory]
    [InlineData(NotchEdge.Top)] [InlineData(NotchEdge.Left)] [InlineData(NotchEdge.Right)]
    public void ReversingMidFlightKeepsLiveOpacityAndOnlyTheLastTransitionCompletes(NotchEdge edge) => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(edge, true);
        var w = fixture.Window;
        await StartMusic(w, ct);
        var coordinator = Coordinator(w);
        coordinator.RequestView(NotchView.Media, "interrupted-open");
        await WpfFrameWaiter.UntilAsync(() => w.ExpandedContent.Opacity > .2, "media entering", ct);
        await ReverseAndAssertContinuity(w, () => coordinator.RequestCollapse("reverse-before-open-finishes"));
        await WpfFrameWaiter.NextAsync(ct);
        await ReverseAndAssertContinuity(w, () => coordinator.RequestView(NotchView.Media, "reverse-before-close-finishes"));
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "last open settles", ct);
        // Give canceled callbacks time to fire; they must not hide the new view.
        await Task.Delay(400, ct);
        Assert.Equal(NotchView.Media, coordinator.CurrentView);
        Assert.False(coordinator.IsTransitionActive);
        Assert.Equal(1, w.ExpandedContent.Opacity);
        Assert.Equal(1, w.ThumbnailBorder.Opacity);
        Assert.Equal(Visibility.Collapsed, w.AnimationThumbnailBorder.Visibility);
        Assert.True(w.NotchBorder.IsHitTestVisible);
    });

    [Theory]
    [InlineData(NotchEdge.Top)] [InlineData(NotchEdge.Left)] [InlineData(NotchEdge.Right)]
    public void ReducedMotionDoesNotLeaveAnOverlayOrDelayedContent(NotchEdge edge) => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(edge, true);
        var w = fixture.Window;
        await StartMusic(w, ct);
        bool previous = AnimationConfig.ReduceMotion;
        try
        {
            AnimationConfig.SetReduceMotion(true);
            Coordinator(w).RequestView(NotchView.Media, "reduced-open");
            await WpfFrameWaiter.UntilAsync(() => !Animating(w), "reduced open", ct);
            Assert.Equal(1, w.ExpandedContent.Opacity);
            Assert.Equal(1, w.ThumbnailBorder.Opacity);
            Assert.False(DependencyPropertyHelper.GetValueSource(w, MainWindow.CurrentCornerRadiusProperty).IsAnimated);
            Coordinator(w).RequestCollapse("reduced-close");
            await System.Windows.Threading.Dispatcher.Yield(System.Windows.Threading.DispatcherPriority.Input);
            Assert.False(Animating(w));
            Assert.Equal(1, w.MusicCompactContent.Opacity);
            Assert.Equal(Visibility.Collapsed, w.AnimationThumbnailBorder.Visibility);
            Assert.True(w.NotchBorder.IsHitTestVisible);
            Assert.False(DependencyPropertyHelper.GetValueSource(w, MainWindow.CurrentCornerRadiusProperty).IsAnimated);
        }
        finally { AnimationConfig.SetReduceMotion(previous); }
    });

    private static async Task StartMusic(MainWindow w, CancellationToken ct)
    {
        w.Show();
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
        var image = new BitmapImage(new Uri(System.IO.Path.Combine(AppContext.BaseDirectory, "Fixtures", "dark-textured-artwork.png")));
        image.Freeze();
        typeof(MainWindow).GetMethod("ApplyMediaUpdate", Private)!.Invoke(w, new object[] { new MediaInfo
        {
            CurrentTrack = "Still artwork", CurrentArtist = "Motion study", MediaSource = "Browser", SourceAppId = "Test",
            IsAnyMediaPlaying = true, IsPlaying = true, Thumbnail = image
        }});
        await WpfFrameWaiter.UntilAsync(() => !Animating(w) && w.CompactThumbnailBorder.Opacity == 1 && w.NotchScale.ScaleX == 1, "compact music", ct);
        w.UpdateLayout();
    }

    private sealed record Frame(double Width, double Height, Rect? Expanded, Rect? Compact);

    private static async Task ReverseAndAssertContinuity(MainWindow w, Action request)
    {
        // Capture immediately before the queued input operation executes, not
        // one frame before it. Rendering may legitimately advance while queued.
        double width = double.NaN, opacity = double.NaN, radius = double.NaN;
        void Starting(object? sender, System.Windows.Threading.DispatcherHookEventArgs e)
        {
            if (e.Operation.Priority != System.Windows.Threading.DispatcherPriority.Input || !double.IsNaN(width)) return;
            width = w.NotchBorder.Width;
            opacity = w.ExpandedContent.Visibility == Visibility.Visible ? w.ExpandedContent.Opacity : 0;
            radius = w.CurrentCornerRadius;
        }
        w.Dispatcher.Hooks.OperationStarted += Starting;
        try
        {
            request();
            await System.Windows.Threading.Dispatcher.Yield(System.Windows.Threading.DispatcherPriority.Input);
            Assert.False(double.IsNaN(width));
            Assert.InRange(Math.Abs((double)w.NotchBorder.GetAnimationBaseValue(FrameworkElement.WidthProperty) - width), 0, .01);
            Assert.InRange(Math.Abs((double)w.ExpandedContent.GetAnimationBaseValue(UIElement.OpacityProperty) - opacity), 0, .01);
            Assert.InRange(Math.Abs((double)w.GetAnimationBaseValue(MainWindow.CurrentCornerRadiusProperty) - radius), 0, .01);
        }
        finally { w.Dispatcher.Hooks.OperationStarted -= Starting; }
    }

    private static async Task<List<Frame>> Capture(MainWindow w, CancellationToken ct)
    {
        var frames = new List<Frame>();
        do
        {
            await WpfFrameWaiter.NextAsync(ct);
            frames.Add(new(w.NotchBorder.Width, w.NotchBorder.Height,
                w.ExpandedContent.Visibility == Visibility.Visible && w.ExpandedContent.Opacity > .01 ? Box(w.ThumbnailBorder) : null,
                w.MusicCompactContent.Visibility == Visibility.Visible && w.MusicCompactContent.Opacity > .01 ? Box(w.CompactThumbnailBorder) : null));
            Assert.Equal(Visibility.Collapsed, w.AnimationThumbnailBorder.Visibility);
        } while (Animating(w));
        return frames;
    }

    private static void AssertStable(List<Frame> frames, Rect expanded, Rect compact)
    {
        foreach (var frame in frames)
        {
            if (frame.Expanded is Rect e) AssertBox(expanded, e, "expanded cover");
            if (frame.Compact is Rect c) AssertBox(compact, c, "compact cover");
        }
    }

    private static void AssertMonotonic(List<Frame> frames, bool growing)
    {
        for (int i = 1; i < frames.Count; i++)
        {
            double direction = growing ? 1 : -1;
            Assert.True(direction * (frames[i].Width - frames[i - 1].Width) >= -.1, "Width must never spring past its destination.");
            Assert.True(direction * (frames[i].Height - frames[i - 1].Height) >= -.1, "Height must never spring past its destination.");
        }
    }

    private static void AssertBox(Rect expected, Rect actual, string label)
    {
        Assert.True((expected.TopLeft - actual.TopLeft).Length <= 1.5, $"{label} moved: {expected} -> {actual}");
        Assert.InRange(Math.Abs(expected.Width - actual.Width), 0, 1);
        Assert.InRange(Math.Abs(expected.Height - actual.Height), 0, 1);
    }

    private static Rect Box(FrameworkElement e) => new(e.PointToScreen(new Point()), new Size(e.ActualWidth, e.ActualHeight));
    private static bool Animating(MainWindow w) => (bool)typeof(MainWindow).GetProperty("_isAnimating", Private)!.GetValue(w)!;
    private static NotchTransitionCoordinator Coordinator(MainWindow w) => (NotchTransitionCoordinator)typeof(MainWindow).GetField("_transitionCoordinator", Private)!.GetValue(w)!;
    private static GreetingAcceptanceTests.MainWindowFixture Fixture(NotchEdge edge, bool island) => new("en", false,
        s => { s.EnableEdgeDocking = true; s.DockEdge = edge; s.EnableDynamicIslandMode = island;
            s.DynamicIslandWidth = 240; s.DynamicIslandHeight = 40; s.Width = 240;
            s.EnableLocalOnlyMode = true; s.AutoCheckUpdates = false; s.DisableMouseLeaveAutoClose = true; s.EnableHoverExpand = false; },
        services => services.AddSingleton<IMediaDetectionService>(new FakeMediaDetectionService()));
}
