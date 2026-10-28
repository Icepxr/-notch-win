// Local customization: discovery exists only while the send window is open.
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace VNotch.Services.LocalSend;

internal sealed class LocalSendSession : ILocalSendSession
{
    private readonly ILocalSendPermission _privacy;
    private readonly LocalSendIdentity _identity = new();
    private readonly LocalSendSender _sender;
    private readonly CancellationTokenSource _stop = new();
    private readonly SemaphoreSlim _startGate = new(1), _connections = new(8);
    private readonly object _gate = new();
    private readonly Dictionary<string, (LocalSendDevice Device, long Seen)> _devices = new();
    private bool _devicesChanged = true;
    private readonly List<Task> _workers = [];
    private TcpListener? _listener;
    private UdpClient? _udp;
    private CancellationTokenSource? _discoveryLifetime;
    private int _registrationPort = LocalSendProtocol.Port;
    private bool _disposed;
    public event Action<IReadOnlyList<LocalSendDevice>>? DevicesChanged;

    internal LocalSendSession(ILocalSendPermission privacy)
    {
        _privacy = privacy;
        _sender = new(_identity, _privacy);
    }
    private object Info => new { alias = Environment.MachineName + " · V-Notch", version = "2.0", deviceModel = "Windows", deviceType = "desktop",
        fingerprint = _identity.Fingerprint, port = _registrationPort, protocol = "http", download = false };

