using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text.Json;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using VNotch.Models;
using VNotch.Services;
using VNotch.Tests.Fixtures;
using Xunit;
using Xunit.Abstractions;
using static VNotch.Tests.DockDragWindowTests;

namespace VNotch.Tests;

[Collection("Localization")]
public sealed class FrameWorkReuseTests(ITestOutputHelper output)
{
    private const BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;

    [Theory]
    [InlineData(NotchEdge.Top)] [InlineData(NotchEdge.Left)]
    public void MeasureStationaryHeldPointerWork(NotchEdge edge) => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(edge);
        var w = fixture.Window; w.Show();
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
        var input = new DockPointerState(Center(w), true, true, false);
        w.DockPointerReader = () => input;
        Press(w);
        input = input with { Position = input.Position + (edge == NotchEdge.Top ? new Vector(40, 5) : new Vector(5, 40)) };
        await WpfFrameWaiter.UntilAsync(() => (Center(w) - input.Position).Length < 2, "held pointer settles", ct);
        w.UpdateLayout();
        var tick = (Func<TimeSpan?, bool>)typeof(MainWindow).GetMethod("ContinueDockDrag", Private)!
            .CreateDelegate(typeof(Func<TimeSpan?, bool>), w);
        for (int i = 0; i < 30; i++) tick(TimeSpan.FromSeconds(10));
        const int iterations = 5000;
        long allocated = GC.GetAllocatedBytesForCurrentThread();
        var clock = Stopwatch.StartNew();
        for (int i = 0; i < iterations; i++) tick(TimeSpan.FromSeconds(10));
        clock.Stop();
        WriteReport($"stationary-{edge}", new { iterations, MicrosecondsPerTick = clock.Elapsed.TotalMicroseconds / iterations,
            BytesPerTick = (GC.GetAllocatedBytesForCurrentThread() - allocated) / (double)iterations });
        input = input with { LeftDown = false, ControlDown = false };
        await WpfFrameWaiter.UntilAsync(() => !w.IsDockMoveInProgress, "release", ct);
        AssertCentred(w, edge, Screen(w));
    });

    [Fact]
    public void MeasureInterleavedClipWork()
    {
        var sizes = new[] { new Size(240, 40), new Size(40, 60), new Size(640, 350), new Size(320, 420) };
        var powers = new[] { 2d, 3, 4, 1.5 };
        for (int i = 0; i < 16; i++) GlassClipBuilder.CreateClip(sizes[i % 4], new CornerRadius(20), powers[i % 4]);
        const int iterations = 2000;
        long allocated = GC.GetAllocatedBytesForCurrentThread();
        var clock = Stopwatch.StartNew();
        for (int i = 0; i < iterations; i++) GlassClipBuilder.CreateClip(sizes[i % 4], new CornerRadius(20), powers[i % 4]);
        clock.Stop();
        WriteReport("interleaved-clips", new { iterations, MicrosecondsPerCall = clock.Elapsed.TotalMicroseconds / iterations,
            BytesPerCall = (GC.GetAllocatedBytesForCurrentThread() - allocated) / (double)iterations });
    }

    [Fact]
    public void InterleavedClipsReuseFrozenResourcesAndEvictOldEntries()
    {
        var shapes = Enumerable.Range(0, 4).Select(i => new Size(411 + i, 73 + i)).ToArray();
        var clips = shapes.Select(size => GlassClipBuilder.CreateClip(size, new CornerRadius(19), 3)!).ToArray();
        for (int loop = 0; loop < 5; loop++)
        for (int i = 0; i < 4; i++) Assert.Same(clips[i], GlassClipBuilder.CreateClip(shapes[i], new CornerRadius(19), 3));
        Assert.All(clips, clip => Assert.True(clip.IsFrozen));
        for (int i = 0; i < 5; i++) GlassClipBuilder.CreateClip(new Size(800 + i, 91), new CornerRadius(17), 4);
        Assert.NotSame(clips[0], GlassClipBuilder.CreateClip(shapes[0], new CornerRadius(19), 3));
    }

    [Fact]
    public void EquivalentClampedRadiiAndCircularPowersShareTheSameSilhouette()
    {
        var size = new Size(101, 42);
        var original = GlassClipBuilder.CreateClip(size, new CornerRadius(900), 2)!;
        Assert.Same(original, GlassClipBuilder.CreateClip(size, new CornerRadius(21), 2.005));
        Assert.Same(original, GlassClipBuilder.CreateClip(size, new CornerRadius(700), 1.995));
        Assert.Equal(BaselineGlassClipBuilder.CreateClip(size, new CornerRadius(700), 1.995)!.ToString(), original.ToString());
    }

    [Theory]
    [InlineData(96)] [InlineData(144)] [InlineData(192)]
    public void ReusedClipPixelsMatchThePreservedRenderer(double dpi) => SharedStaTestRunner.Run(() =>
    {
        foreach (var size in new[] { new Size(93, 41), new Size(40, 62) })
        foreach (var radius in new[] { new CornerRadius(0), new CornerRadius(17), new CornerRadius(0, 15, 21, 3), new CornerRadius(900) })
        foreach (double power in new[] { 1.5, 2, 2.005, 3, 4 })
        {
            var baseline = BaselineGlassClipBuilder.CreateClip(size, radius, power)!;
            var current = GlassClipBuilder.CreateClip(size, radius, power)!;
            Assert.Equal(Pixels(baseline, size, dpi), Pixels(current, size, dpi));
        }
    });

    [Fact]
    public async Task ConcurrentClipConsumersKeepTheirOwnBoundedResources()
    {
        var tasks = Enumerable.Range(0, 4).Select(worker => Task.Run(() =>
        {
            StreamGeometry? first = null;
            for (int i = 0; i < 200; i++)
            {
                var size = new Size(100 + worker, 43);
                var geometry = GlassClipBuilder.CreateClip(size, new CornerRadius(18), 3)!;
                first ??= geometry;
                Assert.Same(first, geometry);
                Assert.True(geometry.IsFrozen);
                Assert.Equal(new Rect(size), geometry.Bounds);
            }
        })).ToArray();
        await Task.WhenAll(tasks);
    }

    [Fact]
    public void AStationaryPointerReanchorsAfterTransformAndLayoutChanges()
        => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = Fixture(NotchEdge.Top);
        var w = fixture.Window; w.Show();
        await WpfFrameWaiter.UntilAsync(() => !Animating(w), "startup", ct);
        var input = new DockPointerState(Center(w), true, true, false);
        w.DockPointerReader = () => input;
        Press(w);
        input = input with { Position = input.Position + new Vector(40, 5) };
        await WpfFrameWaiter.UntilAsync(() => (Center(w) - input.Position).Length < 2, "initial anchor", ct);
        await WpfFrameWaiter.NextAsync(ct);
        w.NotchScale.ScaleY = 1.3;
        await WpfFrameWaiter.UntilAsync(() => (Center(w) - input.Position).Length < 2, "transform invalidates stationary anchor", ct);
        w.NotchBorder.Height += 12;
        w.UpdateLayout();
        await WpfFrameWaiter.UntilAsync(() => (Center(w) - input.Position).Length < 2, "layout invalidates stationary anchor", ct);
        var originalTransform = w.NotchWrapper.RenderTransform;
        w.NotchWrapper.RenderTransform = new TranslateTransform(0, 12);
        await WpfFrameWaiter.UntilAsync(() => (Center(w) - input.Position).Length < 2, "replacement transform bypasses cached anchor", ct);
        w.NotchWrapper.RenderTransform = originalTransform;
        w.NotchScale.ScaleY = 1;
        input = input with { LeftDown = false, ControlDown = false };
        await WpfFrameWaiter.UntilAsync(() => !w.IsDockMoveInProgress, "release", ct);
        Assert.Null(typeof(MainWindow).GetField("_dockShellTransform", Private)!.GetValue(w));
        Assert.Null(typeof(MainWindow).GetField("_dockContainerTransform", Private)!.GetValue(w));
        AssertCentred(w, NotchEdge.Top, Screen(w));
    });

    [Fact]
    public void ReusingTheFourShapeWorkingSetDoesNotAllocate()
    {
        var sizes = Enumerable.Range(0, 4).Select(i => new Size(311 + i, 91 + i)).ToArray();
        var powers = new[] { 1.5, 2d, 3, 4 };
        for (int i = 0; i < 32; i++) GlassClipBuilder.CreateClip(sizes[i % 4], new CornerRadius(20), powers[i % 4]);
        long allocated = GC.GetAllocatedBytesForCurrentThread();
        for (int i = 0; i < 400; i++) GlassClipBuilder.CreateClip(sizes[i % 4], new CornerRadius(20), powers[i % 4]);
        Assert.Equal(0, GC.GetAllocatedBytesForCurrentThread() - allocated);
    }

    private static byte[] Pixels(Geometry geometry, Size size, double dpi)
    {
        var bitmap = new RenderTargetBitmap((int)Math.Ceiling(size.Width * dpi / 96),
            (int)Math.Ceiling(size.Height * dpi / 96), dpi, dpi, PixelFormats.Pbgra32);
        var drawing = new DrawingVisual();
        using (var dc = drawing.RenderOpen()) dc.DrawGeometry(Brushes.White, null, geometry);
        bitmap.Render(drawing);
        var pixels = new byte[bitmap.PixelWidth * bitmap.PixelHeight * 4];
        bitmap.CopyPixels(pixels, bitmap.PixelWidth * 4, 0);
        return pixels;
    }

    private void WriteReport(string name, object values)
    {
        string label = Environment.GetEnvironmentVariable("VNOTCH_REUSE_PROBE_NAME") == "before" ? "before" : "after";
        string folder = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../artifacts/frame-reuse"));
        Directory.CreateDirectory(folder);
        string json = JsonSerializer.Serialize(values, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(Path.Combine(folder, $"{name}-{label}.json"), json);
        output.WriteLine(json);
    }
}
