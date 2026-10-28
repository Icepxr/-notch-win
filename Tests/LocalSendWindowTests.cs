using System.IO;
using System.Net;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using VNotch.Services.LocalSend;
#if !LOCALSEND_UI_ONLY
using VNotch.Controls;
using VNotch.Models;
using VNotch.ViewModels;
#endif
using Xunit;

namespace VNotch.Tests;

public sealed class LocalSendWindowTests
{
    private static readonly LocalSendDevice Ipad = new("My iPad", IPAddress.Parse("192.168.1.24"), 53317, "https", "fixture", "iPad Pro");
    private static readonly LocalSendFile[] Files = [new("file", "unused-fixture.pdf", "Project notes.pdf", 2457600)];
    private sealed class Session : ILocalSendSession
    {
        public event Action<IReadOnlyList<LocalSendDevice>>? DevicesChanged;
        public bool Disposed;
        public Func<IProgress<LocalSendProgress>, CancellationToken, Task<LocalSendResult>> Reply = (_, _) => Task.FromResult(new LocalSendResult(1, 0));
        public void Emit(IReadOnlyList<LocalSendDevice>? devices = null) => DevicesChanged?.Invoke(devices ?? [Ipad]);
        public Task ScanAsync(CancellationToken cancellation) => Task.CompletedTask;
        public Task<LocalSendDevice> FindAsync(IPAddress address, int port, CancellationToken cancellation) => Task.FromResult(Ipad);
        public Task<LocalSendResult> SendAsync(LocalSendDevice device, IReadOnlyList<LocalSendFile> files, string? pin, IProgress<LocalSendProgress> progress, CancellationToken cancellation) => Reply(progress, cancellation);
        public void Dispose() => Disposed = true;
    }
    private static T Part<T>(LocalSendWindow window, string name) => (T)window.FindName(name);
    private static void Click(LocalSendWindow window, string name) => Part<Button>(window, name).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
    private static FrameworkElement Layout(LocalSendWindow window, double width = 480, double height = double.NaN)
    {
        var root = (FrameworkElement)window.Content;
        root.Measure(new Size(width, double.IsNaN(height) ? double.PositiveInfinity : height));
        if (double.IsNaN(height)) height = root.DesiredSize.Height;
        root.Arrange(new Rect(0, 0, width, height)); root.UpdateLayout(); return root;
    }

#if !LOCALSEND_UI_ONLY
    [Fact]
    public void MenuAddsSendingOnlyForPublicFileOrImageSelections()
    {
        ClipboardCardViewModel Card(ClipboardKind kind, bool personal = false) => new(new ClipboardEntry { Kind = kind, IsPersonal = personal });
        Assert.True(ClipboardTray.CanSendLocalSend([Card(ClipboardKind.File), Card(ClipboardKind.Image)]));
        Assert.False(ClipboardTray.CanSendLocalSend([Card(ClipboardKind.Text)]));
        Assert.False(ClipboardTray.CanSendLocalSend([Card(ClipboardKind.File), Card(ClipboardKind.Link)]));
        Assert.False(ClipboardTray.CanSendLocalSend([Card(ClipboardKind.File, true)]));
        Assert.False(ClipboardTray.CanSendLocalSend([]));
    }
#endif

