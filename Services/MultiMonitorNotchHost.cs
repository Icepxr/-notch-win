using Microsoft.Win32;
using System.Windows.Threading;
using VNotch.Models;

namespace VNotch.Services;

internal sealed class MultiMonitorNotchHost : IDisposable
{
    private readonly MainWindow _primary;
    private readonly MultiMonitorWindowSet<MainWindow> _windows;
    private readonly DispatcherTimer _refresh;
    private NotchSettings _settings;
    private bool _applying, _disposed;
    internal IReadOnlyDictionary<string, MainWindow> SecondaryWindows => _windows.Windows;

    internal MultiMonitorNotchHost(MainWindow primary)
    {
        _primary = primary; _settings = primary.DisplaySettings;
        _refresh = new DispatcherTimer(DispatcherPriority.Background, primary.Dispatcher)
            { Interval = TimeSpan.FromMilliseconds(120) };
        _refresh.Tick += RefreshTick;
        _windows = new MultiMonitorWindowSet<MainWindow>(display =>
        {
            var window = primary.CreateDisplayWindow(display);
            window.DisplaySettingsChanged += OnSettingsChanged;
            window.Show();
            return window;
        }, window =>
        {
            window.DisplaySettingsChanged -= OnSettingsChanged;
            window.Close();
        }, (window, settings, display) =>
        {
            if (!window.IsDockMoveInProgress) window.ApplyDisplaySettings(settings, display);
        });
        primary.DisplaySettingsChanged += OnSettingsChanged;
        SystemEvents.DisplaySettingsChanged += OnDisplaysChanged;
        RefreshNow();
    }

    private void OnSettingsChanged(MainWindow source, NotchSettings settings)
    {
        if (_disposed || _primary.Dispatcher.HasShutdownStarted) return;
        if (!_primary.Dispatcher.CheckAccess())
        {
            var copy = settings.Clone();
            _primary.Dispatcher.BeginInvoke(() => OnSettingsChanged(source, copy));
            return;
        }
        if (_applying || _disposed) return;
        var snapshot = settings.Clone();
        if (source.IsSecondaryDisplay)
        {
            snapshot.MonitorDeviceId = _settings.MonitorDeviceId;
            snapshot.MonitorIndex = _settings.MonitorIndex;
        }
        var local = source.DisplaySettings;
        if (snapshot.ShowOnAllMonitors || snapshot.MonitorDockEdges.Count > 0)
            DisplayPreferenceCoordinator.RecordPlacement(snapshot, MonitorSelection.ResolveId(local), local.DockEdge);
        _settings = snapshot;
        QueueRefresh();
    }
    private void OnDisplaysChanged(object? sender, EventArgs args) => QueueRefresh();
    private void QueueRefresh()
    {
        if (_disposed || _primary.Dispatcher.HasShutdownStarted) return;
        if (!_primary.Dispatcher.CheckAccess()) { _primary.Dispatcher.BeginInvoke(QueueRefresh); return; }
        _refresh.Stop(); _refresh.Start();
    }
    private void RefreshTick(object? sender, EventArgs args)
    {
        _refresh.Stop();
        try { RefreshNow(); }
        catch (Exception ex) { RuntimeLog.Error("MULTI-DISPLAY", ex, "Could not refresh notch displays"); }
    }
    internal void RefreshNow()
    {
        if (_disposed) return;
        _applying = true;
        try
        {
            if (!_primary.IsDockMoveInProgress) _primary.ApplyDisplaySettings(_settings);
            var choices = MonitorSelection.GetChoices();
            var selected = MonitorSelection.Resolve(_settings);
            string primaryId = choices.FirstOrDefault(c => c.Screen?.DeviceName == selected.DeviceName)?.Id ?? "";
            _windows.Reconcile(_settings, choices, primaryId);
            if (_primary.IsDockMoveInProgress || _windows.Windows.Values.Any(w => w.IsDockMoveInProgress)) _refresh.Start();
        }
        finally { _applying = false; }
    }
    public void Dispose()
    {
        if (_disposed) return; _disposed = true;
        SystemEvents.DisplaySettingsChanged -= OnDisplaysChanged;
        _primary.DisplaySettingsChanged -= OnSettingsChanged;
        _refresh.Stop(); _refresh.Tick -= RefreshTick;
        _windows.Clear();
    }
}
