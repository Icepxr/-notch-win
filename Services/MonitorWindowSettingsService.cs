using System.Reflection;
using VNotch.Models;

namespace VNotch.Services;

/// <summary>A display binding is local; preference changes merge into the app's shared settings.</summary>
internal sealed class MonitorWindowSettingsService(ISettingsService store,
    Func<NotchSettings> currentSettings, string monitorId, int monitorIndex) : ISettingsService
{
    private NotchSettings _basis = Bind(currentSettings(), monitorId, monitorIndex);
    private static readonly PropertyInfo[] Properties = typeof(NotchSettings).GetProperties()
        .Where(p => p.CanRead && p.CanWrite && p.GetIndexParameters().Length == 0 &&
            p.Name is not nameof(NotchSettings.MonitorDeviceId) and not nameof(NotchSettings.MonitorIndex)
                and not nameof(NotchSettings.IsDirty)).ToArray();

    internal static NotchSettings Bind(NotchSettings settings, string id, int index)
    {
        var bound = settings.Clone(); bound.MonitorDeviceId = id; bound.MonitorIndex = index; return bound;
    }
    internal void UpdateBasis(NotchSettings settings, int? index = null)
    {
        if (index.HasValue) monitorIndex = index.Value;
        _basis = Bind(settings, monitorId, monitorIndex);
    }
    public NotchSettings Load() => _basis.Clone();
    internal static NotchSettings Merge(NotchSettings basis, NotchSettings incoming, NotchSettings latest)
    {
        var merged = latest.Clone();
        foreach (var property in Properties)
        {
            var before = property.GetValue(basis); var after = property.GetValue(incoming);
            bool equal = before is LiquidGlassConfig glass ? glass.ValueEquals(after as LiquidGlassConfig) : Equals(before, after);
            if (!equal) property.SetValue(merged, after);
        }
        return merged.Clone();
    }
    public void Save(NotchSettings settings)
    {
        var merged = Merge(_basis, settings, currentSettings()); store.Save(merged); UpdateBasis(merged);
    }
    public async Task SaveAsync(NotchSettings settings)
    {
        var merged = Merge(_basis, settings, currentSettings());
        await store.SaveAsync(merged); UpdateBasis(merged);
    }
    public void ExportSettingsToFile(string path, NotchSettings settings) => store.ExportSettingsToFile(path, Merge(_basis, settings, currentSettings()));
    public (NotchSettings Settings, bool RequiresRestart) ImportSettingsFromFile(string path, NotchSettings? current = null)
        => store.ImportSettingsFromFile(path, current);
}
