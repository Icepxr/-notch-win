using System.Reflection;
using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using VNotch.Controllers;
using VNotch.Models;
using VNotch.Services;
using VNotch.Tests.Fakes;
using VNotch.ViewModels;
using Xunit;

namespace VNotch.Tests;

[Collection("Localization")]
public sealed class MultiMonitorNotchTests
{
    private const BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;

    [Fact]
    public void ReconcileRetainsWindowsAcrossReorderAndClosesOnlyRemovedDisplays()
    {
        int created = 0; var closed = new List<object>();
        var set = new MultiMonitorWindowSet<object>(_ => { created++; return new object(); }, closed.Add, (_, _, _) => { });
        var a = Choice("A", 0); var b = Choice("B", 1); var c = Choice("C", 2);
        var settings = new NotchSettings { ShowOnAllMonitors = true };
        set.Reconcile(settings, new[] { a, b, c }, "A");
        Assert.Equal(2, created); Assert.Equal(2, set.Windows.Count);
        var oldB = set.Windows["B"];
        set.Reconcile(settings, new[] { c with { Index = 0 }, a with { Index = 1 }, b with { Index = 2 } }, "A");
        Assert.Same(oldB, set.Windows["B"]); Assert.Equal(2, created); Assert.Empty(closed);
        set.Reconcile(settings, new[] { a, b }, "A");
        Assert.Single(closed); Assert.Same(oldB, set.Windows["B"]);
        set.Reconcile(settings, new[] { a, b, c }, "A");
        Assert.Equal(3, created);
        settings.ShowOnAllMonitors = false;
        set.Reconcile(settings, new[] { a, b, c }, "A");
        Assert.Empty(set.Windows); Assert.Equal(3, closed.Count);
    }

    [Fact]
    public void PreferredDisplayAndDuplicateIdentitiesNeverCreateDuplicateNotches()
    {
        var set = new MultiMonitorWindowSet<object>(_ => new object(), _ => { }, (_, _, _) => { });
        var a = Choice("A", 0); var b = Choice("B", 1); var c = Choice("C", 2);
        var options = new NotchSettings { ShowOnAllMonitors = true };
        set.Reconcile(options, new[] { a, b, c, c with { Id = "c" } }, "B");
        Assert.Equal(2, set.Windows.Count); Assert.False(set.Windows.ContainsKey("B"));
        set.Reconcile(options, new[] { a }, "A"); Assert.Empty(set.Windows);
        set.Clear(); Assert.Empty(set.Windows);
    }

    [Fact]
    public void DisplayPreferenceMergePreservesNewGlobalChangesAndPreferredMonitor()
    {
        var original = new NotchSettings { MonitorDeviceId = "preferred", Width = 240, ShowOnAllMonitors = true };
        var bound = MonitorWindowSettingsService.Bind(original, "secondary", 2);
        var incoming = bound.Clone(); incoming.DockEdge = NotchEdge.Left;
        var latest = original.Clone(); latest.Width = 310; latest.Opacity = .8; latest.ShowOnAllMonitors = false;
        var merged = MonitorWindowSettingsService.Merge(bound, incoming, latest);
        Assert.Equal("preferred", merged.MonitorDeviceId); Assert.Equal(310, merged.Width);
        Assert.Equal(.8, merged.Opacity); Assert.False(merged.ShowOnAllMonitors); Assert.Equal(NotchEdge.Top, merged.DockEdge);
        incoming.LiquidGlass.PowerFactor += 1;
        merged = MonitorWindowSettingsService.Merge(bound, incoming, latest);
        Assert.Equal(incoming.LiquidGlass.PowerFactor, merged.LiquidGlass.PowerFactor);
        merged.LiquidGlass.PowerFactor += 1; Assert.NotEqual(merged.LiquidGlass.PowerFactor, incoming.LiquidGlass.PowerFactor);
    }

