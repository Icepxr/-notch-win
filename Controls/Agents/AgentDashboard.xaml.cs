// Local customization: observe only while visible; no network refresh is automatic.
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using VNotch.Services.Agents;

namespace VNotch.Controls.Agents;

public partial class AgentDashboard : UserControl, IDisposable
{
    public static readonly DependencyProperty IsColumnLayoutProperty = DependencyProperty.Register(
        nameof(IsColumnLayout), typeof(bool), typeof(AgentDashboard), new PropertyMetadata(false));
    public bool IsColumnLayout
    {
        get => (bool)GetValue(IsColumnLayoutProperty);
        private set => SetValue(IsColumnLayoutProperty, value);
    }
    /// <summary>
    /// Local customization: the dashboard is a two-up grid of cards with its
    /// title and its filters each sharing a line. A column has room for one
    /// card across and nothing beside a title, so the cards run one per row
    /// and both header lines stand up. Everything restores, because the cells
    /// it transposes are the ones that were authored.
    /// </summary>
    public void SetColumnLayout(bool vertical)
    {
        IsColumnLayout = vertical;
        VNotch.Services.GridFlip.SetVertical(AgentTitleRow, vertical);
        VNotch.Services.GridFlip.SetVertical(AgentFilterRow, vertical);

        // Two buttons side by side need more than a column has. Stood up they
        // each get the width, and the gap between them turns with them.
        if (AgentTitleActions != null)
        {
            AgentTitleActions.Orientation = Orientation.Horizontal;
            AgentTitleActions.Margin = vertical ? new Thickness(0, 8, 0, 0) : default;
            if (DetailsButton != null)
                DetailsButton.Margin = new Thickness(0, 0, 6, 0);
        }

        if (Providers == null) return;

        int columns = vertical ? 1 : 2;
        if (_providerColumns == columns) return;
        _providerColumns = columns;

        var panel = new FrameworkElementFactory(typeof(System.Windows.Controls.Primitives.UniformGrid));
        panel.SetValue(System.Windows.Controls.Primitives.UniformGrid.ColumnsProperty, columns);
        Providers.ItemsPanel = new ItemsPanelTemplate(panel);
    }

    private int _providerColumns = 2;

