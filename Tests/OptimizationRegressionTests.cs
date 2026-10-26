using System.Diagnostics;
using System.Reflection;
using System.Text.Json;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using VNotch.Controls;
using VNotch.Models;
using VNotch.Services;
using VNotch.Services.Agents;
using VNotch.Services.LocalSend;
using Xunit;
using Xunit.Abstractions;

namespace VNotch.Tests;

[Collection("Localization")]
public sealed class OptimizationRegressionTests(ITestOutputHelper output)
{
    private const BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;

    [Theory]
    [InlineData("plain metadata", 100)] [InlineData("long metadata", 4)]
    [InlineData("a\nb\rc\td", 3)] [InlineData("\0\n\r", 100)]
    [InlineData("ภาษาไทย 🎵", 100)] [InlineData("hello", 0)] [InlineData("hello", -2)]
    public void AgentTextKeepsTheExistingSanitizationAndLengthRules(string text, int limit)
    {
        using var document = JsonDocument.Parse(JsonSerializer.Serialize(text));
        Assert.Equal(LegacyText(document.RootElement, limit), document.RootElement.Text(limit));
    }

    [Fact]
    public void CleanAgentMetadataAvoidsTemporaryCharacterArrays()
    {
        using var document = JsonDocument.Parse("\"gpt-6.1-sol\"");
        var element = document.RootElement;
        var before = Measure(10000, frame => _ = LegacyText(element, 100));
        var after = Measure(10000, frame => _ = element.Text());
        output.WriteLine($"Agent metadata: legacy {before.Bytes:F0} B/field, optimized {after.Bytes:F0} B/field; {before.Microseconds:F2} -> {after.Microseconds:F2} us/field");
        Assert.True(after.Bytes < before.Bytes * .5, "Clean metadata should not allocate LINQ iterators and character arrays.");
        SaveMeasurement("agent-text", before, after);
    }

    [Theory]
    [InlineData(160, 96)] [InlineData(220, 144)] [InlineData(244, 192)]
    public void CachedCountdownFaceRendersIdenticalPixelsAfterProgressResizeAndAccentChanges(double size, double dpi) => SharedStaTestRunner.Run(() =>
    {
        var ring = new CountdownRing();
        var render = RenderDelegate(ring);
        foreach (double width in new[] { size, size + 17, size })
        foreach (var brush in new Brush[] { Brushes.Coral, Brushes.DeepSkyBlue })
        foreach (double share in new[] { 1d, .73, .5, .01, 0, double.NaN })
        {
            ring.Accent = brush; ring.RemainingShare = share;
            ring.Measure(new Size(width, size)); ring.Arrange(new Rect(0, 0, width, size));
            var actual = Draw(render);
            var expected = Draw(dc => LegacyRing(dc, width, size, share, brush));
            Assert.Equal(Pixels(expected, width, size, dpi), Pixels(actual, width, size, dpi));
        }
        // Keep a live brush reference: freezing a cached pen must not freeze a
        // user's mutable brush or retain the old color after a theme update.
        var live = new SolidColorBrush(Colors.Coral); ring.Accent = live;
        ring.RemainingShare = .5;
        _ = Draw(render); live.Color = Colors.Lime;
        Assert.False(live.IsFrozen);
        Assert.Equal(Pixels(Draw(dc => LegacyRing(dc, ring.ActualWidth, ring.ActualHeight, .5, live)), ring.ActualWidth, ring.ActualHeight, dpi),
            Pixels(Draw(render), ring.ActualWidth, ring.ActualHeight, dpi));
    });

    [Fact]
    public void CountdownTicksReuseTheStaticDialInsteadOfRebuildingSixtyMarks() => SharedStaTestRunner.Run(() =>
    {
        var ring = new CountdownRing { Accent = Brushes.Coral };
        ring.Measure(new Size(220, 220)); ring.Arrange(new Rect(0, 0, 220, 220));
        var render = RenderDelegate(ring);
        var before = Measure(500, frame => _ = Draw(dc => LegacyRing(dc, 220, 220, (frame % 100) / 100d, Brushes.Coral)));
        var after = Measure(500, frame => { ring.RemainingShare = (frame % 100) / 100d; _ = Draw(render); });
        output.WriteLine($"Countdown draw: legacy {before.Bytes:F0} B/frame, optimized {after.Bytes:F0} B/frame; {before.Microseconds:F2} -> {after.Microseconds:F2} us/frame");
        Assert.True(after.Bytes < before.Bytes * .4, "Retained dial should remove most per-tick drawing allocations.");
        SaveMeasurement("countdown-drawing", before, after);
    });

    [Fact]
    public void PlaybackHeartbeatsDoNotGenerateRepeatedActivityMessages()
    {
        var filter = new MediaActivityLogFilter();
        var info = new MediaInfo { CurrentTrack = "Track", CurrentArtist = "Artist", MediaSource = "Browser", IsPlaying = true, IsAnyMediaPlaying = true };
        Assert.True(filter.ShouldLog(info));
        for (int i = 0; i < 1000; i++) { info.Position = TimeSpan.FromSeconds(i); Assert.False(filter.ShouldLog(info)); }
        info.IsPlaying = false; Assert.True(filter.ShouldLog(info)); Assert.False(filter.ShouldLog(info));
        info.SourceAppId = "another-app"; Assert.True(filter.ShouldLog(info));
        info.CurrentTrack = "Next"; Assert.True(filter.ShouldLog(info));
        info.IsAnyMediaPlaying = false; info.CurrentTrack = ""; Assert.True(filter.ShouldLog(info)); Assert.False(filter.ShouldLog(info));
    }