    [Fact]
    public void ASecondaryWindowSharesFeedsButOwnsItsViewAndCanCloseIndependently()
        => SharedStaTestRunner.RunAsync(async ct =>
    {
        var media = new FakeMediaDetectionService();
        await using var fixture = new GreetingAcceptanceTests.MainWindowFixture("en", false,
            s => { s.EnableLocalOnlyMode = true; s.AutoCheckUpdates = false; },
            services => services.AddSingleton<IMediaDetectionService>(media));
        var primary = fixture.Window; primary.Show();
        await WpfFrameWaiter.UntilAsync(() => !DockDragWindowTests.Animating(primary) && media.StartCount > 0, "primary starts", ct);
        var display = MonitorSelection.GetChoices()[0];
        var secondary = primary.CreateDisplayWindow(display);
        try
        {
            secondary.Show();
            await WpfFrameWaiter.UntilAsync(() => !DockDragWindowTests.Animating(secondary), "secondary starts", ct);
            Assert.True(secondary.IsSecondaryDisplay);
            Assert.Equal(Visibility.Collapsed, secondary.TrayIcon.Visibility);
            Assert.Null(Field<object?>(secondary, "_clipboardHotkey"));
            Assert.Null(Field<object?>(secondary, "_invisibleHotkey"));
            Assert.Same(Field<object>(primary, "_mediaService"), Field<object>(secondary, "_mediaService"));
            Assert.Same(Field<object>(primary, "_clipboardHistory"), Field<object>(secondary, "_clipboardHistory"));
            Assert.Same(Field<object>(primary, "_systemMonitorModule"), Field<object>(secondary, "_systemMonitorModule"));
            Assert.NotSame(Field<object>(primary, "_viewModel"), Field<object>(secondary, "_viewModel"));
            Assert.NotSame(Field<object>(primary, "_transitionCoordinator"), Field<object>(secondary, "_transitionCoordinator"));
            Assert.Equal(1, media.StartCount);
            media.RaiseMediaChanged(new MediaInfo { CurrentTrack = "Shared feed", CurrentArtist = "Display test", IsPlaying = true, IsAnyMediaPlaying = true });
            await WpfFrameWaiter.UntilAsync(() => Field<ShellViewModel>(primary, "_viewModel").Media.CurrentInfo?.CurrentTrack == "Shared feed" &&
                Field<ShellViewModel>(secondary, "_viewModel").Media.CurrentInfo?.CurrentTrack == "Shared feed", "both receive music", ct);
            secondary.Close();
            Assert.True(primary.IsVisible);
            Assert.Equal(0, media.DisposeCount);
            media.RaiseMediaChanged(new MediaInfo { CurrentTrack = "Still running", IsPlaying = true, IsAnyMediaPlaying = true });
            await WpfFrameWaiter.UntilAsync(() => Field<ShellViewModel>(primary, "_viewModel").Media.CurrentInfo?.CurrentTrack == "Still running", "primary survives", ct);
        }
        finally { if (secondary.IsVisible) secondary.Close(); }
    });

