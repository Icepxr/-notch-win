using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using VNotch.Models;
using VNotch.Presenters;
using VNotch.Services;

namespace VNotch;

public partial class MainWindow : IClockWidgetHost
{
    #region Clock View geometry constants (read by MainWindow.Timer.cs)

    private const double _clockViewWidth = 600;
    private double _clockViewHeight => 310 + CountdownWidget.ExtraTopHeight;

    #endregion

    #region ClockWidgetPresenter wiring

    private ClockWidgetPresenter? _clockWidgetPresenter;

    internal void InitializeClockWidgetPresenter()
    {
        if (_clockWidgetPresenter != null) return;

        var refs = new ClockWidgetViewRefs
        {
            ClockWidget = ClockWidget,
            WordClockWidget = WordClockWidget,
            DigitalClockWidget = DigitalClockWidget,
            WeatherWidgetContent = WeatherWidgetView,
            SystemMonitorWidgetContent = SystemMonitorWidgetContent,
            CalendarStripContainer = CalendarStripContainer,
            MonthText = MonthText,
            DayText = DayText,
            GreetingSection = GreetingSection,
            EventText = EventText,
            CalendarWidget = CalendarWidget,
            CalendarInnerContent = CalendarInnerContent,
            ClockViewWeekHeader = ClockViewWeekHeader,
            ClockViewDayGrid = ClockViewDayGrid,
            ClockViewMonthText = ClockViewMonthText,
            TimerContent = TimerContent,
            NotchBorder = NotchBorder,
            Window = this,
        };

        _clockWidgetPresenter = new ClockWidgetPresenter(this, refs);
    }

    internal void DisposeClockWidgetPresenter()
    {
        _clockWidgetPresenter?.Dispose();
        _clockWidgetPresenter = null;
    }

    #endregion

    #region Shell shims → ClockWidgetPresenter

    private ClockWidgetPresenter EnsureClockWidgetPresenterLoaded()
    {
        if (_clockWidgetPresenter == null) InitializeClockWidgetPresenter();
        return _clockWidgetPresenter!;
    }

    private ClockWidgetPresenter EnsureClockViewFeatureLoaded()
    {
        var presenter = EnsureClockWidgetPresenterLoaded();
        presenter.BuildClockViewCalendar();
        return presenter;
    }

    internal void BuildClockViewCalendar()
    {
        EnsureClockViewFeatureLoaded();
    }

    private void RefreshClockView() => EnsureClockViewFeatureLoaded().RefreshClockView();

    private void RefreshClockViewLocale() => _clockWidgetPresenter?.RefreshClockViewLocale();

    private bool _clockViewCalendarBuilt => _clockWidgetPresenter?.IsCalendarBuilt ?? false;

    private void UpdateClockViewCalendar(DateTime now) => _clockWidgetPresenter?.UpdateClockViewCalendar(now);

    private void PrepareClockViewContentSize()
    {
        EnsureClockWidgetPresenterLoaded().PrepareClockViewContentSize();
        if (!IsDockVertical) TimerContent.Height += CountdownWidget.ExtraTopHeight;
    }

    private void ApplyClockViewWindowSize() => ResizeHostWindowHeight(_clockViewHeight);

    // Both of these grow the host downwards from the top edge, which is the
    // axis the notch morphs along only while it hangs from the top. On a side
    // edge that axis runs along the edge and the host is already sized for the
    // longest page there is, so the host is left alone.
    private void RestoreExpandedWindowSize()
    {
        if (IsDockVertical) return;
        EnsureClockWidgetPresenterLoaded().RestoreExpandedWindowSize();
    }

    private void ResizeHostWindowHeight(double notchHeightDip)
    {
        if (IsDockVertical) return;
        EnsureClockWidgetPresenterLoaded().ResizeHostWindowHeight(notchHeightDip);
    }

#pragma warning disable S107 // WPF notch resize transition requires source, target, timing, and callback parameters
    private void AnimateClockViewNotchResize(double fromWidth, double fromHeight,
        double toWidth, double toHeight, Duration duration, TimeSpan delay, Action? onCompleted = null, int? generation = null)
        => EnsureClockWidgetPresenterLoaded().AnimateClockViewNotchResize(
            fromWidth, fromHeight, toWidth, toHeight, duration, delay, onCompleted, generation);
#pragma warning restore S107

    #endregion

    #region IClockWidgetHost (adapter onto the shared shell state)

    NotchSettings IClockWidgetHost.Settings => _settings;
    void IClockWidgetHost.SaveSettings() => _settingsService.SaveAsync(_settings).SafeFireAndForget("SETTINGS-SAVE");

    bool IClockWidgetHost.IsAnimating { get => _isAnimating; set => _isAnimating = value; }
    bool IClockWidgetHost.IsSecondaryView => _isSecondaryView;
    bool IClockWidgetHost.IsExpanded => _isExpanded;
    bool IClockWidgetHost.IsTimerView => _isTimerView;
    bool IClockWidgetHost.IsLyricsActive => _isLyricsActive;
    int IClockWidgetHost.TransitionGeneration => _viewTransitionGeneration;

    Brush IClockWidgetHost.TransparentBrush => _brushTransparent;
    Brush IClockWidgetHost.WhiteBrush => VNotch.Services.UiPalette.PrimaryBrush;

    void IClockWidgetHost.SwitchToTimerView() => SwitchToTimerView();
    void IClockWidgetHost.CollapseNotch() => CollapseNotch();

    IntPtr IClockWidgetHost.Hwnd => _hwnd;
    int IClockWidgetHost.FixedX => _fixedX;
    int IClockWidgetHost.FixedY => _fixedY;
    int IClockWidgetHost.WindowWidth => _windowWidth;
    int IClockWidgetHost.WindowHeight { get => _windowHeight; set => _windowHeight = value; }
    double IClockWidgetHost.ExpandedHeight => _expandedHeight;
    double IClockWidgetHost.MaxExpandedHeight => MaxExpandedNotchHeight;

    Window IClockWidgetHost.Window => this;

    #endregion
}
