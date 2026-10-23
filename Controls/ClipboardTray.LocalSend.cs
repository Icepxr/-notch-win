// Local customization: additive LocalSend action; existing shelf actions remain intact.
using System.IO;
using System.Windows;
using System.Windows.Controls;
using VNotch.Models;
using VNotch.Services;
using VNotch.Services.LocalSend;
using VNotch.ViewModels;

namespace VNotch.Controls;

public partial class ClipboardTray
{
    internal static bool CanSendLocalSend(IReadOnlyList<ClipboardCardViewModel> selection) =>
        selection.Count > 0 && selection.All(card => card.Entry.Kind is ClipboardKind.File or ClipboardKind.Image && !card.Entry.IsPersonal && !card.Entry.IsSensitive && !card.IsMasked);

    private void AddLocalSendMenu(ItemsControl menu, ClipboardCardViewModel[] selection)
    {
        if (!CanSendLocalSend(selection)) return;
        var item = new MenuItem { Header = "Send via LocalSend…", Icon = new TrayIcon { Kind = TrayIconKind.Files, Width = 14, Height = 14 } };
        item.Click += async (_, _) => await SafeAsync(() => SendLocalSendAsync(selection));
        menu.Items.Add(item);
    }

    private async Task SendLocalSendAsync(ClipboardCardViewModel[] selection)
    {
        if (_controller == null || !CanSendLocalSend(selection)) return;
        if (!NetworkPrivacy.Current.IsAllowed(NetworkFeature.LocalSend))
        { StatusChanged("Turn off Strict Local-Only Mode in Settings → Privacy to use LocalSend."); return; }
        var leases = new List<IDisposable>();
        try
        {
            var paths = new List<string>();
            foreach (var card in selection)
            {
                var entry = _controller.Store.GetEntry(card.Entry.Id);
                if (entry == null || entry.IsPersonal || entry.IsSensitive) throw new IOException("The selected item is no longer available for sending.");
                var exported = await _controller.Store.ExportFilesAsync(card.Entry.Id);
                paths.AddRange(exported);
                foreach (string path in exported) leases.Add(AppFileCleanupService.Protect(Path.GetDirectoryName(path)!));
            }
            var files = await Task.Run(() => LocalSendProtocol.Collect(paths));
            if (_disposed) return;
            using var session = new LocalSendSession(new LocalSendPermission());
            var window = new LocalSendWindow(files, session, networkAllowed: () => NetworkPrivacy.Current.IsAllowed(NetworkFeature.LocalSend))
            { Owner = Window.GetWindow(this), Topmost = Window.GetWindow(this)?.Topmost == true };
            var closed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            window.Closed += (_, _) => closed.TrySetResult();
            window.Show();
            await closed.Task;
        }
        catch (IOException ex) { StatusChanged(ex.Message); }
        finally { foreach (var lease in leases) lease.Dispose(); }
    }
}
