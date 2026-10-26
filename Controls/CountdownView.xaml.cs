using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using VNotch.Controllers;
using VNotch.Presenters;
using VNotch.Services;
using static VNotch.Services.AnimationPrimitives;

namespace VNotch.Controls;

public partial class CountdownView : UserControl, IDisposable
{
    /// <summary>
    /// The top keeps its transport row. Side docks put the same editable time
    /// inside a dial with the controls below, without creating a second clock.
    /// </summary>
    public void SetCompact(bool compact)
    {
        if (CountdownDisplayPanel == null) return;

        _authoredDisplayMinWidth ??= CountdownDisplayPanel.MinWidth;
        _authoredDisplayMargin ??= CountdownDisplayPanel.Margin;

        CountdownDisplayPanel.MinWidth = compact ? 0 : _authoredDisplayMinWidth.Value;
        CountdownDisplayPanel.Margin = compact
            ? new Thickness(0)
            : _authoredDisplayMargin.Value;
        _compact = compact;
        CancelEditing();
        _displayBackground ??= CountdownDisplayPanel.Background;
        _displayBorder ??= CountdownDisplayPanel.BorderBrush;
        var parent = (Panel)CountdownDisplayPanel.Parent;
        var target = compact ? RingHost : TransportGrid;
        if (parent != target)
        {
            parent.Children.Remove(CountdownDisplayPanel);
            target.Children.Add(CountdownDisplayPanel);
        }
        Grid.SetColumn(CountdownDisplayPanel, compact ? 0 : 2);
        CountdownDisplayPanel.Width = compact ? 144 : double.NaN;
        CountdownDisplayPanel.Height = compact ? 58 : 46;
        CountdownDisplayPanel.VerticalAlignment = VerticalAlignment.Center;
        CountdownDisplayPanel.HorizontalAlignment = compact ? HorizontalAlignment.Center : HorizontalAlignment.Stretch;
        CountdownDisplayPanel.Background = compact ? Brushes.Transparent : _displayBackground;
        CountdownDisplayPanel.BorderBrush = compact ? Brushes.Transparent : _displayBorder;
        CountdownDisplay.FontSize = compact ? 36 : 28;
        CountdownDisplay.Margin = compact ? new Thickness(0) : new Thickness(0, 0, 0, 5);
        CountdownProgressTrack.Visibility = compact ? Visibility.Collapsed : Visibility.Visible;
        TransportGrid.ColumnDefinitions[2].Width = compact ? new GridLength(0) : new GridLength(1, GridUnitType.Star);
        TransportGrid.HorizontalAlignment = compact ? HorizontalAlignment.Center : HorizontalAlignment.Stretch;
        SideTimerHeading.Visibility = RingHost.Visibility = compact ? Visibility.Visible : Visibility.Collapsed;
        ModeSelector.Visibility = Visibility.Visible;
        ModeSelector.Width = compact ? double.NaN : 210;
        ModeSelector.HorizontalAlignment = compact ? HorizontalAlignment.Stretch : HorizontalAlignment.Left;
        ModeSelector.Margin = compact ? new Thickness(0, 0, 0, 10) : new Thickness(0, 0, 0, 8);
        TimerModeButton.Padding = FocusModeButton.Padding = new Thickness(8, compact ? 8 : 5, 8, compact ? 8 : 5);
        UpdateFocusPresentation();
        if (_presenter != null) SetCountdownStartVisual(_controller?.IsRunning == true);
    }

    private bool _compact;
    private Brush? _displayBackground, _displayBorder;
    private PomodoroController? _pomodoro;
    internal PomodoroController Pomodoro => _pomodoro!;
    // The top's existing clock/calendar leave room for the small mode switch.
    // Only the focus-session footer needs extra height.
    public double ExtraTopHeight => _pomodoro?.IsEnabled == true ? 46 : 0;
    private double? _authoredDisplayMinWidth;
    private Thickness? _authoredDisplayMargin;

