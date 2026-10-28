// Local customization: this window adds sending without altering existing notch views.
using System.IO;
using System.Net;
using System.Windows;
using System.Windows.Input;
using VNotch.Services.LocalSend;

namespace VNotch;

internal partial class LocalSendWindow : Window
{
    private readonly IReadOnlyList<LocalSendFile> _files;
    private readonly ILocalSendSession _session;
    private readonly CancellationTokenSource _lifetime = new();
    private CancellationTokenSource? _operation;
    private bool _busy, _closed, _updatingDevices;
    private LocalSendDevice? _manualDevice;
    private IReadOnlyList<LocalSendDevice>? _pendingDevices;
    private readonly bool _startDiscovery;
    private readonly Func<bool> _networkAllowed;
    internal LocalSendWindow(IReadOnlyList<LocalSendFile> files, ILocalSendSession session, bool startDiscovery = true, Func<bool>? networkAllowed = null)
    {
        InitializeComponent();
        _files = files; _session = session; _startDiscovery = startDiscovery; _networkAllowed = networkAllowed ?? (() => true);
        _session.DevicesChanged += DevicesChanged;
        FileSummary.Text = $"{files.Count:N0} {(files.Count == 1 ? "file" : "files")} · {FormatBytes(files.Sum(file => file.Size))}";
        FileNames.Text = string.Join(" · ", files.Take(3).Select(file => file.Name));
        FontFamily = Application.Current?.TryFindResource("SFProDisplay") as System.Windows.Media.FontFamily ??
            new System.Windows.Media.FontFamily($"pack://application:,,,/{GetType().Assembly.GetName().Name};component/Fonts/#SF Pro Display, Segoe UI");
    }