    private IAgentMonitor? _monitor;
    private readonly DispatcherTimer _timer = new() { Interval = TimeSpan.FromSeconds(5) };
    private CancellationTokenSource? _visible;
    private bool _reading, _pending, _checking, _disposed;
    private int _days = 1;
    private DateTimeOffset _lastAccountRequest = DateTimeOffset.MinValue;
    private AgentSnapshot? _lastSnapshot;
    public AgentDashboard()
    {
        InitializeComponent();
        _timer.Tick += (_, _) => { UpdateRefresh(); _ = ReadAsync(); };
    }
    internal void Attach(IAgentMonitor monitor) { _monitor = monitor; if (IsVisible && IsLoaded) Start(); }
    private void Dashboard_Loaded(object sender, RoutedEventArgs e) { if (IsVisible) Start(); }
    private void Dashboard_Unloaded(object sender, RoutedEventArgs e) => Stop();
    private void Visibility_Changed(object sender, DependencyPropertyChangedEventArgs e) { if (IsVisible && IsLoaded) Start(); else Stop(); }
    private void Start()
    {
        if (_disposed || _monitor == null || _visible != null) return;
        _visible = new(); _timer.Start(); _ = ReadAsync();
    }
    private void Stop()
    {
        _timer.Stop(); _visible?.Cancel(); _visible?.Dispose(); _visible = null;
        _pending = false;
        _lastSnapshot = null;
        if (Breakdowns != null) Breakdowns.ItemsSource = null;
    }
    private async Task ReadAsync()
    {
        var lifetime = _visible; if (lifetime == null || _monitor == null) return;
        if (_reading) { _pending = true; return; }
        _reading = true; int days = _days;
        try
        {
            var snapshot = await _monitor.ReadAsync(days, lifetime.Token);
            if (ReferenceEquals(lifetime, _visible) && days == _days) Present(snapshot);
        }
        catch (OperationCanceledException) { }
        catch (Exception ex) when (ex is System.IO.IOException or UnauthorizedAccessException or InvalidOperationException)
        { if (ReferenceEquals(lifetime, _visible)) ReadStatus.Text = "Local activity is unavailable. Try reopening this tab."; }
        finally
        {
            _reading = false;
            if (_pending && _visible != null) { _pending = false; _ = Dispatcher.BeginInvoke(() => _ = ReadAsync()); }
        }
    }
    internal void Present(AgentSnapshot snapshot)
    {
        if (_disposed) return;
        _lastSnapshot = snapshot;
        var now = snapshot.Updated;
        object Mark(string provider) => FindResource(provider == "Codex" ? "AgentOpenAiMark" : "AgentClaudeMark");
        string Exact(long value) => value.ToString("N0", CultureInfo.InvariantCulture);
        Providers.ItemsSource = snapshot.Providers.Select(provider =>
        {
            var totals = AgentUsageTotals.Sum(provider.Records);
            return new
            {
                provider.Name, Mark = Mark(provider.Name),
                Badge = provider.Account.Windows.Count == 0 ? "" : provider.Account.Windows.Any(w => w.Expired(now) || w.Stale(now) || w.Source != "Account") ? "Snapshot" : "Live",
                Windows = provider.Account.Windows.Select(window => new
                {
                    window.Name, Value = window.Expired(now) ? "—" : window.Remaining.ToString("0", CultureInfo.InvariantCulture) + "%",
                    Observed = window.Source + " · " + window.Observed.LocalDateTime.ToString("g") + " · " + window.Used.ToString("0.#") + "% used" + (window.Reset is { } reset ? " · Resets " + reset.LocalDateTime.ToString("g") : ""),
                    Remaining = window.Remaining, BarVisibility = window.Expired(now) ? Visibility.Collapsed : Visibility.Visible,
                    Reset = ResetText(window, now), AccessibleValue = window.Name + ": " + (window.Expired(now) ? "Reset due; refresh required" : window.Remaining.ToString("0") + " percent remaining")
                }).ToArray(),
                EmptyVisibility = provider.Account.Windows.Count == 0 ? Visibility.Visible : Visibility.Collapsed,
                LoginVisibility = provider.Account.Status.Contains("sign", StringComparison.OrdinalIgnoreCase) ? Visibility.Visible : Visibility.Collapsed,
                provider.Account.Status,
                Tokens = provider.Records.Count == 0 ? "—" : Compact(totals.Total),
                ExactTokens = Exact(totals.Total) + " observed tokens · includes cached input once",
                Input = provider.Records.Count == 0 ? "—" : Compact(totals.Input),
                Output = provider.Records.Count == 0 ? "—" : Compact(totals.Output),
                Cached = provider.Records.Count == 0 ? "—" : Compact(totals.Cached),
                ExactInput = Exact(totals.Input) + " input tokens, including cache reads and writes where reported",
                ExactOutput = Exact(totals.Output) + " output tokens",
                ExactCached = Exact(totals.Cached) + " cached input tokens · a subset of input, not extra tokens",
                Responses = provider.Records.Count == 0 ? "—" : provider.Records.Count.ToString("N0", CultureInfo.InvariantCulture),
                Note = provider.Partial ? "Partial local coverage · recent file tails" : provider.Records.Count == 0 ? "No local usage records in this period" : "Observed local records · " + provider.Sessions.Count + " recent sessions"
            };
        }).ToArray();
        if (UsageDetails.Visibility == Visibility.Visible) PresentBreakdowns(snapshot);
        var allSessions = snapshot.Providers.SelectMany(p => p.Sessions).OrderBy(s => s.State == "Working" ? 0 : 1).ThenByDescending(s => s.Updated).ToArray();
        var sessions = allSessions.Take(12).ToArray();
        Sessions.ItemsSource = sessions.Select(session => new { session.Name, session.State, Mark = Mark(session.Provider), Detail = session.Project + " · " + session.Updated.LocalDateTime.ToString("HH:mm") }).ToArray();
        EmptyActivity.Visibility = sessions.Length == 0 ? Visibility.Visible : Visibility.Collapsed;
        int working = allSessions.Count(s => s.State == "Working");
        ActivityCount.Text = (working > 0 ? working + " working" : allSessions.Length + " sessions") + (allSessions.Length > 12 ? " · 12 shown" : "");
        if (!_checking) ReadStatus.Text = "Updated " + now.LocalDateTime.ToString("HH:mm:ss") + " · " + (_days == 1 ? "Today" : _days + " days");
    }
    private void PresentBreakdowns(AgentSnapshot snapshot)
    {
        var now = snapshot.Updated;
        object Mark(string provider) => FindResource(provider == "Codex" ? "AgentOpenAiMark" : "AgentClaudeMark");
        string Exact(long value) => value.ToString("N0", CultureInfo.InvariantCulture);
        Breakdowns.ItemsSource = snapshot.Providers.Select(provider =>
        {
            var totals = AgentUsageTotals.Sum(provider.Records);
            var models = AgentBreakdown.Models(provider);
            var activity = AgentBreakdown.Activity(provider, _days, now);
            long peak = Math.Max(1, activity.Max(b => b.Tokens));
            return new
            {
                provider.Name, Mark = Mark(provider.Name),
                Period = _days == 1 ? "Today · 2-hour intervals" : "Last " + _days + " days · daily",
                BucketCount = activity.Count,
                Buckets = activity.Select(b => new
                {
                    Height = b.Responses == 0 ? 2 : Math.Max(4, 32d * b.Tokens / peak),
                    Opacity = b.Responses == 0 ? 0.3 : 1,
                    Detail = b.Start > now.LocalDateTime ? "Upcoming interval" : b.Start.ToString(_days == 1 ? "HH:mm" : "MMM d") + " – " + b.End.ToString(_days == 1 ? "HH:mm" : "MMM d") + " · " + (b.Responses == 0 ? "No observed records" : Exact(b.Tokens) + " tokens · " + b.Responses + " responses")
                }).ToArray(),
                CacheNote = totals.Input > 0 ? (100d * totals.Cached / totals.Input).ToString("0.#", CultureInfo.InvariantCulture) + "% of observed input served from cache" : "No input records in this period",
                ModelSummary = models.Count == 0 ? "No model records yet" : models.Count > 3 ? "Top 3 of " + models.Count + " models · tokens" : "Models · observed tokens",
                Models = models.Take(3).Select(m => new
                {
                    m.Name, Tokens = Compact(m.Total),
                    Detail = m.Name + " · " + Exact(m.Input) + " input + " + Exact(m.Output) + " output · " + Exact(m.Cached) + " cached input · " + m.Responses + " responses"
                }).ToArray()
            };
        }).ToArray();
    }
    internal static string ResetText(AgentWindow window, DateTimeOffset now)
    {
        if (window.Expired(now)) return "Reset due · refresh limits";
        string suffix = window.Stale(now) || window.Source != "Account" ? " · snapshot" : "";
        if (window.Reset == null) return "Reset time unavailable" + suffix;
        var remaining = window.Reset.Value - now;
        return "Resets in " + (remaining.TotalDays >= 1 ? $"{(int)remaining.TotalDays}d {remaining.Hours}h" : remaining.TotalHours >= 1 ? $"{(int)remaining.TotalHours}h {remaining.Minutes}m" : $"{Math.Max(1, remaining.Minutes)}m") + suffix;
    }
    private async void Refresh_Click(object sender, RoutedEventArgs e)
    {
        var lifetime = _visible; if (_monitor == null || lifetime == null || _checking) return;
        _checking = true; _lastAccountRequest = DateTimeOffset.Now; UpdateRefresh(); ReadStatus.Text = "Checking installed CLIs…";
        try { await _monitor.RefreshAccountsAsync(lifetime.Token); }
        catch (OperationCanceledException) { }
        finally { _checking = false; UpdateRefresh(); if (ReferenceEquals(lifetime, _visible)) await ReadAsync(); }
    }
    private void UpdateRefresh() => RefreshLimits.IsEnabled = !_checking && DateTimeOffset.Now - _lastAccountRequest >= TimeSpan.FromSeconds(30);
    private void Details_Click(object sender, RoutedEventArgs e)
    {
        bool show = UsageDetails.Visibility != Visibility.Visible;
        UsageDetails.Visibility = show ? Visibility.Visible : Visibility.Collapsed;
        if (show && _lastSnapshot is { } snapshot) PresentBreakdowns(snapshot);
        else if (!show) Breakdowns.ItemsSource = null;
        DetailsButton.Content = show ? "Less detail" : "More detail";
        DetailsButton.ToolTip = show ? "Hide model and activity breakdowns" : "Show model and activity breakdowns";
    }
    private void CopyLogin_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not Button { Tag: string provider }) return;
        var command = AgentAccounts.Find(provider);
        if (command == null) { ReadStatus.Text = "Install the " + provider + " CLI first, then refresh limits."; return; }
        string Quote(string text) => "'" + text.Replace("'", "''") + "'";
        string text = "& " + Quote(command.File) + (command.Prefix.Count > 0 ? " " + string.Join(" ", command.Prefix.Select(Quote)) : "") + (provider == "Codex" ? " login" : " auth login");
        try { Clipboard.SetText(text); ReadStatus.Text = "Sign-in command copied. Paste it in PowerShell, sign in, then refresh limits."; }
        catch (System.Runtime.InteropServices.ExternalException) { ReadStatus.Text = "Clipboard is busy. Try copying again."; }
    }
    private void Period_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not Button { Tag: string text } || !int.TryParse(text, out _days)) return;
        foreach (var button in new[] { Today, Week, Month })
        {
            bool selected = button.Tag?.ToString() == text;
            button.Background = new SolidColorBrush(selected ? Color.FromRgb(242, 242, 242) : Color.FromRgb(20, 20, 20));
            button.Foreground = new SolidColorBrush(selected ? Color.FromRgb(16, 16, 16) : Color.FromRgb(216, 222, 229));
        }
        ReadStatus.Text = "Reading local activity…"; _ = ReadAsync();
    }
    private void Dashboard_Wheel(object sender, MouseWheelEventArgs e) { AgentScroll.ScrollToVerticalOffset(AgentScroll.VerticalOffset - e.Delta); e.Handled = true; }
    private void Dashboard_MouseDown(object sender, MouseButtonEventArgs e) => e.Handled = true;
    private static string Compact(long value) => value >= 1_000_000 ? (value / 1_000_000d).ToString("0.#", CultureInfo.InvariantCulture) + "M" : value >= 1000 ? (value / 1000d).ToString("0.#", CultureInfo.InvariantCulture) + "K" : value.ToString("N0", CultureInfo.InvariantCulture);
    public void Dispose() { if (_disposed) return; _disposed = true; Stop(); _lastSnapshot = null; Providers.ItemsSource = Breakdowns.ItemsSource = Sessions.ItemsSource = null; _monitor?.Dispose(); }
}