    private VNotch.ViewModels.TimerViewModel _viewModel = null!;
    private CountdownController? _controller;
    private CountdownPresenter? _presenter;
    private bool _disposed;
    private CountdownController CountdownController => Controller;
    private CountdownPresenter CountdownPresenter => _presenter!;
    public CountdownController Controller => _controller ?? throw new InvalidOperationException("Attach a TimerViewModel before using the countdown.");
    public event EventHandler? Completed;
    public event EventHandler? PreferredSizeChanged;
    public event Action<bool>? KeyboardInputRequested;

    public CountdownView()
    {
        InitializeComponent();
        SetCompact(false);
        IsVisibleChanged += (_, _) =>
        {
            if (!IsVisible)
            {
                StopCountdownRepeat();
                CancelTimerEditingInstant();
            }
            else
            {
                SetCountdownProgress(false);
            }
        };
    }

    public void Attach(VNotch.ViewModels.TimerViewModel viewModel)
    {
        ArgumentNullException.ThrowIfNull(viewModel);
        if (_controller != null) throw new InvalidOperationException("The countdown view is already attached.");
        _viewModel = viewModel;
        DataContext = viewModel;
        _controller = new CountdownController(viewModel, action =>
        {
            if (Dispatcher.CheckAccess()) action();
            else if (!Dispatcher.HasShutdownStarted) Dispatcher.BeginInvoke(action);
        });
        _pomodoro = new PomodoroController(_controller);
        _pomodoro.Changed += (_, _) =>
        {
            CancelEditing();
            SetCountdownStartVisual(_controller.IsRunning);
            UpdateFocusPresentation();
            SetCountdownProgress(false);
            PreferredSizeChanged?.Invoke(this, EventArgs.Empty);
        };
        _controller.Completed += (_, _) =>
        {
            if (_pomodoro.IsEnabled) return;
            SetCountdownStartVisual(false);
            Completed?.Invoke(this, EventArgs.Empty);
        };
        _controller.Tick += (_, _) => SetCountdownProgress(false);
        _presenter = new CountdownPresenter(new CountdownViewRefs
        {
            StartIcon = CountdownStartIcon,
            StartButton = CountdownStartBtn,
            StepperCapsule = CountdownStepperCapsule,
            DisplayScale = CountdownDisplayScale,
            DigitsBrush = CountdownDigitsBrush,
            PanelBorderBrush = CountdownPanelBorderBrush,
            PlusButton = CountdownPlusBtn,
            MinusButton = CountdownMinusBtn,
            PlusHighlight = CountdownPlusHighlight,
            MinusHighlight = CountdownMinusHighlight
        }, Dispatcher);
        UpdateFocusPresentation();
    }

    public void RefreshProgress() => SetCountdownProgress(false);
    public void CancelEditing() => CancelTimerEditingInstant();
    public void StopRepeat() => _presenter?.StopRepeat();

    public void RestorePresentation()
    {
        foreach (UIElement element in new UIElement[] { CountdownDisplay, CountdownProgressFill,
            CountdownDisplayPanel, CountdownStartBtn, CountdownResetBtn })
        {
            element.BeginAnimation(OpacityProperty, null);
            element.Opacity = 1;
        }
        CountdownStepperCapsule.BeginAnimation(OpacityProperty, null);
        CountdownStepperCapsule.Opacity = _controller?.IsRunning == true ? 0.4 : 1;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        CancelEditing();
        _pomodoro?.Dispose();
        _controller?.Dispose();
        _presenter?.Dispose();
        Completed = null;
        PreferredSizeChanged = null;
        KeyboardInputRequested = null;
    }

    private TimeSpan _countdownDuration => _viewModel.Duration;
    private bool _isCountdownRunning => CountdownController.IsRunning;

    private static readonly Color _countdownBorderIdleColor = Color.FromArgb(0x22, 0xFF, 0xFF, 0xFF);
    private static readonly Color _countdownBorderEditingColor = Color.FromArgb(0x8C, 0xFF, 0x8C, 0x00);
    private static readonly Color _countdownBorderErrorColor = Color.FromArgb(0xB4, 0xFF, 0x45, 0x3A);

