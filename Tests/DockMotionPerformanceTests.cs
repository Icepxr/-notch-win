using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using Microsoft.Extensions.DependencyInjection;
using VNotch.Models;
using VNotch.Services;
using VNotch.Tests.Fakes;
using Xunit;
using Xunit.Abstractions;

namespace VNotch.Tests;

[Collection("Localization")]
public sealed class DockMotionPerformanceTests(ITestOutputHelper output)
{
    private const BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;

    [Theory]
    [InlineData(NotchEdge.Top, NotchEdge.Left)]
    [InlineData(NotchEdge.Left, NotchEdge.Top)]
    public void MeasureLandingWork(NotchEdge source, NotchEdge target) => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = new GreetingAcceptanceTests.MainWindowFixture("en", false,
            s => { s.EnableEdgeDocking = true; s.DockEdge = source; s.EnableDynamicIslandMode = true;
                s.DynamicIslandWidth = 240; s.DynamicIslandHeight = 40;
                s.EnableLocalOnlyMode = true; s.AutoCheckUpdates = false; },
            services => services.AddSingleton<IMediaDetectionService>(new FakeMediaDetectionService()));
        var w = fixture.Window;
        var probe = new LayoutProbe();
        w.NotchLiveContent.Children.Add(probe);
        w.DockPointerReader = () => new DockPointerState(new Point(500, 400), false, false, false);
        w.Show();
        await WpfFrameWaiter.UntilAsync(() => !(bool)typeof(MainWindow).GetProperty("_isAnimating", Private)!.GetValue(w)!, "startup", ct);
        w.UpdateLayout();
        int positions = 0, sizedRequests = 0, frames = 0;
        var sourceHwnd = HwndSource.FromHwnd(new WindowInteropHelper(w).Handle)!;
        IntPtr Hook(IntPtr hwnd, int message, IntPtr wp, IntPtr lp, ref bool handled)
        {
            if (message == 0x0046 && lp != IntPtr.Zero)
            {
                var bounds = Marshal.PtrToStructure<Win32Interop.WINDOWPOS>(lp);
                positions++;
                if ((bounds.flags & Win32Interop.SWP_NOSIZE) == 0) sizedRequests++;
            }
            return IntPtr.Zero;
        }
        void Frame(object? sender, EventArgs args) => frames++;
        probe.Measures = probe.Arranges = 0;
        sourceHwnd.AddHook(Hook);
        CompositionTarget.Rendering += Frame;
        long allocated = GC.GetAllocatedBytesForCurrentThread();
        var clock = Stopwatch.StartNew();
        try
        {
            w.MoveDockTo(target);
            await WpfFrameWaiter.UntilAsync(() => !w.IsDockMoveInProgress, "profiled landing", ct);
            w.UpdateLayout();
            Assert.Equal(target, w.DockEdge);
            var expected = NotchDock.CollapsedSize(target, 240, 40);
            Assert.Equal(expected.Width, w.NotchBorder.ActualWidth);
            Assert.Equal(expected.Height, w.NotchBorder.ActualHeight);
            if (Environment.GetEnvironmentVariable("VNOTCH_DOCK_PROBE_NAME") != "before")
            {
                Assert.InRange(probe.Measures, 0, 4);
                Assert.InRange(probe.Arranges, 0, 4);
                Assert.InRange(sizedRequests, 0, 3);
                Assert.True(positions > 3, "Measure a real native landing, not a reduced-motion snap.");
            }
        }
        finally
        {
            clock.Stop();
            CompositionTarget.Rendering -= Frame;
            sourceHwnd.RemoveHook(Hook);
        }
        var report = new { source, target, frames, probe.Measures, probe.Arranges, positions, sizedRequests,
            ElapsedMilliseconds = clock.Elapsed.TotalMilliseconds,
            UiThreadAllocatedBytes = GC.GetAllocatedBytesForCurrentThread() - allocated,
            Note = "Isolated WPF test desktop; includes setup and content restoration. Not a display FPS or whole-app CPU measurement." };
        string json = JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true });
        output.WriteLine(json);
        string label = Environment.GetEnvironmentVariable("VNOTCH_DOCK_PROBE_NAME") == "before" ? "before" : "after";
        string folder = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../artifacts/dock-smoothness"));
        Directory.CreateDirectory(folder);
        File.WriteAllText(Path.Combine(folder, $"{source}-{target}-{label}.json"), json);
    });

    private sealed class LayoutProbe : FrameworkElement
    {
        internal int Measures, Arranges;
        protected override Size MeasureOverride(Size available) { Measures++; return new Size(); }
        protected override Size ArrangeOverride(Size finalSize) { Arranges++; return finalSize; }
    }
}