    public async Task ScanAsync(CancellationToken cancellation)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, _stop.Token, _privacy.Acquire());
        await _startGate.WaitAsync(linked.Token);
        try
        {
            lock (_gate)
            {
                ObjectDisposedException.ThrowIf(_disposed, this);
                if (_udp != null && _discoveryLifetime?.IsCancellationRequested == true)
                {
                    _udp.Dispose(); _listener?.Stop(); _udp = null;
                }
                if (_udp == null)
                {
                    _listener = new TcpListener(IPAddress.Any, 0);
                    _listener.Start(8);
                    _registrationPort = ((IPEndPoint)_listener.LocalEndpoint).Port;
                    _udp = new UdpClient(AddressFamily.InterNetwork);
                    _udp.ExclusiveAddressUse = false;
                    _udp.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
                    try { _udp.Client.Bind(new IPEndPoint(IPAddress.Any, LocalSendProtocol.Port)); }
                    catch (SocketException) { _udp.Client.Bind(new IPEndPoint(IPAddress.Any, 0)); }
                    _udp.MulticastLoopback = false; _udp.Ttl = 1;
                    foreach (var address in LocalAddresses())
                        try { _udp.JoinMulticastGroup(LocalSendProtocol.Multicast, address); } catch (SocketException) { }
                    // Revoking Strict Local-Only permission terminates discovery too.
                    var lifetime = CancellationTokenSource.CreateLinkedTokenSource(_stop.Token, _privacy.Acquire());
                    _discoveryLifetime = lifetime;
                    RegisterWorker(RunGuardedAsync(() => ReceiveAsync(lifetime.Token)));
                    RegisterWorker(RunGuardedAsync(() => AcceptAsync(lifetime.Token)));
                    RegisterWorker(RunGuardedAsync(() => PulseAsync(lifetime.Token), lifetime));
                }
            }
            await AnnounceAsync(linked.Token);
            lock (_gate) _devicesChanged = true; // An explicit rescan requests a fresh publication.
        }
        finally { _startGate.Release(); }
    }

    private static IPAddress[] LocalAddresses() => NetworkInterface.GetAllNetworkInterfaces()
        .Where(n => n.OperationalStatus == OperationalStatus.Up && n.NetworkInterfaceType != NetworkInterfaceType.Loopback)
        .SelectMany(n => n.GetIPProperties().UnicastAddresses).Select(a => a.Address)
        .Where(a => a.AddressFamily == AddressFamily.InterNetwork && LocalSendProtocol.IsNearby(a)).Distinct().ToArray();

    private async Task AnnounceAsync(CancellationToken cancellation)
    {
        var udp = _udp ?? throw new IOException("Discovery is unavailable. Connect by IP instead.");
        var node = JsonSerializer.SerializeToNode(Info, LocalSendProtocol.Json)!.AsObject(); node["announce"] = true;
        byte[] message = JsonSerializer.SerializeToUtf8Bytes(node, LocalSendProtocol.Json);
        int sent = 0;
        foreach (var address in LocalAddresses())
        {
            cancellation.ThrowIfCancellationRequested();
            try
            {
                udp.Client.SetSocketOption(SocketOptionLevel.IP, SocketOptionName.MulticastInterface, address.GetAddressBytes());
                await udp.SendAsync(message, new IPEndPoint(LocalSendProtocol.Multicast, LocalSendProtocol.Port), cancellation);
                sent++;
            }
            catch (SocketException) { }
        }
        if (sent == 0) throw new IOException("No local network is available. Join the same Wi-Fi as your iPad, or connect by IP.");
    }

    private void Remember(LocalSendDevice? device)
    {
        if (device == null || device.Fingerprint.Equals(_identity.Fingerprint, StringComparison.OrdinalIgnoreCase)) return;
        lock (_gate)
        {
            if (_disposed) return;
            string key = device.Key;
            bool known = _devices.TryGetValue(key, out var previous);
            if (_devices.Count >= 64 && !known) return;
            if (!known || previous.Device != device) _devicesChanged = true;
            _devices[key] = (known && previous.Device == device ? previous.Device : device, Environment.TickCount64);
        }
    }

    internal IReadOnlyList<LocalSendDevice>? TakeChangedDeviceSnapshot(long now)
    {
        lock (_gate)
        {
            if (_disposed) return null;
            List<string>? expired = null;
            foreach (var pair in _devices)
                if (now - pair.Value.Seen > 25000) (expired ??= []).Add(pair.Key);
            if (expired != null)
            {
                foreach (string key in expired) _devices.Remove(key);
                _devicesChanged = true;
            }
            if (!_devicesChanged) return null;
            _devicesChanged = false;
            return _devices.Values.Select(p => p.Device).OrderBy(d => d.Alias, StringComparer.OrdinalIgnoreCase).ToArray();
        }
    }

    private async Task ReceiveAsync(CancellationToken cancellation)
    {
        while (!cancellation.IsCancellationRequested)
        {
            var message = await _udp!.ReceiveAsync(cancellation);
            Remember(LocalSendProtocol.ReadDevice(message.Buffer, message.RemoteEndPoint.Address));
        }
    }
    private async Task PulseAsync(CancellationToken cancellation)
    {
        int ticks = 0;
        while (!cancellation.IsCancellationRequested)
        {
            await Task.Delay(1000, cancellation);
            if (TakeChangedDeviceSnapshot(Environment.TickCount64) is { } snapshot) DevicesChanged?.Invoke(snapshot);
            if (++ticks % 4 == 0) try { await AnnounceAsync(cancellation); } catch (IOException) { }
        }
    }

    private async Task AcceptAsync(CancellationToken cancellation)
    {
        while (!cancellation.IsCancellationRequested)
        {
            var client = await _listener!.AcceptTcpClientAsync(cancellation);
            if (!await _connections.WaitAsync(0, cancellation)) { client.Dispose(); continue; }
            lock (_gate)
            {
                if (_disposed) { client.Dispose(); _connections.Release(); return; }
                RegisterWorker(HandleRegistrationAsync(client, cancellation));
            }
        }
    }

    private async Task HandleRegistrationAsync(TcpClient client, CancellationToken cancellation)
    {
        using (client)
        using (var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellation))
        {
            deadline.CancelAfter(TimeSpan.FromSeconds(3));
            try
            {
                if (client.Client.RemoteEndPoint is not IPEndPoint remote || !LocalSendProtocol.IsNearby(remote.Address)) return;
                var stream = client.GetStream();
                byte[] header = new byte[8192]; int used = 0, end = -1;
                while (used < header.Length && end < 0)
                {
                    int read = await stream.ReadAsync(header.AsMemory(used), deadline.Token);
                    if (read == 0) return;
                    used += read;
                    end = Encoding.ASCII.GetString(header, 0, used).IndexOf("\r\n\r\n", StringComparison.Ordinal);
                }
                if (end < 0) return;
                string[] lines = Encoding.ASCII.GetString(header, 0, end).Split("\r\n");
                if (lines[0] != "POST /api/localsend/v2/register HTTP/1.1") return;
                string? lengthHeader = lines.Skip(1).FirstOrDefault(line => line.StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase));
                if (lengthHeader == null || !int.TryParse(lengthHeader[15..].Trim(), out int length) || length is < 1 or > 32768) return;
                byte[] body = new byte[length];
                int copied = Math.Min(used - end - 4, length);
                header.AsSpan(end + 4, copied).CopyTo(body);
                await stream.ReadExactlyAsync(body.AsMemory(copied), deadline.Token);
                Remember(LocalSendProtocol.ReadDevice(body, remote.Address));
                byte[] response = JsonSerializer.SerializeToUtf8Bytes(Info, LocalSendProtocol.Json);
                await stream.WriteAsync(Encoding.ASCII.GetBytes($"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {response.Length}\r\nConnection: close\r\n\r\n"), deadline.Token);
                await stream.WriteAsync(response, deadline.Token);
            }
            catch (Exception ex) when (ex is IOException or SocketException or OperationCanceledException or ObjectDisposedException) { }
            finally { _connections.Release(); }
        }
    }

    public async Task<LocalSendDevice> FindAsync(IPAddress address, int port, CancellationToken cancellation)
        => await Track(() => FindCoreAsync(address, port, cancellation));

    private async Task<LocalSendDevice> FindCoreAsync(IPAddress address, int port, CancellationToken cancellation)
    {
        if (!LocalSendProtocol.IsNearby(address) || port is < 1 or > 65535) throw new IOException("Enter a local IP address and a valid port.");
        foreach (string protocol in new[] { "https", "http" })
        {
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellation, _stop.Token, _privacy.Acquire());
            deadline.CancelAfter(TimeSpan.FromSeconds(4));
            string fingerprint = "";
            var candidate = new LocalSendDevice(address.ToString(), address, port, protocol, "");
            using var client = _sender.CreateClient(candidate, true, hash => fingerprint = hash);
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, candidate.Endpoint("/api/localsend/v2/register"))
                { Content = new StringContent(JsonSerializer.Serialize(Info, LocalSendProtocol.Json), Encoding.UTF8, "application/json") };
                using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
                LocalSendSender.CheckStatus(response.StatusCode);
                var node = JsonNode.Parse(await LocalSendSender.ReadBoundedAsync(response.Content, deadline.Token))!.AsObject();
                node["port"] = port; node["protocol"] = protocol;
                if (protocol == "https") node["fingerprint"] = fingerprint;
                var device = LocalSendProtocol.ReadDevice(JsonSerializer.SerializeToUtf8Bytes(node), address);
                if (device == null) continue;
                Remember(device);
                lock (_gate) _devicesChanged = true; // A manual connection must restore the complete discovered list.
                return device;
            }
            catch (Exception ex) when (ex is HttpRequestException or JsonException or IOException or OperationCanceledException or InvalidOperationException)
            { cancellation.ThrowIfCancellationRequested(); }
        }
        throw new IOException("No LocalSend receiver answered. Check the IP, port, Wi-Fi and LocalSend on the receiving device.");
    }

    public async Task<LocalSendResult> SendAsync(LocalSendDevice device, IReadOnlyList<LocalSendFile> files, string? pin,
        IProgress<LocalSendProgress> progress, CancellationToken cancellation)
        => await Track(async () =>
    {
        using var lifetime = CancellationTokenSource.CreateLinkedTokenSource(cancellation, _stop.Token, _privacy.Acquire());
        return await _sender.SendAsync(device, Info, files, pin, progress, lifetime.Token);
    });

    private Task<T> Track<T>(Func<Task<T>> action)
    {
        lock (_gate)
        {
            ObjectDisposedException.ThrowIf(_disposed, this);
            var task = action(); RegisterWorker(task); return task;
        }
    }

    // Called under _gate. Completed requests must not retain their results,
    // upload state and exception graphs for the lifetime of the send window.
    private void RegisterWorker(Task task)
    {
        _workers.Add(task);
        _ = task.ContinueWith(completed =>
        {
            lock (_gate) _workers.Remove(completed);
            _ = completed.Exception;
        }, CancellationToken.None, TaskContinuationOptions.ExecuteSynchronously, TaskScheduler.Default);
    }

    private static async Task RunGuardedAsync(Func<Task> action, IDisposable? lifetime = null)
    {
        try { await action(); }
        catch (Exception ex) when (ex is SocketException or IOException or OperationCanceledException or ObjectDisposedException) { }
        finally { lifetime?.Dispose(); }
    }
    public void Dispose()
    {
        Task[] pending;
        lock (_gate) { if (_disposed) return; _disposed = true; pending = _workers.ToArray(); }
        _stop.Cancel(); _udp?.Dispose(); _listener?.Stop();
        // Certificate disposal waits until discovery callbacks have retired.
        _ = Task.WhenAll(pending).ContinueWith(task => { _ = task.Exception; _identity.Dispose(); _stop.Dispose(); }, TaskScheduler.Default);
    }
}