    public void SetCountdownStartVisual(bool running)
    {
        CountdownPresenter.SetStartVisual(running);
        if (_compact)
        {
            bool resting = _pomodoro?.IsEnabled == true && _pomodoro.Phase != PomodoroPhase.Focus;
            CountdownStartBtn.Background = new SolidColorBrush(running ? Color.FromRgb(57, 57, 57)
                : resting ? Color.FromRgb(108, 218, 177) : Color.FromRgb(255, 173, 102));
            CountdownStartIcon.Fill = running ? Brushes.White : Brushes.Black;
        }
        else CountdownStartIcon.Fill = UiPalette.IconBrush;
        if (_pomodoro?.IsEnabled == true) CountdownStepperCapsule.IsHitTestVisible = false;
    }

    private void TimerMode_Click(object sender, MouseButtonEventArgs e) { e.Handled = true; _pomodoro?.SetEnabled(false); }
    private void FocusMode_Click(object sender, MouseButtonEventArgs e) { e.Handled = true; _pomodoro?.SetEnabled(true); }
    private void SkipPhase_Click(object sender, MouseButtonEventArgs e) { e.Handled = true; _pomodoro?.Skip(); }
    private void TimerMode_MenuClick(object sender, RoutedEventArgs e) { e.Handled = true; _pomodoro?.SetEnabled(false); }
    private void FocusMode_MenuClick(object sender, RoutedEventArgs e) { e.Handled = true; _pomodoro?.SetEnabled(true); }
    private void SkipPhase_MenuClick(object sender, RoutedEventArgs e) { e.Handled = true; _pomodoro?.Skip(); }

    private void UpdateFocusPresentation()
    {
        bool focus = _pomodoro?.IsEnabled == true;
        bool resting = focus && _pomodoro!.Phase != PomodoroPhase.Focus;
        var accent = new SolidColorBrush(resting ? Color.FromRgb(108, 218, 177) : Color.FromRgb(255, 173, 102));
        accent.Freeze();
        ProgressRing.Accent = accent;
        PhaseLabel.Foreground = accent;
        PhaseLabel.Text = !focus ? "COUNTDOWN" : _pomodoro!.Phase switch
        {
            PomodoroPhase.ShortBreak => "SHORT REST", PomodoroPhase.LongBreak => "LONG REST", _ => "FOCUS"
        };
        PhaseHint.Text = focus ? "25 focus · 5 rest · 15 long rest" : "Click time to edit";
        PhaseHint.FontSize = focus ? 9 : 10;
        RoundLabel.Text = $"SESSION {(_pomodoro?.Phase == PomodoroPhase.Focus ? _pomodoro.Round : Math.Max(1, _pomodoro?.CompletedSessions % 4 ?? 0))} / 4";
        if (focus && _pomodoro!.Phase == PomodoroPhase.LongBreak) RoundLabel.Text = "4 SESSIONS COMPLETE";
        NextPhaseLabel.Text = resting ? "Next · 25 min focus" : _pomodoro?.Round == 4 ? "Next · 15 min rest" : "Next · 5 min rest";
        FocusFooter.Visibility = focus ? Visibility.Visible : Visibility.Collapsed;
        if (focus && _pomodoro!.Phase != PomodoroPhase.LongBreak)
            RoundLabel.Text = PhaseLabel.Text + " · " + RoundLabel.Text;
        TimerModeButton.Background = focus ? Brushes.Transparent : new SolidColorBrush(Color.FromArgb(34, 255, 255, 255));
        FocusModeButton.Background = focus ? new SolidColorBrush(Color.FromArgb(38, 255, 173, 102)) : Brushes.Transparent;
        CountdownStepperCapsule.Visibility = _compact && focus ? Visibility.Collapsed : Visibility.Visible;
        SkipPhaseMenu.IsEnabled = focus;
        TimerModeMenu.IsChecked = !focus;
        FocusModeMenu.IsChecked = focus;
        CountdownDisplayPanel.ToolTip = focus ? $"Pomodoro · {PhaseLabel.Text}" : "Click to type a custom time — 12:30, 90, or 1h 20m";
        TimerControlBar.ToolTip = focus ? $"Pomodoro · {PhaseLabel.Text}. Reset restarts this phase." : "Countdown timer";
    }