    private async void Window_Loaded(object sender, RoutedEventArgs e) { if (_startDiscovery) await ScanAsync(); }
    private async Task ScanAsync()
    {
        Refresh.IsEnabled = false;
        try
        {
            await _session.ScanAsync(_lifetime.Token);
            if (!_closed) Status.Text = "Searching locally. If no device appears, connect by IP.";
        }
        catch (Exception ex) when (ex is IOException or System.Net.Sockets.SocketException or System.Net.Http.HttpRequestException or OperationCanceledException)
        { SetError(ex); }
        finally { if (!_closed) Refresh.IsEnabled = !_busy; }
    }
    private void DevicesChanged(IReadOnlyList<LocalSendDevice> devices)
    {
        if (_closed || Dispatcher.HasShutdownStarted) return;
        Dispatcher.BeginInvoke(() =>
        {
            if (_closed) return;
            if (_busy) { _pendingDevices = devices; return; }
            ApplyDevices(devices);
        });
    }
    private void ApplyDevices(IReadOnlyList<LocalSendDevice> devices)
    {
        _pendingDevices = null;
        string? selected = (Devices.SelectedItem as LocalSendDevice)?.Key;
        var list = devices.ToList();
        if (_manualDevice != null && list.All(d => d.Key != _manualDevice.Key)) list.Insert(0, _manualDevice);
        _updatingDevices = true;
        try { Devices.ItemsSource = list; Devices.SelectedItem = list.FirstOrDefault(d => d.Key == selected); }
        finally { _updatingDevices = false; }
        Send.IsEnabled = Devices.SelectedItem is LocalSendDevice;
        if ((Devices.SelectedItem as LocalSendDevice)?.Key != selected) { ReceiverPin.Clear(); PinPanel.Visibility = Visibility.Collapsed; }
        EmptyDevices.Text = "No nearby devices yet. Open LocalSend on your iPad, or connect by IP below.";
        EmptyDevices.Visibility = list.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
    }
    private void Devices_Changed(object sender, System.Windows.Controls.SelectionChangedEventArgs e)
    {
        if (_updatingDevices) return;
        Send.IsEnabled = !_busy && Devices.SelectedItem is LocalSendDevice;
        ReceiverPin.Clear(); PinPanel.Visibility = Visibility.Collapsed;
    }
    private void SetBusy(bool busy)
    {
        _busy = busy; Devices.IsEnabled = !busy; Connect.IsEnabled = !busy; Refresh.IsEnabled = !busy;
        IpAddress.IsEnabled = !busy; DevicePort.IsEnabled = !busy; ReceiverPin.IsEnabled = !busy;
        Send.IsEnabled = !busy && Devices.SelectedItem is LocalSendDevice;
        CancelTransfer.Visibility = busy ? Visibility.Visible : Visibility.Collapsed;
        if (!busy && _pendingDevices is { } devices) ApplyDevices(devices);
    }
    private void SetError(Exception exception)
    {
        if (_closed) return;
        if (!_networkAllowed())
        {
            Status.Text = "LocalSend is blocked by Strict Local-Only Mode. Turn it off in Settings → Privacy to discover or send to nearby devices.";
            EmptyDevices.Text = "Local network access is disabled in Privacy settings.";
        }
        else Status.Text = exception is OperationCanceledException ? "Cancelled. You can try again." : exception is System.Net.Http.HttpRequestException
            ? "Could not connect. Check LocalSend, the IP address, firewall and Wi-Fi, then try again." : exception.Message;
    }
    private async void Connect_Click(object sender, RoutedEventArgs e)
    {
        if (_busy) return;
        if (!IPAddress.TryParse(IpAddress.Text.Trim(), out var address) || !LocalSendProtocol.IsNearby(address) ||
            !int.TryParse(DevicePort.Text, out int port) || port is < 1 or > 65535)
        { Status.Text = "Enter the device's local IP address and a port from 1 to 65535."; return; }
        _operation = CancellationTokenSource.CreateLinkedTokenSource(_lifetime.Token);
        SetBusy(true); Status.Text = "Connecting to LocalSend…";
        try
        {
            _manualDevice = await _session.FindAsync(address, port, _operation.Token);
            if (_closed) return;
            Devices.ItemsSource = new[] { _manualDevice }; Devices.SelectedItem = _manualDevice;
            EmptyDevices.Visibility = Visibility.Collapsed; Status.Text = "Connected. Select Send files to request the transfer.";
        }
        catch (Exception ex) when (ex is IOException or System.Net.Http.HttpRequestException or OperationCanceledException) { SetError(ex); }
        finally { _operation.Dispose(); _operation = null; if (!_closed) SetBusy(false); }
    }
    private async void Send_Click(object sender, RoutedEventArgs e)
    {
        if (_busy || Devices.SelectedItem is not LocalSendDevice device) return;
        string pin = ReceiverPin.Password;
        _operation = CancellationTokenSource.CreateLinkedTokenSource(_lifetime.Token);
        SetBusy(true); TransferProgress.Visibility = Visibility.Visible; TransferProgress.IsIndeterminate = true;
        var progress = new Progress<LocalSendProgress>(value =>
        {
            if (_closed || !_busy) return;
            Status.Text = value.Message; TransferProgress.IsIndeterminate = value.Total == 0;
            if (value.Total > 0) TransferProgress.Value = Math.Clamp(100d * value.Sent / value.Total, 0, 100);
        });
        try
        {
            var result = await _session.SendAsync(device, _files, pin, progress, _operation.Token);
            if (_closed) return;
            TransferProgress.IsIndeterminate = false; TransferProgress.Value = 100;
            Status.Text = result.Sent == 0 ? "The receiver requested no files. Nothing was uploaded." :
                $"Sent {result.Sent:N0} {(result.Sent == 1 ? "file" : "files")} to {device.Alias}." + (result.Skipped > 0 ? $" {result.Skipped:N0} skipped by the receiver." : "");
            ReceiverPin.Clear(); PinPanel.Visibility = Visibility.Collapsed;
        }
        catch (LocalSendException ex) when (ex.PinRequired)
        {
            if (!_closed) { Status.Text = ex.Message; PinPanel.Visibility = Visibility.Visible; ReceiverPin.Focus(); }
        }
        catch (Exception ex) when (ex is IOException or System.Net.Http.HttpRequestException or OperationCanceledException) { SetError(ex); }
        finally
        {
            _operation.Dispose(); _operation = null;
            if (!_closed) { TransferProgress.IsIndeterminate = false; SetBusy(false); if (PinPanel.IsVisible) ReceiverPin.Focus(); }
        }
    }
    private async void Refresh_Click(object sender, RoutedEventArgs e) => await ScanAsync();
    private void Cancel_Click(object sender, RoutedEventArgs e) { _operation?.Cancel(); Status.Text = "Cancelling…"; }
    private void Close_Click(object sender, RoutedEventArgs e) => Close();
    private void Window_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape) { if (_busy) _operation?.Cancel(); else Close(); e.Handled = true; }
        if (e.Key == Key.Enter && !_busy && Send.IsEnabled) { Send_Click(Send, new RoutedEventArgs()); e.Handled = true; }
    }
    private void Header_Drag(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton != MouseButton.Left) return;
        for (DependencyObject? node = e.OriginalSource as DependencyObject; node != null && !ReferenceEquals(node, sender);
             node = node is System.Windows.Media.Visual ? System.Windows.Media.VisualTreeHelper.GetParent(node) : LogicalTreeHelper.GetParent(node))
            if (node is System.Windows.Controls.Primitives.ButtonBase) return;
        DragMove();
    }
    private void Window_Closed(object? sender, EventArgs e)
    {
        _closed = true; _pendingDevices = null; _lifetime.Cancel(); _session.DevicesChanged -= DevicesChanged; _session.Dispose();
        _lifetime.Dispose();
    }
    private static string FormatBytes(long bytes) => bytes >= 1073741824 ? $"{bytes / 1073741824d:0.#} GB" : bytes >= 1048576 ? $"{bytes / 1048576d:0.#} MB" : bytes >= 1024 ? $"{bytes / 1024d:0.#} KB" : $"{bytes} bytes";
}