    [Fact]
    public void HostCreatesOneWindowPerConnectedDisplayAndDisablesWithoutStoppingPrimary() => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = new GreetingAcceptanceTests.MainWindowFixture("en", false,
            s => { s.EnableLocalOnlyMode = true; s.AutoCheckUpdates = false; },
            services => services.AddSingleton<IMediaDetectionService>(new FakeMediaDetectionService()));
        var primary = fixture.Window; primary.Show();
        await WpfFrameWaiter.UntilAsync(() => !DockDragWindowTests.Animating(primary), "primary ready", ct);
        using var host = new MultiMonitorNotchHost(primary);
        var options = primary.DisplaySettings; options.ShowOnAllMonitors = true;
        primary.ApplyDisplaySettings(options);
        int count = MonitorSelection.GetChoices().Select(c => c.Id).Distinct(StringComparer.OrdinalIgnoreCase).Count() - 1;
        await WpfFrameWaiter.UntilAsync(() => host.SecondaryWindows.Count == count, "connected displays ready", ct);
        foreach (var (id, window) in host.SecondaryWindows)
        {
            Assert.True(window.IsVisible);
            Assert.Equal(id, window.DisplaySettings.MonitorDeviceId);
        }
        options.ShowOnAllMonitors = false;
        primary.ApplyDisplaySettings(options);
        await WpfFrameWaiter.UntilAsync(() => host.SecondaryWindows.Count == 0, "secondary displays removed", ct);
        Assert.True(primary.IsVisible);
    });

    [Fact]
    public void DisplayToggleIsReadBackAndDisablesSingleMonitorSelection() => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = new GreetingAcceptanceTests.MainWindowFixture("en", false);
        var service = new MemorySettings();
        var settings = new SettingsWindow(new NotchSettings(), service);
        try
        {
            settings.AllMonitorsCheck.IsChecked = true;
            Assert.True(settings.ReadSettingsFromUi().ShowOnAllMonitors);
            Assert.False(settings.MonitorCombo.IsEnabled);
            settings.AllMonitorsCheck.IsChecked = false;
            Assert.False(settings.ReadSettingsFromUi().ShowOnAllMonitors);
            Assert.True(settings.MonitorCombo.IsEnabled);
        }
        finally { settings.Close(); }
    });

    private static T Field<T>(MainWindow window, string name) => (T)typeof(MainWindow).GetField(name, Private)!.GetValue(window)!;
    private static NotchTransitionCoordinator Coordinator(MainWindow window) => Field<NotchTransitionCoordinator>(window, "_transitionCoordinator");

    [Fact]
    public async Task EachDisplayRestoresItsOwnEdgeAndStaleUiSavesPreserveOtherPlacements()
    {
        var store = new MemorySettings();
        var original = new NotchSettings { MonitorDeviceId = "A", ShowOnAllMonitors = true };
        store.Save(original);
        var shared = new DisplayPreferenceCoordinator(store);
        var second = new MonitorWindowSettingsService(shared, shared.Load, "B", 1);
        var left = shared.Load(); left.DockEdge = NotchEdge.Left;
        await shared.SaveAsync(left);
        var right = second.Load(); right.DockEdge = NotchEdge.Right;
        await second.SaveAsync(right);
        left.Width = 315; // Snapshot captured before B moved.
        await shared.SaveAsync(left);
        var restarted = new DisplayPreferenceCoordinator(store).Load();
        Assert.Equal(NotchEdge.Left, restarted.DockEdge);
        Assert.Equal(NotchEdge.Left, restarted.MonitorDockEdges["a"]);
        Assert.Equal(NotchEdge.Right, MonitorWindowSettingsService.Bind(restarted, "b", 1).DockEdge);
        Assert.Equal(NotchEdge.Top, MonitorWindowSettingsService.Bind(restarted, "C", 2).DockEdge);
        Assert.Equal(315, restarted.Width);
        var json = System.Text.Json.JsonSerializer.Serialize(restarted);
        var roundtrip = System.Text.Json.JsonSerializer.Deserialize<NotchSettings>(json)!;
        Assert.True(restarted.ValueEquals(roundtrip));
        var clone = roundtrip.Clone(); clone.MonitorDockEdges["B"] = NotchEdge.Top;
        Assert.False(clone.ValueEquals(roundtrip));
        Assert.Equal(NotchEdge.Right, roundtrip.MonitorDockEdges["b"]);
    }

    [Fact]
    public async Task SingleDisplayKeepsItsLegacyLayoutUntilMultiMonitorModeIsEnabled()
    {
        var store = new MemorySettings();
        var shared = new DisplayPreferenceCoordinator(store);
        var single = shared.Load(); single.MonitorDeviceId = "A"; single.DockEdge = NotchEdge.Left;
        await shared.SaveAsync(single);
        Assert.Empty(shared.Load().MonitorDockEdges);
        Assert.Equal(NotchEdge.Left, shared.Load().DockEdge);
        single.ShowOnAllMonitors = true;
        await shared.SaveAsync(single);
        Assert.Equal(NotchEdge.Left, shared.Load().MonitorDockEdges["A"]);
    }

    [Fact]
    public async Task ConcurrentDisplaySavesAreOrderedAndDoNotLoseEitherEdge()
    {
        var store = new DelayedSettings();
        var shared = new DisplayPreferenceCoordinator(store);
        var second = new MonitorWindowSettingsService(shared, shared.Load, "B", 1);
        var a = shared.Load(); a.DockEdge = NotchEdge.Left;
        var b = second.Load(); b.DockEdge = NotchEdge.Right;
        var saveA = shared.SaveAsync(a);
        var saveB = second.SaveAsync(b);
        Assert.Equal(1, store.Writes);
        store.Release.TrySetResult();
        await Task.WhenAll(saveA, saveB);
        Assert.Equal(2, store.Writes);
        Assert.Equal(NotchEdge.Left, store.Load().MonitorDockEdges["A"]);
        Assert.Equal(NotchEdge.Right, store.Load().MonitorDockEdges["B"]);
    }

    [Fact]
    public void MovingEitherWindowKeepsTheOtherWindowAtItsPositionAndOpenView() => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = new GreetingAcceptanceTests.MainWindowFixture("en", false,
            s => { s.ShowOnAllMonitors = true; s.EnableLocalOnlyMode = true; },
            services => services.AddSingleton<IMediaDetectionService>(new FakeMediaDetectionService()));
        var primary = fixture.Window; primary.Show();
        await WpfFrameWaiter.UntilAsync(() => !DockDragWindowTests.Animating(primary), "primary ready", ct);
        var binding = Choice("independent-test-display", 0);
        var secondary = primary.CreateDisplayWindow(binding);
        try
        {
            secondary.Show();
            await WpfFrameWaiter.UntilAsync(() => !DockDragWindowTests.Animating(secondary), "secondary ready", ct);
            var shared = Field<ISettingsService>(primary, "_settingsService");
            primary.ApplyDisplaySettings(shared.Load());
            secondary.ApplyDisplaySettings(shared.Load(), binding);
            Coordinator(secondary).RequestView(NotchView.Media, "independent-view");
            await WpfFrameWaiter.UntilAsync(() => !DockDragWindowTests.Animating(secondary), "secondary expanded", ct);
            var before = new Rect(secondary.Left, secondary.Top, secondary.Width, secondary.Height);
            primary.MoveDockTo(NotchEdge.Left);
            await WpfFrameWaiter.UntilAsync(() => !primary.IsDockMoveInProgress &&
                shared.Load().MonitorDockEdges.Values.Contains(NotchEdge.Left), "primary moved and saved", ct);
            secondary.ApplyDisplaySettings(shared.Load(), binding);
            Assert.Equal(NotchEdge.Top, secondary.DockEdge);
            Assert.Equal(NotchView.Media, Coordinator(secondary).CurrentView);
            Assert.False(DockDragWindowTests.Animating(secondary));
            Assert.Equal(before, new Rect(secondary.Left, secondary.Top, secondary.Width, secondary.Height));

            Coordinator(primary).RequestView(NotchView.Timer, "independent-primary-view");
            await WpfFrameWaiter.UntilAsync(() => !DockDragWindowTests.Animating(primary), "primary expanded", ct);
            before = new Rect(primary.Left, primary.Top, primary.Width, primary.Height);
            secondary.MoveDockTo(NotchEdge.Right);
            await WpfFrameWaiter.UntilAsync(() => !secondary.IsDockMoveInProgress &&
                shared.Load().MonitorDockEdges.TryGetValue(binding.Id, out var edge) && edge == NotchEdge.Right,
                "secondary moved and saved", ct);
            primary.ApplyDisplaySettings(shared.Load());
            Assert.Equal(NotchEdge.Left, primary.DockEdge);
            Assert.Equal(NotchView.Timer, Coordinator(primary).CurrentView);
            Assert.False(DockDragWindowTests.Animating(primary));
            Assert.Equal(before, new Rect(primary.Left, primary.Top, primary.Width, primary.Height));
        }
        finally { secondary.Close(); }
    });

    [Fact]
    public void DraggingOneDisplayDoesNotArmAnotherWhenThePointerCrossesScreens() => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = new GreetingAcceptanceTests.MainWindowFixture("en", false,
            s => s.ShowOnAllMonitors = true);
        var primary = fixture.Window;
        var secondary = primary.CreateDisplayWindow(Choice("second-display-drag-test", 0));
        try
        {
            var bounds = MonitorSelection.Resolve(secondary.DisplaySettings).Bounds;
            secondary.DockPointerReader = () => new DockPointerState(new Point(bounds.Left + 10, bounds.Top + 10), true, true, false);
            Assert.True(secondary.IsDockPickUpArmed);
            typeof(MainWindow).GetField("_isDockDragging", Private)!.SetValue(primary, true);
            Assert.False(secondary.IsDockPickUpArmed);
            Assert.False(secondary.IsDockHoverSuppressed);
            typeof(MainWindow).GetField("_isDockDragging", Private)!.SetValue(primary, false);
            Assert.True(secondary.IsDockPickUpArmed);
        }
        finally
        {
            typeof(MainWindow).GetField("_isDockDragging", Private)!.SetValue(primary, false);
            secondary.Close();
        }
    });

    [Fact]
    public void InputOnAnotherDisplayDoesNotArmOrCollapseThisWindow() => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = new GreetingAcceptanceTests.MainWindowFixture("en", false,
            s => s.ShowOnAllMonitors = true);
        var window = fixture.Window; window.Show();
        await WpfFrameWaiter.UntilAsync(() => !DockDragWindowTests.Animating(window), "ready", ct);
        var bounds = MonitorSelection.Resolve(window.DisplaySettings).Bounds;
        window.DockPointerReader = () => new DockPointerState(new Point(bounds.Left - 10000, bounds.Top), false, true, false);
        Coordinator(window).RequestView(NotchView.Media, "other-display-control");
        await WpfFrameWaiter.UntilAsync(() => !DockDragWindowTests.Animating(window), "expanded", ct);
        typeof(MainWindow).GetMethod("UpdateDockArmingState", Private)!.Invoke(window, null);
        Assert.False(window.IsDockPickUpArmed);
        Assert.False(window.IsDockHoverSuppressed);
        Assert.Equal(NotchView.Media, Coordinator(window).CurrentView);
        var outside = new InputMonitorService.POINT { x = bounds.Left - 10000, y = bounds.Top };
        typeof(MainWindow).GetMethod("GlobalMouseHook_MouseLeftButtonDown", Private)!.Invoke(window, new object?[] { null, outside });
        typeof(MainWindow).GetMethod("DrainOutsideClicks", Private)!.Invoke(window, null);
        Assert.Equal(NotchView.Media, Coordinator(window).CurrentView);

        // Outside clicks on this display still dismiss its own expanded panel.
        var ownDesktop = new InputMonitorService.POINT { x = bounds.Right - 40, y = bounds.Bottom - 40 };
        typeof(MainWindow).GetField("_suppressOutsideClickUntilUtc", Private)!.SetValue(window, DateTime.MinValue);
        typeof(MainWindow).GetMethod("GlobalMouseHook_MouseLeftButtonDown", Private)!.Invoke(window, new object?[] { null, ownDesktop });
        typeof(MainWindow).GetMethod("DrainOutsideClicks", Private)!.Invoke(window, null);
        await WpfFrameWaiter.UntilAsync(() => Coordinator(window).CurrentView == NotchView.Compact &&
            !DockDragWindowTests.Animating(window), "own desktop click dismisses only this panel", ct);
    });

    private sealed class DelayedSettings : ISettingsService
    {
        private NotchSettings _value = new() { MonitorDeviceId = "A", ShowOnAllMonitors = true };
        internal readonly TaskCompletionSource Release = new(TaskCreationOptions.RunContinuationsAsynchronously);
        internal int Writes;
        public NotchSettings Load() => _value.Clone();
        public void Save(NotchSettings settings) => _value = settings.Clone();
        public async Task SaveAsync(NotchSettings settings) { Interlocked.Increment(ref Writes); await Release.Task; Save(settings); }
        public void ExportSettingsToFile(string path, NotchSettings settings) { }
        public (NotchSettings Settings, bool RequiresRestart) ImportSettingsFromFile(string path, NotchSettings? current = null) => (Load(), false);
    }
    private static MonitorSelection.Choice Choice(string id, int index) => new(id, id, index, System.Windows.Forms.Screen.PrimaryScreen);
    private sealed class MemorySettings : ISettingsService
    {
        private NotchSettings _value = new();
        public NotchSettings Load() => _value.Clone();
        public void Save(NotchSettings settings) => _value = settings.Clone();
        public Task SaveAsync(NotchSettings settings) { Save(settings); return Task.CompletedTask; }
        public void ExportSettingsToFile(string path, NotchSettings settings) { }
        public (NotchSettings Settings, bool RequiresRestart) ImportSettingsFromFile(string path, NotchSettings? current = null) => (Load(), false);
    }
}