    #region Timer View Microinteractions

    private void TimerControlButton_MouseEnter(object sender, MouseEventArgs e)
    {
        if (sender is Border button)
        {
            AnimateTimerButtonScale(button, 1.045);
        }
    }

    private void TimerControlButton_MouseLeave(object sender, MouseEventArgs e)
    {
        if (sender is Border button)
        {
            AnimateTimerButtonScale(button, 1.0);
        }
    }

    internal static void AnimateTimerButtonScale(Border button, double targetScale)
    {
        var scale = button.RenderTransform as ScaleTransform ?? new ScaleTransform(1, 1);
        button.RenderTransform = scale;
        button.RenderTransformOrigin = new Point(0.5, 0.5);

        var animX = MakeAnim(scale.ScaleX, targetScale, _dur150, _easeQuadOut);
        var animY = MakeAnim(scale.ScaleY, targetScale, _dur150, _easeQuadOut);
        Timeline.SetDesiredFrameRate(animX, VNotch.Services.AnimationConfig.TargetFps);
        Timeline.SetDesiredFrameRate(animY, VNotch.Services.AnimationConfig.TargetFps);

        scale.BeginAnimation(ScaleTransform.ScaleXProperty, animX);
        scale.BeginAnimation(ScaleTransform.ScaleYProperty, animY);
    }

    private static void PlayButtonPressAnimation(Border button) => ButtonFeedback.PlayButtonPressAnimation(button);

    private void PlayTimerButtonPress(Border button)
    {
        PlayButtonPressAnimation(button);
    }

    // Trigger digit scale bump on soft spring, glyph amber flash, and capsule
    // border pulse on state changes.
    private void AnimateCountdownDigitBump(double magnitude = 1.0)
    {
        CountdownPresenter.AnimateDigitBump(magnitude);
    }

    private void AnimateCountdownDigitFlash()
    {
        CountdownPresenter.AnimateDigitFlash();
    }

    private void AnimateCountdownPanelBorder(Color target, int durationMs)
    {
        CountdownPresenter.AnimatePanelBorder(target, durationMs);
    }

    private void AnimateCountdownPanelBorderFlash()
    {
        CountdownPresenter.AnimatePanelBorderFlash();
    }

    private Border? GetStepHighlight(object sender)
    {
        if (ReferenceEquals(sender, CountdownPlusBtn))
            return CountdownPlusHighlight;
        if (ReferenceEquals(sender, CountdownMinusBtn))
            return CountdownMinusHighlight;
        return null;
    }

    private void AnimateStepHighlightOpacity(Border highlight, double to, int durationMs)
    {
        CountdownPresenter.AnimateStepHighlightOpacity(highlight, to, durationMs);
    }

    private void FlashStepHighlight(Border highlight)
    {
        CountdownPresenter.FlashStepHighlight(highlight);
    }

    private void CountdownStepBtn_MouseEnter(object sender, MouseEventArgs e)
    {
        if (GetStepHighlight(sender) is { } highlight)
            AnimateStepHighlightOpacity(highlight, 0.08, 120);
    }

    #endregion


    private void CountdownMinus_Click(object sender, MouseButtonEventArgs e)
    {
        e.Handled = true;
        if (_isCountdownRunning || _pomodoro?.IsEnabled == true) return;
        if (_isEditingTimer) CommitTimerEditing(allowRetry: false);

        FlashStepHighlight(CountdownMinusHighlight);
        ApplyCountdownStep(-1);
        StartCountdownRepeat(-1);
    }

