using System.Windows;
using VNotch.Controllers;
using VNotch.Models;
using VNotch.Services;
using VNotch.ViewModels;

namespace VNotch;

public partial class MainWindow
{
    private readonly MainWindow? _primaryDisplayWindow;
    internal bool IsSecondaryDisplay => _primaryDisplayWindow != null;
    internal NotchSettings DisplaySettings => _settings.Clone();
    internal event Action<MainWindow, NotchSettings>? DisplaySettingsChanged;

    private async Task PersistWindowSettingsAsync()
    {
        await _settingsService.SaveAsync(_settings.Clone());
        if (!_cleanedUp) DisplaySettingsChanged?.Invoke(this, _settingsService is MonitorWindowSettingsService
            ? _primaryDisplayWindow!._settingsService.Load() : _settings.Clone());
    }

    internal void ApplyDisplaySettings(NotchSettings global, MonitorSelection.Choice? binding = null)
    {
        if (_cleanedUp) return;
        var desired = binding == null ? global.Clone() : MonitorWindowSettingsService.Bind(global, binding.Id, binding.Index);
        if (_settingsService is MonitorWindowSettingsService local) local.UpdateBasis(global, binding?.Index);
        if (!_settings.ValueEquals(desired)) OnSettingsWindowSettingsChanged(null, desired);
        else PositionAtTop(); // Same identity can have new bounds/DPI after hotplug.
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
        window.Closed += (_, _) => { vm.Dispose(); coordinator.Dispose(); };
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