    [Fact]
    public async Task LocalSendReleasesFinishedOperationsAndStillTracksInFlightWork()
    {
        using var session = new LocalSendSession(new NoNetworkPermission());
        var track = typeof(LocalSendSession).GetMethod("Track", Private)!.MakeGenericMethod(typeof(int));
        Task<int> Track(Func<Task<int>> action) => (Task<int>)track.Invoke(session, new object[] { action })!;
        int Workers()
        {
            var gate = typeof(LocalSendSession).GetField("_gate", Private)!.GetValue(session)!;
            lock (gate) return ((ICollection<Task>)typeof(LocalSendSession).GetField("_workers", Private)!.GetValue(session)!).Count;
        }
        for (int i = 0; i < 1000; i++) Assert.Equal(42, await Track(() => Task.FromResult(42)));
        Assert.Equal(0, Workers());
        var pending = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
        var operation = Track(() => pending.Task);
        Assert.Equal(1, Workers());
        pending.SetResult(7); Assert.Equal(7, await operation);
        Assert.True(SpinWait.SpinUntil(() => Workers() == 0, TimeSpan.FromSeconds(3)));
        await Assert.ThrowsAsync<System.IO.IOException>(() => Track(() => Task.FromException<int>(new System.IO.IOException("expected"))));
        Assert.Equal(0, Workers());
    }

    private sealed class NoNetworkPermission : ILocalSendPermission
    { public CancellationToken Acquire() => throw new InvalidOperationException("No network in this test."); }
    private static string LegacyText(JsonElement element, int limit) => new(element.GetString()!.Where(c => !char.IsControl(c)).Take(limit).ToArray());
    private static Action<DrawingContext> RenderDelegate(CountdownRing ring) => typeof(CountdownRing).GetMethod("OnRender", Private)!.CreateDelegate<Action<DrawingContext>>(ring);
    private static DrawingGroup Draw(Action<DrawingContext> draw)
    { var group = new DrawingGroup(); using (var dc = group.Open()) draw(dc); return group; }

    private static byte[] Pixels(Drawing drawing, double width, double height, double dpi)
    {
        var visual = new DrawingVisual(); using (var dc = visual.RenderOpen()) dc.DrawDrawing(drawing);
        var bitmap = new RenderTargetBitmap((int)Math.Ceiling(width * dpi / 96), (int)Math.Ceiling(height * dpi / 96), dpi, dpi, PixelFormats.Pbgra32);
        bitmap.Render(visual); var pixels = new byte[bitmap.PixelWidth * bitmap.PixelHeight * 4];
        bitmap.CopyPixels(pixels, bitmap.PixelWidth * 4, 0); return pixels;
    }

    private static void LegacyRing(DrawingContext dc, double width, double height, double remaining, Brush accent)
    {
        double size = Math.Min(width, height); if (size < 20) return;
        var center = new Point(width / 2, height / 2); double radius = size / 2 - 12;
        double share = double.IsFinite(remaining) ? Math.Clamp(remaining, 0, 1) : 0;
        var track = new SolidColorBrush(Color.FromArgb(28, 255, 255, 255)); track.Freeze();
        dc.DrawEllipse(null, new Pen(track, 3), center, radius, radius);
        for (int i = 0; i < 60; i++)
        {
            double angle = i * Math.PI / 30 - Math.PI / 2; double r = radius + (i % 5 == 0 ? 8 : 6);
            var a = new Point(center.X + (radius + 5) * Math.Cos(angle), center.Y + (radius + 5) * Math.Sin(angle));
            var b = new Point(center.X + r * Math.Cos(angle), center.Y + r * Math.Sin(angle)); dc.DrawLine(new Pen(track, 1), a, b);
        }
        if (share <= 0) return;
        var pen = new Pen(accent, 3) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round };
        if (share >= .99999) dc.DrawEllipse(null, pen, center, radius, radius);
        else
        {
            double angle = share * Math.PI * 2 - Math.PI / 2;
            var end = new Point(center.X + radius * Math.Cos(angle), center.Y + radius * Math.Sin(angle));
            var arc = new StreamGeometry();
            using (var g = arc.Open()) { g.BeginFigure(new Point(center.X, center.Y - radius), false, false); g.ArcTo(end, new Size(radius, radius), 0, share > .5, SweepDirection.Clockwise, true, false); }
            arc.Freeze(); dc.DrawGeometry(null, pen, arc); dc.DrawEllipse(accent, null, end, 4, 4);
        }
    }

    private sealed record Measurement(double Bytes, double Microseconds);
    private static Measurement Measure(int count, Action<int> action)
    {
        for (int i = 0; i < 100; i++) action(i);
        long allocated = GC.GetAllocatedBytesForCurrentThread(), started = Stopwatch.GetTimestamp();
        for (int i = 0; i < count; i++) action(i);
        return new((GC.GetAllocatedBytesForCurrentThread() - allocated) / (double)count, Stopwatch.GetElapsedTime(started).TotalMicroseconds / count);
    }
    private static void SaveMeasurement(string name, Measurement before, Measurement after)
    {
        var root = new System.IO.DirectoryInfo(AppContext.BaseDirectory);
        while (root != null && !System.IO.File.Exists(System.IO.Path.Combine(root.FullName, "V-Notch.csproj"))) root = root.Parent;
        if (root == null) return;
        string folder = System.IO.Path.Combine(root.FullName, "artifacts", "optimization"); System.IO.Directory.CreateDirectory(folder);
        System.IO.File.WriteAllText(System.IO.Path.Combine(folder, name + ".json"), JsonSerializer.Serialize(new { Scope = "Component microbenchmark; not whole-app CPU or RAM", Before = before, After = after }, new JsonSerializerOptions { WriteIndented = true }));
    }
}