    private void CountdownPlus_Click(object sender, MouseButtonEventArgs e)
    {
        e.Handled = true;
        if (_isCountdownRunning || _pomodoro?.IsEnabled == true) return;
        if (_isEditingTimer) CommitTimerEditing(allowRetry: false);

        FlashStepHighlight(CountdownPlusHighlight);
        ApplyCountdownStep(+1);
        StartCountdownRepeat(+1);
    }

    private void ApplyCountdownStep(int direction)
    {
        if (CountdownController.AdjustDuration(direction))
        {
            SetCountdownProgress(animate: true);
            AnimateCountdownDigitBump();
        }
    }

    private void StartCountdownRepeat(int direction)
    {
        StopCountdownRepeat();
        CountdownPresenter.StartRepeat(() =>
        {
            if (_isCountdownRunning)
            {
                StopCountdownRepeat();
                return;
            }
            ApplyCountdownStep(direction);
        });
    }

    private void StopCountdownRepeat()
    {
        _presenter?.StopRepeat();
    }

    private void CountdownBtn_MouseLeaveOrUp(object sender, EventArgs e)
    {
        StopCountdownRepeat();
        if (GetStepHighlight(sender) is { } highlight)
        {
            // A mouse-up keeps the hover glow; a leave clears it.
            AnimateStepHighlightOpacity(highlight, e is MouseButtonEventArgs ? 0.08 : 0.0, 200);
        }
    }

    private void CountdownBtn_MouseLeave(object sender, MouseEventArgs e) => CountdownBtn_MouseLeaveOrUp(sender, e);
    private void CountdownBtn_MouseUp(object sender, MouseButtonEventArgs e) => CountdownBtn_MouseLeaveOrUp(sender, e);

    private void CountdownStart_Click(object sender, MouseButtonEventArgs e)
    {
        e.Handled = true;
        PlayTimerButtonPress(CountdownStartBtn);

        if (_isEditingTimer)
            CommitTimerEditing(allowRetry: false);

        if (_isCountdownRunning)
        {
            CountdownController.Pause();
            SetCountdownStartVisual(CountdownController.IsRunning);
            UpdateTimerDisplay();
        }
        else
        {
            CountdownController.Start();
            SetCountdownStartVisual(true);
        }
    }

    private void CountdownReset_Click(object sender, MouseButtonEventArgs e)
    {
        e.Handled = true;
        PlayTimerButtonPress(CountdownResetBtn);
        if (_isEditingTimer) CancelTimerEditing();
        if (_pomodoro?.IsEnabled == true) _pomodoro.ResetPhase();
        else CountdownController.Reset();
        SetCountdownStartVisual(false);
        SetCountdownProgress(animate: true);
        AnimateCountdownDigitBump(1.2);
    }

    private void UpdateTimerDisplay()
    {
        UpdateCountdownProgressFill();
    }

    private void CountdownDisplayPanel_SizeChanged(object sender, SizeChangedEventArgs e)
    {
        UpdateCountdownProgressFill();
    }

    private void UpdateCountdownProgressFill()
    {
        SetCountdownProgress(animate: false);
    }

    internal static double ComputeCountdownEdgeOpacity(double progress) => progress > 0.02 ? 1.0 : 0.0;

    internal static bool ShouldUpdateCountdownVisual(bool isTimerContentVisible, bool isExpanded) =>
        isTimerContentVisible && isExpanded;

    private void SetCountdownProgress(bool animate)
    {
        if (_disposed || _viewModel == null || !IsVisible)
            return;

        if (CountdownProgressScale == null || CountdownProgressEdge == null)
            return;

        double progress = Math.Clamp(_viewModel.Progress, 0, 1);
        ProgressRing.RemainingShare = 1 - progress;
        double edgeOpacity = ComputeCountdownEdgeOpacity(progress);

        if (animate)
        {
            var scaleAnim = MakeAnim(progress, new Duration(TimeSpan.FromMilliseconds(340)), _easeExpOut6);
            CountdownProgressScale.BeginAnimation(ScaleTransform.ScaleXProperty, scaleAnim);

            if (Math.Abs(CountdownProgressEdge.Opacity - edgeOpacity) > 0.001)
            {
                var edgeAnim = MakeAnim(edgeOpacity, _dur200, _easeQuadOut);
                CountdownProgressEdge.BeginAnimation(OpacityProperty, edgeAnim);
            }
        }
        else
        {
            CountdownProgressScale.BeginAnimation(ScaleTransform.ScaleXProperty, null);
            CountdownProgressScale.ScaleX = progress;

            if (Math.Abs(CountdownProgressEdge.Opacity - edgeOpacity) > 0.001)
            {
                CountdownProgressEdge.BeginAnimation(OpacityProperty, null);
                CountdownProgressEdge.Opacity = edgeOpacity;
            }
        }
    }