    [Fact]
    public void EmptySelectionPinAndSuccessStatesRenderWithoutShowingANativeWindow() => SharedStaTestRunner.RunAsync(async () =>
    {
        var session = new Session(); var window = new LocalSendWindow(Files, session, false);
        try
        {
            var root = Layout(window);
            Assert.False(Part<Button>(window, "Send").IsEnabled);
            Assert.NotEmpty(Part<TextBlock>(window, "EmptyDevices").Text);
            Assert.Contains("1 file", Part<TextBlock>(window, "FileSummary").Text);
            Assert.Equal("#FF000000", ((SolidColorBrush)Part<Border>(window, "SendSurface").Background).Color.ToString());
            Assert.Equal(new CornerRadius(24), Part<Border>(window, "SendSurface").CornerRadius);
            Assert.Contains("SF Pro Display", window.FontFamily.Source);
            // The existing preferences dialog is the visual contract, not a new palette.
            var buttonStyle = (Style)window.Resources[typeof(Button)];
            object? SetterValue(DependencyProperty property) => buttonStyle.Setters.OfType<Setter>().Single(s => s.Property == property).Value;
            Assert.Equal(42d, SetterValue(FrameworkElement.MinHeightProperty));
            Assert.Equal(new Thickness(18, 10, 18, 10), SetterValue(Control.PaddingProperty));
            Assert.Equal("#FF141414", ((SolidColorBrush)SetterValue(Control.BackgroundProperty)!).Color.ToString());
            Assert.Equal(13d, SetterValue(Control.FontSizeProperty));
            session.Emit(); await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
            Part<ListBox>(window, "Devices").SelectedIndex = 0;
            Assert.True(Part<Button>(window, "Send").IsEnabled);
            session.Reply = (_, _) => Task.FromException<LocalSendResult>(new LocalSendException("Enter the receiver PIN.", true));
            Click(window, "Send"); await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
            Assert.Equal(Visibility.Visible, Part<StackPanel>(window, "PinPanel").Visibility);
            Part<PasswordBox>(window, "ReceiverPin").Password = "123456";
            session.Emit(); await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
            Assert.Equal("123456", Part<PasswordBox>(window, "ReceiverPin").Password);
            Assert.Equal(Visibility.Visible, Part<StackPanel>(window, "PinPanel").Visibility);
            Layout(window, 420, 600);
            var port = Part<TextBox>(window, "DevicePort");
            Assert.Equal("53317", port.Text);
            Assert.InRange(port.GetRectFromCharacterIndex(0).Left, 0, port.ActualWidth);
            Assert.InRange(port.GetRectFromCharacterIndex(4, true).Right, 0, port.ActualWidth - port.Padding.Right);
            Assert.InRange(port.ActualHeight, 42, 44);
            foreach (string name in new[] { "Devices", "IpAddress", "DevicePort", "ReceiverPin", "Status", "Send", "Refresh" })
            {
                var control = Part<FrameworkElement>(window, name);
                var bounds = control.TransformToAncestor(root).TransformBounds(new Rect(control.RenderSize));
                Assert.True(bounds.X >= 0 && bounds.Right <= 420.5 && bounds.Y >= 0 && bounds.Bottom <= 600.5, name + " must fit the send surface");
            }
            session.Reply = (_, _) => Task.FromResult(new LocalSendResult(1, 0));
            Click(window, "Send"); await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
            Assert.Contains("Sent 1 file to My iPad", Part<TextBlock>(window, "Status").Text);
            Assert.Equal(Visibility.Collapsed, Part<StackPanel>(window, "PinPanel").Visibility);
            root = Layout(window);
            Assert.InRange(root.ActualHeight, 360, 550);
            var image = new RenderTargetBitmap(480, (int)Math.Ceiling(root.ActualHeight), 96, 96, PixelFormats.Pbgra32); image.Render(root);
            string directory = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", ".test-output"); Directory.CreateDirectory(directory);
            var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(image));
            using var file = System.IO.File.Create(Path.Combine(directory, "localsend-send.png")); encoder.Save(file);
            Assert.False(window.IsVisible);
        }
        finally { window.Close(); }
        Assert.True(session.Disposed);
    });

    [Fact]
    public void PendingTransfersDisableDuplicateSendsAndCanBeCancelled() => SharedStaTestRunner.RunAsync(async () =>
    {
        var session = new Session(); var window = new LocalSendWindow(Files, session, false);
        try
        {
            session.Emit(); await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
            Part<ListBox>(window, "Devices").SelectedIndex = 0;
            session.Reply = async (progress, cancellation) =>
            {
                progress.Report(new("Waiting for My iPad to accept…"));
                await Task.Delay(Timeout.Infinite, cancellation); return new(1, 0);
            };
            Click(window, "Send"); await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
            Assert.False(Part<Button>(window, "Send").IsEnabled);
            Assert.Equal(Visibility.Visible, Part<Button>(window, "CancelTransfer").Visibility);
            Assert.True(Part<ProgressBar>(window, "TransferProgress").IsIndeterminate);
            Click(window, "CancelTransfer"); await Task.Delay(30);
            Assert.True(Part<Button>(window, "Send").IsEnabled);
            Assert.Equal(Visibility.Collapsed, Part<Button>(window, "CancelTransfer").Visibility);
        }
        finally { window.Close(); }
    });

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public void PendingDeviceChangesReplayTheNewestSnapshotWhenTransferEnds(bool cancel) => SharedStaTestRunner.RunAsync(async () =>
    {
        var session = new Session(); var window = new LocalSendWindow(Files, session, false);
        var completed = new TaskCompletionSource<LocalSendResult>(TaskCreationOptions.RunContinuationsAsynchronously);
        session.Reply = (_, token) => completed.Task.WaitAsync(token);
        try
        {
            session.Emit(); await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
            var devices = Part<ListBox>(window, "Devices"); devices.SelectedIndex = 0;
            Click(window, "Send");
            var second = Ipad with { Alias = "Another iPad", Address = IPAddress.Parse("192.168.1.25") };
            session.Emit([Ipad, second]); await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
            var renamed = Ipad with { Alias = "Renamed iPad" };
            session.Emit([renamed, second]); await Dispatcher.Yield(DispatcherPriority.ApplicationIdle);
            Assert.Single(devices.Items);
            if (cancel) Click(window, "CancelTransfer"); else completed.SetResult(new(1, 0));
            for (int i = 0; i < 100 && !devices.IsEnabled; i++) await Task.Delay(10);
            Assert.True(devices.IsEnabled);
            Assert.Equal(2, devices.Items.Count);
            Assert.Equal("Renamed iPad", ((LocalSendDevice)devices.SelectedItem).Alias);
        }
        finally { completed.TrySetResult(new(1, 0)); window.Close(); }
    });
}
