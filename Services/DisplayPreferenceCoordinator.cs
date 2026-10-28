using VNotch.Models;

namespace VNotch.Services;

/// <summary>One ordered writer preserves all monitors' placements across overlapping UI saves.</summary>
internal sealed class DisplayPreferenceCoordinator(ISettingsService store, Func<NotchSettings, string>? primaryDisplayId = null) : ISettingsService
{
    private readonly object _gate = new();
    private NotchSettings _latest = store.Load();
    private Task _writes = Task.CompletedTask;

    public NotchSettings Load() { lock (_gate) return _latest.Clone(); }
    internal Task DrainAsync() { lock (_gate) return _writes; }

    internal static void RecordPlacement(NotchSettings settings, string id, NotchEdge edge)
    {
        if (!string.IsNullOrEmpty(id)) settings.MonitorDockEdges[id] = Enum.IsDefined(edge) ? edge : NotchEdge.Top;
    }

    public Task SaveAsync(NotchSettings settings) => SaveDisplayAsync(null, settings, null);
    internal Task SaveDisplayAsync(NotchSettings? basis, NotchSettings incoming, string? displayId)
    {
        lock (_gate)
        {
            var merged = basis == null ? incoming.Clone() : MonitorWindowSettingsService.Merge(basis, incoming, _latest);
            merged.MonitorDockEdges = new(_latest.MonitorDockEdges, StringComparer.OrdinalIgnoreCase);
            if (merged.ShowOnAllMonitors || merged.MonitorDockEdges.Count > 0 || displayId != null)
                RecordPlacement(merged, displayId ?? primaryDisplayId?.Invoke(incoming) ?? incoming.MonitorDeviceId, incoming.DockEdge);
            _latest = merged.Clone();
            var previous = _writes;
            return _writes = WriteAfterAsync(previous, merged);
        }
    }
    private async Task WriteAfterAsync(Task previous, NotchSettings snapshot)
    {
        try { await previous.ConfigureAwait(false); }
        catch { /* A failed write must not block later attempts. Its caller still observes the failure. */ }
        await store.SaveAsync(snapshot).ConfigureAwait(false);
    }
    public void Save(NotchSettings settings) => SaveAsync(settings).GetAwaiter().GetResult();
    public void ExportSettingsToFile(string path, NotchSettings settings)
    {
        var snapshot = settings.Clone(); snapshot.MonitorDockEdges = Load().MonitorDockEdges;
        store.ExportSettingsToFile(path, snapshot);
    }
    public (NotchSettings Settings, bool RequiresRestart) ImportSettingsFromFile(string path, NotchSettings? current = null)
    {
        var result = store.ImportSettingsFromFile(path, current);
        lock (_gate) _latest = result.Settings.Clone();
        return result;
    }
}