    #region Custom Time Input Editing

    private bool _isEditingTimer;

    private void CountdownDisplayPanel_Click(object sender, MouseButtonEventArgs e)
    {
        e.Handled = true;
        if (_pomodoro?.IsEnabled == true) return;
        if (_isEditingTimer) return;

        if (_isCountdownRunning)
        {
            CountdownController.Pause();
            SetCountdownStartVisual(false);
            UpdateTimerDisplay();
        }

        StartTimerEditing();
    }

    // Swap digits with animated text field carousel in edit mode with orange
    // border accent while typing.
    private void StartTimerEditing()
    {
        if (_isEditingTimer) return;
        _isEditingTimer = true;

        // Temporarily lift WS_EX_NOACTIVATE style so window can receive keyboard
        // focus and text input.
        KeyboardInputRequested?.Invoke(true);

        CountdownInput.Text = _viewModel.DisplayText;

        var durOut = new Duration(TimeSpan.FromMilliseconds(110));
        var durIn = new Duration(TimeSpan.FromMilliseconds(360));
        var inDelay = TimeSpan.FromMilliseconds(50);

        var digitsFade = MakeAnim(CountdownDisplay.Opacity > 0 ? CountdownDisplay.Opacity : 1.0, 0.0, durOut, _easeQuadIn, null);
        digitsFade.Completed += (_, _) =>
        {
            if (_isEditingTimer) CountdownDisplay.Visibility = Visibility.Collapsed;
        };
        var digitsRise = MakeAnim(CountdownDisplayTranslate.Y, -11.0, durOut, _easeQuadIn, null);
        var digitsShrinkX = MakeAnim(1.0, 0.94, durOut, _easeQuadIn, null);
        var digitsShrinkY = MakeAnim(1.0, 0.94, durOut, _easeQuadIn, null);
        CountdownDisplay.BeginAnimation(OpacityProperty, digitsFade);
        CountdownDisplayTranslate.BeginAnimation(TranslateTransform.YProperty, digitsRise);
        CountdownDisplayScale.BeginAnimation(ScaleTransform.ScaleXProperty, digitsShrinkX);
        CountdownDisplayScale.BeginAnimation(ScaleTransform.ScaleYProperty, digitsShrinkY);

        CountdownInput.BeginAnimation(OpacityProperty, null);
        CountdownInputTranslate.BeginAnimation(TranslateTransform.XProperty, null);
        CountdownInputTranslate.X = 0;
        CountdownInput.Visibility = Visibility.Visible;
        CountdownInput.Opacity = 0;

        var inputFade = MakeAnim(0.0, 1.0, _dur200, _easeQuadOut, inDelay);
        var inputRise = MakeAnim(12.0, 0.0, durIn, _easeExpOut6, inDelay);
        var inputGrowX = MakeAnim(0.97, 1.0, durIn, _easeSoftSpring, inDelay);
        var inputGrowY = MakeAnim(0.97, 1.0, durIn, _easeSoftSpring, inDelay);
        CountdownInput.BeginAnimation(OpacityProperty, inputFade);
        CountdownInputTranslate.BeginAnimation(TranslateTransform.YProperty, inputRise);
        CountdownInputScale.BeginAnimation(ScaleTransform.ScaleXProperty, inputGrowX);
        CountdownInputScale.BeginAnimation(ScaleTransform.ScaleYProperty, inputGrowY);

        AnimateCountdownPanelBorder(_countdownBorderEditingColor, 240);
        var trackDim = MakeAnim(0.3, _dur200, _easeQuadOut);
        CountdownProgressTrack.BeginAnimation(OpacityProperty, trackDim);

        CountdownInput.Focus();
        Keyboard.Focus(CountdownInput);
        CountdownInput.SelectAll();
    }

