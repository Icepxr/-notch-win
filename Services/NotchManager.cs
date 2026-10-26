using System.Windows;
using System.Windows.Forms;
using VNotch.Contracts;
using VNotch.Controllers;
using VNotch.Models;

namespace VNotch.Services;

public sealed class NotchManager : INotchManager
{
    private NotchSettings _settings;
    private readonly HoverDetectionService _hoverService;

    private Screen? _currentScreen;
    private Rect _safeArea;
    private bool _disposed;

    public NotchTransitionCoordinator TransitionCoordinator { get; }
    public HoverDetectionService HoverService => _hoverService;
    public Rect SafeArea => _safeArea;

    public event EventHandler<Rect>? SafeAreaChanged;
    public event EventHandler? PositionUpdated;

    public NotchManager(Window window, NotchSettings settings, NotchTransitionCoordinator transitionCoordinator)
    {
        _settings = settings;
        TransitionCoordinator = transitionCoordinator;
        _hoverService = new HoverDetectionService(settings.HoverZoneMargin, window);

        _hoverService.Start();
    }

    public void UpdateSettings(NotchSettings settings)
    {
        _settings = settings;
        AnimationConfig.Configure(settings.AnimationFps, settings.AutoAnimationFps);

        UpdatePosition();
    }

    public void UpdatePosition()
    {
        _currentScreen = GetTargetScreen();

        AnimationConfig.Refresh(_currentScreen.DeviceName);

        _hoverService.UpdateNotchBounds(DockEdge, ShellBounds());

        UpdateSafeArea();

        PositionUpdated?.Invoke(this, EventArgs.Empty);
    }

    /// <summary>The edge in force, which is the top whenever edge docking is off.</summary>
    private Models.NotchEdge DockEdge => NotchDock.Active(_settings.DockEdge, _settings.EnableEdgeDocking);

    /// <summary>
    /// The collapsed shell on screen, in physical pixels. A side dock turns the
    /// pill on its end and stands it in the middle of that edge.
    /// </summary>
    private Rect ShellBounds()
    {
        var screen = _currentScreen!.Bounds;
        double scale = MonitorSelection.GetScale(_currentScreen);
        var edge = DockEdge;
        var shell = NotchDock.Rotate(edge, _settings.Width * scale, _settings.Height * scale);

        if (!NotchDock.IsVertical(edge))
            return new Rect(screen.Left + (screen.Width - shell.Width) / 2, screen.Top, shell.Width, shell.Height);

        double top = screen.Top + (screen.Height - shell.Height) / 2;
        double left = edge == Models.NotchEdge.Left ? screen.Left : screen.Left + screen.Width - shell.Width;
        return new Rect(left, top, shell.Width, shell.Height);
    }

    private void UpdateSafeArea()
    {
        if (_currentScreen == null) return;

        _safeArea = NotchDock.SafeArea(DockEdge, ShellBounds(), 4);

        SafeAreaChanged?.Invoke(this, _safeArea);
    }

    private Screen GetTargetScreen()
    {
        return MonitorSelection.Resolve(_settings);
    }

    public static int GetMonitorCount()
    {
        return Screen.AllScreens.Length;
    }

    public static string[] GetMonitorNames()
    {
        return Screen.AllScreens
            .Select((s, i) => Loc.Get("settings.display.name", i + 1) + (s.Primary ? Loc.Get("settings.display.primary") : ""))
            .ToArray();
    }

    #region Public Controls

    public void Expand(NotchExpandMode mode = NotchExpandMode.Compact)
    {
        TransitionCoordinator.RequestView(NotchView.Media, $"NotchManager.Expand({mode})");
    }

    public void Collapse()
    {
        TransitionCoordinator.RequestCollapse("NotchManager.Collapse");
    }

    public void Hide()
    {
        _hoverService.Stop();
        TransitionCoordinator.SetEffectivelyVisible(false, "NotchManager.Hide");
    }

    public void Show()
    {
        _hoverService.Start();
        TransitionCoordinator.SetEffectivelyVisible(true, "NotchManager.Show");
    }

    #endregion

    public void Dispose()
    {
        if (!_disposed)
        {
            _hoverService.Dispose();
            _disposed = true;
        }
    }
}
