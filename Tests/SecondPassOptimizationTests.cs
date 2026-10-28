using System.Collections;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using VNotch.Controls;
using VNotch.Models;
using VNotch.Services.Agents;
using VNotch.Services.LocalSend;
using VNotch.ViewModels;
using VNotch.Tests.Fixtures;
using Xunit;
using Xunit.Abstractions;

namespace VNotch.Tests;

[Collection("Localization")]
public sealed class SecondPassOptimizationTests(ITestOutputHelper output)
{
    private const BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 10, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData(96)] [InlineData(144)] [InlineData(192)]
    public void RetainedMorphContoursMatchBaselinePixelsIncludingInterruptedMorphs(double dpi) => SharedStaTestRunner.RunAsync(async ct =>
    {
        var icon = new MorphProbe { Width = 40, Height = 40, Brush = Brushes.White };
        var baseline = new BaselineProbe { Width = 40, Height = 40, Brush = Brushes.White };
        var host = new StackPanel(); host.Children.Add(icon); host.Children.Add(baseline);
        var window = new Window { Content = host, Width = 80, Height = 160, ShowInTaskbar = false, ShowActivated = false };
        try
        {
            window.Show(); await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
            var shapes = new[] { Geometry.Parse("M0,0 L48,0 48,48 0,48 Z"), Geometry.Parse("M24,0 L48,48 0,48 Z M18,18 L30,18 24,30 Z"), Geometry.Parse("M2,2 L46,2 40,46 8,46 Z") };
            icon.MorphTo(shapes[0], false); baseline.MorphTo(shapes[0], false);
            foreach (var shape in shapes.Skip(1).Concat(shapes.Take(2)))
            {
                icon.MorphTo(shape, true); baseline.MorphTo(shape, true);
                foreach (double progress in new[] { 0d, .25, .5, .9 })
                {
                    Progress(icon, typeof(MorphingSettingsIcon), progress);
                    Progress(baseline, typeof(BaselineMorphingSettingsIcon), progress);
                    Assert.Equal(MorphPixels(baseline.Render, dpi), MorphPixels(icon.Render, dpi));
                }
            }
        }
        finally { window.Close(); }
    });

    private static void Progress(FrameworkElement icon, Type type, double value)
    {
        var property = (DependencyProperty)type.GetField("ProgressProperty", BindingFlags.NonPublic | BindingFlags.Static)!.GetValue(null)!;
        icon.BeginAnimation(property, null); icon.SetValue(property, value);
    }
    private static byte[] MorphPixels(Action<DrawingContext> render, double dpi)
    {
        var visual = new DrawingVisual(); using (var drawing = visual.RenderOpen()) render(drawing);
        int width = (int)Math.Ceiling(40 * dpi / 96);
        var bitmap = new RenderTargetBitmap(width, width, dpi, dpi, PixelFormats.Pbgra32); bitmap.Render(visual);
        var bytes = new byte[width * width * 4]; bitmap.CopyPixels(bytes, width * 4, 0); return bytes;
    }
    private sealed class MorphProbe : MorphingSettingsIcon { public void Render(DrawingContext context) => OnRender(context); }
    private sealed class BaselineProbe : BaselineMorphingSettingsIcon { public void Render(DrawingContext context) => OnRender(context); }

    [Theory]
    [InlineData("Codex", false, false)] [InlineData("Codex", true, false)]
    [InlineData("Codex", true, true)] [InlineData("Claude Code", false, false)]
    [InlineData("Claude Code", true, false)] [InlineData("Claude Code", true, true)]
    public void Utf8ReaderMatchesBoundedLegacyResultsWithUnicodeCrLfAndAnIncompleteLastLine(string provider, bool partial, bool noFinalNewline)
    {
        using var folder = new FixtureFolder();
        string path = Path.Combine(folder.Root, "fixture.jsonl");
        var lines = new List<string>
        {
            JsonSerializer.Serialize(new { type = "session_meta", timestamp = Now.AddMinutes(-5), payload = new { cwd = "C:\\งาน\\เพลง" } }),
            JsonSerializer.Serialize(new { timestamp = Now, type = "turn_context", payload = new { model = "โมเดล 🎵" } })
        };
        if (partial) lines.Add(new string('x', AgentLogReader.MaxBytes + 700));
        lines.Add(JsonSerializer.Serialize(new { timestamp = Now, type = "turn_context", payload = new { model = "fixture-モデル" } }));
        lines.Add(Record(provider, 1)); lines.Add(Record(provider, 1)); lines.Add(Record(provider, 2));
        lines.Add("not json"); lines.Add("{}"); lines.Add("{\"timestamp\":");
        File.WriteAllText(path, string.Join("\r\n", lines) + (noFinalNewline ? "" : "\r\n"), new UTF8Encoding(false));
        var expected = LegacyRead(path, provider);
        var actual = AgentLogReader.Read(path, provider, Now);
        Assert.Equal(JsonSerializer.Serialize(expected), JsonSerializer.Serialize(actual));
        Assert.Equal(partial, actual.Partial);
        Assert.DoesNotContain("private-text", JsonSerializer.Serialize(actual));
    }

    [Fact]
    public void Utf8ReaderIgnoresInvalidUtf8AndFilesCanGrowOrShrinkBetweenReads()
    {
        using var folder = new FixtureFolder(); string path = Path.Combine(folder.Root, "changing.jsonl");
        File.WriteAllBytes(path, [.. Encoding.UTF8.GetBytes("{\"timestamp\":\"2026-10-28T10:00:00Z\",\"type\":\"assistant\",\"message\":{\"id\":\""), 0xff, .. Encoding.UTF8.GetBytes("\"}}\n"), .. Encoding.UTF8.GetBytes(Record("Claude Code", 1))]);
        Assert.Single(AgentLogReader.Read(path, "Claude Code", Now).Records);
        File.AppendAllText(path, "\n" + Record("Claude Code", 2));
        Assert.Equal(2, AgentLogReader.Read(path, "Claude Code", Now).Records.Count);
        File.WriteAllText(path, ""); Assert.Empty(AgentLogReader.Read(path, "Claude Code", Now).Records);
    }

    [Theory]
    [InlineData("C:\\work\\demo\\", "demo")] [InlineData("/work/demo/", "demo")]
    [InlineData("C:\\work/demo\\", "demo")] [InlineData("plain project", "plain project")]
    [InlineData("////", "Local session")] [InlineData("   ", "Local session")]
    public void ProjectNamesPreserveBothPathSeparators(string path, string expected) => Assert.Equal(expected, AgentLogReader.Project(path));

    [Fact]
    public void RecentFileSelectionPreservesNewestOrderAndStableTiesAndCancellation()
    {
        using var folder = new FixtureFolder();
        var files = Enumerable.Range(0, 130).Select(i =>
        {
            string path = Path.Combine(folder.Root, i + ".jsonl"); File.WriteAllText(path, "{}");
            File.SetLastWriteTimeUtc(path, Now.UtcDateTime.AddMinutes(-(i % 9)));
            return new FileInfo(path);
        }).ToArray();
        DateTime cutoff = Now.UtcDateTime.AddMinutes(-5);
        var expected = files.Where(f => f.LastWriteTimeUtc >= cutoff).OrderByDescending(f => f.LastWriteTimeUtc).Take(65).Select(f => f.FullName).ToArray();
        Assert.Equal(expected, AgentMonitor.RecentFiles(files, cutoff, 65, default).Select(f => f.FullName));
        Assert.Empty(AgentMonitor.RecentFiles(files, cutoff, 0, default));
        using var stop = new CancellationTokenSource();
        IEnumerable<FileInfo> CancelDuringEnumeration()
        { yield return files[0]; stop.Cancel(); yield return files[1]; }
        Assert.Throws<OperationCanceledException>(() => AgentMonitor.RecentFiles(CancelDuringEnumeration(), cutoff, 65, stop.Token));
    }

    [Fact]
    public void ProviderTotalsAndModelBreakdownsUseOnePassAndMatchPreviousResults()
    {
        var records = new CountingRecords(Records(500));
        var totals = AgentUsageTotals.Sum(records);
        Assert.Equal(1, records.Enumerations);
        Assert.Equal(records.Values.Sum(r => r.Input), totals.Input);
        Assert.Equal(records.Values.Sum(r => r.Output), totals.Output);
        Assert.Equal(records.Values.Sum(r => r.Cached), totals.Cached);
        records.Enumerations = 0;
        var provider = new AgentProvider("Codex", records, [], new("Fixture", [], Now), false);
        var expected = LegacyModels(provider);
        records.Enumerations = 0;
        Assert.Equal(expected, AgentBreakdown.Models(provider));
        Assert.Equal(1, records.Enumerations);
    }

    [Fact]
    public void LocalSendHeartbeatSkipsUnchangedListsButPublishesMetadataChangesAndExpiry()
    {
        using var session = new LocalSendSession(new NoNetwork());
        var remember = typeof(LocalSendSession).GetMethod("Remember", Private)!;
        void Remember(LocalSendDevice device) => remember.Invoke(session, [device]);
        Assert.Empty(session.TakeChangedDeviceSnapshot(Environment.TickCount64)!);
        Assert.Null(session.TakeChangedDeviceSnapshot(Environment.TickCount64));
        var device = new LocalSendDevice("My iPad", IPAddress.Loopback, 53317, "https", "test-device");
        Remember(device); Assert.Equal("My iPad", Assert.Single(session.TakeChangedDeviceSnapshot(Environment.TickCount64)!).Alias);
        for (int i = 0; i < 1000; i++)
        {
            Remember(device with { });
            Assert.Null(session.TakeChangedDeviceSnapshot(Environment.TickCount64));
        }
        Remember(device with { Alias = "Renamed iPad", Model = "iPad" });
        Assert.Equal("Renamed iPad", Assert.Single(session.TakeChangedDeviceSnapshot(Environment.TickCount64)!).Alias);
        Assert.Empty(session.TakeChangedDeviceSnapshot(Environment.TickCount64 + 26000)!);
        Assert.Null(session.TakeChangedDeviceSnapshot(Environment.TickCount64 + 26000));
        Remember(device); Assert.Single(session.TakeChangedDeviceSnapshot(Environment.TickCount64)!);
    }

    [Fact]
    public void ReopeningClipboardAtTheSameEdgePreservesThePanelContainersAndSelection() => SharedStaTestRunner.RunAsync(async ct =>
    {
        using var tray = new ClipboardTray();
        var cards = (System.Collections.ObjectModel.ObservableCollection<ClipboardCardViewModel>)typeof(ClipboardTray).GetField("_cards", Private)!.GetValue(tray)!;
        for (int i = 0; i < 20; i++) cards.Add(new(new ClipboardEntry { Title = "Card " + i }));
        tray.SetColumnLayout(true, 300, 30);
        var window = new Window { Content = tray, Width = 320, Height = 420, ShowInTaskbar = false, ShowActivated = false };
        try
        {
            window.Show(); await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
            var list = (ListBox)tray.FindName("Cards");
            list.SelectedIndex = 10; list.ScrollIntoView(cards[10]);
            await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
            var panel = FindPanel(list); Assert.NotNull(panel);
            var selectedContainer = list.ItemContainerGenerator.ContainerFromItem(cards[10]); Assert.NotNull(selectedContainer);
            var columnTemplate = list.ItemsPanel;
            for (int i = 0; i < 10; i++) tray.SetColumnLayout(true, 300, 30);
            await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
            Assert.Same(columnTemplate, list.ItemsPanel);
            Assert.Same(panel, FindPanel(list));
            Assert.Same(selectedContainer, list.ItemContainerGenerator.ContainerFromItem(cards[10]));
            Assert.Same(cards[10], list.SelectedItem);
            tray.SetColumnLayout(false, 300, 30); var rowTemplate = list.ItemsPanel;
            Assert.NotSame(columnTemplate, rowTemplate);
            tray.SetColumnLayout(true, 340, 35); Assert.Same(columnTemplate, list.ItemsPanel);
            tray.SetColumnLayout(false, 340, 35); Assert.Same(rowTemplate, list.ItemsPanel);
        }
        finally { window.Close(); }
    });

    [Fact]
    public void AllocationBenchmarksForAgentReadSelectionAndAggregation()
    {
        using var folder = new FixtureFolder(); string path = Path.Combine(folder.Root, "benchmark.jsonl");
        File.WriteAllText(path, string.Join("\n", Enumerable.Range(0, 28).Select(i => Record("Claude Code", i, 6000))), new UTF8Encoding(false));
        var oldRead = Measure(35, i => _ = LegacyRead(path, "Claude Code"));
        var read = Measure(35, i => _ = AgentLogReader.Read(path, "Claude Code", Now));
        Report("agent-utf8-read", oldRead, read);
        Assert.True(read.Bytes < oldRead.Bytes * .7, "Reading UTF-8 should not materialize every conversation line as UTF-16.");

        var provider = new AgentProvider("Codex", Records(20000), [], new("fixture", [], Now), false);
        var oldModels = Measure(50, i => _ = LegacyModels(provider));
        var models = Measure(50, i => _ = AgentBreakdown.Models(provider));
        Report("agent-models", oldModels, models);
        Assert.True(models.Bytes < oldModels.Bytes * .25);

        var files = Enumerable.Range(0, 16).Select(i => new FileInfo(Path.Combine(folder.Root, i + ".jsonl"))).ToArray();
        IEnumerable<FileInfo> Candidates() { for (int i = 0; i < 10000; i++) yield return files[i % files.Length]; }
        var oldSelection = Measure(50, i => _ = Candidates().ToArray().Where(f => f.LastWriteTimeUtc >= DateTime.MinValue).OrderByDescending(f => f.LastWriteTimeUtc).Take(65).ToArray());
        var selection = Measure(50, i => _ = AgentMonitor.RecentFiles(Candidates(), DateTime.MinValue, 65, default));
        Report("agent-file-selection", oldSelection, selection);
        Assert.True(selection.Bytes < oldSelection.Bytes * .3);
    }

    private static VirtualizingStackPanel? FindPanel(DependencyObject root)
    {
        if (root is VirtualizingStackPanel panel) return panel;
        for (int i = 0; i < VisualTreeHelper.GetChildrenCount(root); i++)
            if (FindPanel(VisualTreeHelper.GetChild(root, i)) is { } child) return child;
        return null;
    }
    private sealed class NoNetwork : ILocalSendPermission { public CancellationToken Acquire() => throw new InvalidOperationException("No network."); }
    private sealed class CountingRecords(AgentRecord[] values) : IReadOnlyList<AgentRecord>
    {
        internal AgentRecord[] Values => values;
        internal int Enumerations;
        public int Count => values.Length;
        public AgentRecord this[int index] => values[index];
        public IEnumerator<AgentRecord> GetEnumerator() { Enumerations++; return ((IEnumerable<AgentRecord>)values).GetEnumerator(); }
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }
    private static AgentRecord[] Records(int count) => Enumerable.Range(0, count).Select(i => new AgentRecord(i.ToString(), Now, i % 4 == 0 ? " " : "model-" + i % 8, i + 1, i % 17, i % 3)).ToArray();
    private static AgentModelUsage[] LegacyModels(AgentProvider p) => p.Records.GroupBy(r => string.IsNullOrWhiteSpace(r.Model) ? "Unspecified model" : r.Model)
        .Select(g => new AgentModelUsage(g.Key, g.Sum(r => r.Input), g.Sum(r => r.Output), g.Sum(r => r.Cached), g.Count())).OrderByDescending(m => m.Total).ThenBy(m => m.Name, StringComparer.Ordinal).ToArray();
    private static string Record(string provider, int index, int bodyLength = 30) => provider == "Codex"
        ? JsonSerializer.Serialize(new { timestamp = Now.AddSeconds(-index), payload = new { type = "token_count", info = new { total_token_usage = new { total_tokens = index + 1 }, last_token_usage = new { input_tokens = 80, output_tokens = 20, cached_input_tokens = 40 } }, rate_limits = new { primary = new { used_percent = 20, window_minutes = 300 } } } })
        : JsonSerializer.Serialize(new { timestamp = Now.AddSeconds(-index), type = "assistant", cwd = "C:\\งาน\\fixture", message = new { id = "response-" + index, model = "fixture", usage = new { input_tokens = 10, output_tokens = 3, cache_read_input_tokens = 2 }, content = new string('x', bodyLength) + "private-text" } });
    private static AgentLog LegacyRead(string path, string provider)
    {
        using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        bool partial = file.Length > AgentLogReader.MaxBytes; var lines = new List<string>(); long length = file.Length;
        if (partial) { var header = new byte[8192]; int head = file.Read(header); string first = Encoding.UTF8.GetString(header, 0, head).Split('\n')[0]; if (first.Contains("session_meta", StringComparison.Ordinal)) lines.Add(first); file.Seek(length - AgentLogReader.MaxBytes, SeekOrigin.Begin); }
        var buffer = new byte[(int)Math.Min(length, AgentLogReader.MaxBytes)]; int used = 0;
        while (used < buffer.Length) { int read = file.Read(buffer.AsSpan(used)); if (read == 0) break; used += read; }
        var tail = Encoding.UTF8.GetString(buffer, 0, used).Split('\n'); lines.AddRange(partial ? tail.Skip(1) : tail);
        return AgentLogReader.Parse(lines, provider, Path.GetFileNameWithoutExtension(path), Now) with { Partial = partial };
    }
    private sealed record Measurement(double Bytes, double Microseconds);
    private static Measurement Measure(int count, Action<int> action)
    {
        for (int i = 0; i < 10; i++) action(i);
        long allocated = GC.GetAllocatedBytesForCurrentThread(), started = Stopwatch.GetTimestamp();
        for (int i = 0; i < count; i++) action(i);
        return new((GC.GetAllocatedBytesForCurrentThread() - allocated) / (double)count, Stopwatch.GetElapsedTime(started).TotalMicroseconds / count);
    }
    private void Report(string name, Measurement before, Measurement after)
    {
        output.WriteLine($"{name}: {before.Bytes:F0} -> {after.Bytes:F0} B/op; {before.Microseconds:F2} -> {after.Microseconds:F2} us/op");
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root != null && !File.Exists(Path.Combine(root.FullName, "V-Notch.csproj"))) root = root.Parent;
        if (root == null) return;
        string directory = Path.Combine(root.FullName, "artifacts", "optimization-2026-10-28"); Directory.CreateDirectory(directory);
        File.WriteAllText(Path.Combine(directory, name + ".json"), JsonSerializer.Serialize(new { Scope = "Component benchmark, not whole-app CPU or memory", Before = before, After = after }, new JsonSerializerOptions { WriteIndented = true }));
    }
    private sealed class FixtureFolder : IDisposable
    {
        internal string Root { get; } = Path.GetFullPath(Path.Combine(Path.GetTempPath(), "vnotch-opt2-" + Guid.NewGuid().ToString("N")));
        internal FixtureFolder() => Directory.CreateDirectory(Root);
        public void Dispose()
        {
            string temp = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar);
            if (!string.Equals(Path.GetDirectoryName(Root), temp, StringComparison.OrdinalIgnoreCase) || !Path.GetFileName(Root).StartsWith("vnotch-opt2-", StringComparison.Ordinal)) throw new IOException("Unexpected fixture path.");
            Directory.Delete(Root, true);
        }
    }
}