    private void ExitTimerEditing()
    {
        if (!_isEditingTimer) return;
        _isEditingTimer = false;

        KeyboardInputRequested?.Invoke(false);

        var durOut = new Duration(TimeSpan.FromMilliseconds(110));
        var durIn = new Duration(TimeSpan.FromMilliseconds(360));
        var inDelay = TimeSpan.FromMilliseconds(50);

        var inputFade = MakeAnim(CountdownInput.Opacity > 0 ? CountdownInput.Opacity : 1.0, 0.0, durOut, _easeQuadIn, null);
        inputFade.Completed += (_, _) =>
        {
            if (!_isEditingTimer) CountdownInput.Visibility = Visibility.Collapsed;
        };
        var inputDrop = MakeAnim(0.0, 12.0, durOut, _easeQuadIn, null);
        var inputShrinkX = MakeAnim(1.0, 0.97, durOut, _easeQuadIn, null);
        var inputShrinkY = MakeAnim(1.0, 0.97, durOut, _easeQuadIn, null);
        CountdownInput.BeginAnimation(OpacityProperty, inputFade);
        CountdownInputTranslate.BeginAnimation(TranslateTransform.YProperty, inputDrop);
        CountdownInputScale.BeginAnimation(ScaleTransform.ScaleXProperty, inputShrinkX);
        CountdownInputScale.BeginAnimation(ScaleTransform.ScaleYProperty, inputShrinkY);

        CountdownDisplay.BeginAnimation(OpacityProperty, null);
        CountdownDisplay.Visibility = Visibility.Visible;
        CountdownDisplay.Opacity = 0;

        var digitsFade = MakeAnim(0.0, 1.0, _dur200, _easeQuadOut, inDelay);
        var digitsDrop = MakeAnim(-11.0, 0.0, durIn, _easeExpOut6, inDelay);
        var digitsGrowX = MakeAnim(0.94, 1.0, durIn, _easeSoftSpring, inDelay);
        var digitsGrowY = MakeAnim(0.94, 1.0, durIn, _easeSoftSpring, inDelay);
        CountdownDisplay.BeginAnimation(OpacityProperty, digitsFade);
        CountdownDisplayTranslate.BeginAnimation(TranslateTransform.YProperty, digitsDrop);
        CountdownDisplayScale.BeginAnimation(ScaleTransform.ScaleXProperty, digitsGrowX);
        CountdownDisplayScale.BeginAnimation(ScaleTransform.ScaleYProperty, digitsGrowY);

        AnimateCountdownPanelBorder(_countdownBorderIdleColor, 260);
        var trackRestore = MakeAnim(1.0, _dur200, _easeQuadOut);
        CountdownProgressTrack.BeginAnimation(OpacityProperty, trackRestore);

        Keyboard.ClearFocus();
    }

