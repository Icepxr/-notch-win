using VNotch.Models;

namespace VNotch.Services;

/// <summary>Reconcile connected display identities; unaffected windows retain their UI state.</summary>
internal sealed class MultiMonitorWindowSet<T>(Func<MonitorSelection.Choice, T> create, Action<T> close,
    Action<T, NotchSettings, MonitorSelection.Choice> update) where T : class
{
    private readonly Dictionary<string, T> _windows = new(StringComparer.OrdinalIgnoreCase);
    internal IReadOnlyDictionary<string, T> Windows => _windows;
    internal void Reconcile(NotchSettings settings, IEnumerable<MonitorSelection.Choice> connected, string primaryId)
    {
        var wanted = settings.ShowOnAllMonitors ? connected.Where(c => c.Screen != null &&
            !string.Equals(c.Id, primaryId, StringComparison.OrdinalIgnoreCase))
            .DistinctBy(c => c.Id, StringComparer.OrdinalIgnoreCase).ToDictionary(c => c.Id, StringComparer.OrdinalIgnoreCase)
            : new Dictionary<string, MonitorSelection.Choice>(StringComparer.OrdinalIgnoreCase);
        foreach (string id in _windows.Keys.Where(id => !wanted.ContainsKey(id)).ToArray())
        {
            var old = _windows[id]; _windows.Remove(id); close(old);
        }
        foreach (var (id, display) in wanted)
        {
            if (!_windows.TryGetValue(id, out var window)) { window = create(display); _windows.Add(id, window); }
            update(window, settings, display);
        }
    }
    internal void Clear()
    {
        var old = _windows.Values.ToArray(); _windows.Clear(); foreach (var window in old) close(window);
    }
}
