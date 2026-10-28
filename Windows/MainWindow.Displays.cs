using System.Windows;
using VNotch.Controllers;
using VNotch.Models;
using VNotch.Services;
using VNotch.ViewModels;

namespace VNotch;

public partial class MainWindow
{
    private readonly MainWindow? _primaryDisplayWindow;
    private readonly HashSet<MainWindow> _displayWindows = new();
    internal bool IsSecondaryDisplay => _primaryDisplayWindow != null;
    private bool IsAnotherDisplayMoving
    {
        get
        {
            var owner = _primaryDisplayWindow ?? this;
            return (owner != this && owner.IsDockMoveInProgress) ||
                owner._displayWindows.Any(window => window != this && window.IsDockMoveInProgress);
        }
    }
    internal NotchSettings DisplaySettings => _settings.Clone();
    internal event Action<MainWindow, NotchSettings>? DisplaySettingsChanged;
    private (string Device, System.Drawing.Rectangle Bounds, double Scale)? _displayTopology;

    private async Task PersistWindowSettingsAsync()
    {
        await _settingsService.SaveAsync(_settings.Clone());
        if (!_cleanedUp) DisplaySettingsChanged?.Invoke(this,
            (_primaryDisplayWindow?._settingsService ?? _settingsService).Load());
    }

    internal void ApplyDisplaySettings(NotchSettings global, MonitorSelection.Choice? binding = null)
    {
        if (_cleanedUp) return;
        var desired = binding == null ? global.Clone() : MonitorWindowSettingsService.Bind(global, binding.Id, binding.Index);
        if (binding == null && desired.MonitorDockEdges.TryGetValue(MonitorSelection.ResolveId(desired), out var edge) && Enum.IsDefined(edge))
            desired.DockEdge = edge;
        if (_settingsService is MonitorWindowSettingsService local) local.UpdateBasis(global, binding?.Index);
        var display = MonitorSelection.Resolve(desired);
        var topology = (display.DeviceName, display.Bounds, MonitorSelection.GetScale(display));
        bool topologyChanged = _displayTopology != topology;
        _displayTopology = topology;
        // Other monitors' saved placements are metadata. Do not replay this
        // window's transitions or change its native bounds when only they change.
        _settings.MonitorDockEdges = desired.MonitorDockEdges;
        if (!_settings.ValueEquals(desired)) OnSettingsWindowSettingsChanged(null, desired);
        else if (topologyChanged) PositionAtTop();
    }

    internal MainWindow CreateDisplayWindow(MonitorSelection.Choice display)
    {
        var settings = new MonitorWindowSettingsService(_settingsService, () => _settings.Clone(), display.Id, display.Index);
        var coordinator = new NotchTransitionCoordinator();
        var vm = _viewModel.CreateDisplayViewModel(settings, coordinator);
        MainWindow window;
        try
        {
            window = new MainWindow(settings, _mediaService, vm, _updateService,
                new SharedModuleViewHost(_moduleHost), _batteryModule, _calendarModule, _bluetoothModule,
                _privacyModule, _weatherModule, _systemMonitorModule, new DisplaySpotlightObserver(_spotlightController),
                coordinator, displayContext: new SecondaryDisplayContext(this));
        }
        catch { vm.Dispose(); coordinator.Dispose(); throw; }
        _displayWindows.Add(window);
        window.Closed += (_, _) => { _displayWindows.Remove(window); vm.Dispose(); coordinator.Dispose(); };
        window.Loaded += (_, _) =>
        {
            if (_viewModel.Media.CurrentInfo is { } media) vm.ReplayMediaSnapshot(media);
        };
        return window;
    }

    private sealed class DisplaySpotlightObserver(ISpotlightController owner) : ISpotlightController
    {
        public bool IsHotkeyRegistered => owner.IsHotkeyRegistered;
        public void Initialize(Window host, NotchSettings settings) { }
        public void ApplySettings(NotchSettings settings) { }
        public void Dispose() { }
    }
}