    // Instant teardown for view switches: no animations, just a clean idle state.
    private void CancelTimerEditingInstant()
    {
        if (!_isEditingTimer) return;
        _isEditingTimer = false;

        KeyboardInputRequested?.Invoke(false);

        CountdownInput.BeginAnimation(OpacityProperty, null);
        CountdownInputTranslate.BeginAnimation(TranslateTransform.XProperty, null);
        CountdownInputTranslate.BeginAnimation(TranslateTransform.YProperty, null);
        CountdownInputScale.BeginAnimation(ScaleTransform.ScaleXProperty, null);
        CountdownInputScale.BeginAnimation(ScaleTransform.ScaleYProperty, null);
        CountdownInput.Opacity = 0;
        CountdownInput.Visibility = Visibility.Collapsed;

        CountdownDisplay.BeginAnimation(OpacityProperty, null);
        CountdownDisplayTranslate.BeginAnimation(TranslateTransform.YProperty, null);
        CountdownDisplayScale.BeginAnimation(ScaleTransform.ScaleXProperty, null);
        CountdownDisplayScale.BeginAnimation(ScaleTransform.ScaleYProperty, null);
        CountdownDisplayTranslate.Y = 0;
        CountdownDisplayScale.ScaleX = 1.0;
        CountdownDisplayScale.ScaleY = 1.0;
        CountdownDisplay.Opacity = 1;
        CountdownDisplay.Visibility = Visibility.Visible;

        CountdownPanelBorderBrush.BeginAnimation(SolidColorBrush.ColorProperty, null);
        CountdownPanelBorderBrush.Color = _countdownBorderIdleColor;
        CountdownProgressTrack.BeginAnimation(OpacityProperty, null);
        CountdownProgressTrack.Opacity = 1;

        Keyboard.ClearFocus();
    }

    private void CommitTimerEditing(bool allowRetry)
    {
        if (!_isEditingTimer) return;
        string input = CountdownInput.Text;

        if (_viewModel.TryParseCustomTime(input, out TimeSpan customTime))
        {
            CountdownController.SetCustomDuration(customTime);
            ExitTimerEditing();
            SetCountdownProgress(animate: true);
            AnimateCountdownDigitFlash();
            AnimateCountdownPanelBorderFlash();
            return;
        }

        if (allowRetry && !string.IsNullOrWhiteSpace(input))
        {
            // Unparsable entry on Enter: shake it off and let the user retype.
            AnimateCountdownInputShake();
            return;
        }

        ExitTimerEditing();
    }

    private void CancelTimerEditing()
    {
        if (!_isEditingTimer) return;
        ExitTimerEditing();
    }

    private void AnimateCountdownInputShake()
    {
        var shake = new DoubleAnimationUsingKeyFrames
        {
            Duration = new Duration(TimeSpan.FromMilliseconds(380))
        };
        shake.KeyFrames.Add(new EasingDoubleKeyFrame(0, KeyTime.FromTimeSpan(TimeSpan.Zero)));
        shake.KeyFrames.Add(new EasingDoubleKeyFrame(-8, KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(60)), _easeQuadOut));
        shake.KeyFrames.Add(new EasingDoubleKeyFrame(7, KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(140)), _easeQuadOut));
        shake.KeyFrames.Add(new EasingDoubleKeyFrame(-4, KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(220)), _easeQuadOut));
        shake.KeyFrames.Add(new EasingDoubleKeyFrame(2, KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(300)), _easeQuadOut));
        shake.KeyFrames.Add(new EasingDoubleKeyFrame(0, KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(380)), _easeQuadOut));
        Timeline.SetDesiredFrameRate(shake, VNotch.Services.AnimationConfig.TargetFps);
        CountdownInputTranslate.BeginAnimation(TranslateTransform.XProperty, shake);

        var error = new ColorAnimation(_countdownBorderErrorColor, new Duration(TimeSpan.FromMilliseconds(90)))
        {
            EasingFunction = _easeQuadOut
        };
        Timeline.SetDesiredFrameRate(error, VNotch.Services.AnimationConfig.TargetFps);
        error.Completed += (_, _) =>
        {
            if (_isEditingTimer) AnimateCountdownPanelBorder(_countdownBorderEditingColor, 420);
        };
        CountdownPanelBorderBrush.BeginAnimation(SolidColorBrush.ColorProperty, error);

        CountdownInput.SelectAll();
    }

    private void CountdownInput_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            e.Handled = true;
            CommitTimerEditing(allowRetry: true);
        }
        else if (e.Key == Key.Escape)
        {
            e.Handled = true;
            CancelTimerEditing();
        }
    }

    private void CountdownInput_LostFocus(object sender, RoutedEventArgs e)
    {
        CommitTimerEditing(allowRetry: false);
    }

    #endregion


}
