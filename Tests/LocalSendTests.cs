using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Authentication;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using VNotch.Services.LocalSend;
using Xunit;

namespace VNotch.Tests;

public sealed class LocalSendTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "v-notch-localsend-tests-" + Guid.NewGuid().ToString("N"));
    private static readonly LocalSendDevice Device = new("Fixture iPad", IPAddress.Loopback, 53317, "http", "fixture");
    public LocalSendTests() => Directory.CreateDirectory(_root);
    private string File(string name, byte[]? bytes = null)
    {
        string path = Path.Combine(_root, name); Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        System.IO.File.WriteAllBytes(path, bytes ?? [1, 2, 3]); return path;
    }
    private sealed class Permission(bool allowed = true) : ILocalSendPermission
    { public CancellationToken Acquire() => allowed ? CancellationToken.None : throw new HttpRequestException("Disabled by privacy policy."); }
    private static ILocalSendPermission Online() => new Permission();
    private sealed class RevocablePermission(CancellationTokenSource lifetime) : ILocalSendPermission
    {
        public CancellationToken Acquire() => lifetime.IsCancellationRequested
            ? throw new HttpRequestException("Disabled by privacy policy.") : lifetime.Token;
    }
    private sealed class Handler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> reply) : HttpMessageHandler
    { protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellation) => reply(request, cancellation); }
    private static HttpResponseMessage Json(object value) => new(HttpStatusCode.OK) { Content = new StringContent(JsonSerializer.Serialize(value, LocalSendProtocol.Json)) };
    private sealed class Progress : IProgress<LocalSendProgress>
    {
        public readonly List<LocalSendProgress> Values = [];
        public void Report(LocalSendProgress value) => Values.Add(value);
    }

    [Theory]
    [InlineData("10.0.0.2", true)] [InlineData("172.16.0.3", true)] [InlineData("192.168.1.9", true)]
    [InlineData("169.254.4.5", true)] [InlineData("fd00::1", true)] [InlineData("fe80::1", true)]
    [InlineData("8.8.8.8", false)] [InlineData("172.32.0.1", false)] [InlineData("224.0.0.167", false)]
    public void ManualConnectionsStayOnTheLocalNetwork(string address, bool local) => Assert.Equal(local, LocalSendProtocol.IsNearby(IPAddress.Parse(address)));

    [Fact]
    public void DiscoveryBoundsAndSanitizesUntrustedAnnouncements()
    {
        byte[] Data(object value) => JsonSerializer.SerializeToUtf8Bytes(value);
        Assert.Null(LocalSendProtocol.ReadDevice(Data(new { alias = "No identity" }), IPAddress.Loopback));
        Assert.Null(LocalSendProtocol.ReadDevice(Data(new { fingerprint = "peer", port = -1 }), IPAddress.Loopback));
        Assert.Null(LocalSendProtocol.ReadDevice(Data(new { fingerprint = "peer", protocol = "file" }), IPAddress.Loopback));
        Assert.Null(LocalSendProtocol.ReadDevice(new byte[32769], IPAddress.Loopback));
        Assert.Null(LocalSendProtocol.ReadDevice(Data(new { fingerprint = "peer" }), IPAddress.Parse("1.1.1.1")));
        var device = LocalSendProtocol.ReadDevice(Data(new { fingerprint = "peer", alias = "\r\n" + new string('x', 300), deviceModel = "iPad", port = 53318 }), IPAddress.Loopback)!;
        Assert.Equal(96, device.Alias.Length); Assert.DoesNotContain('\n', device.Alias); Assert.Equal(53318, device.Port);
    }

    [Fact]
    public void SelectionPreservesFoldersDisambiguatesRootsAndRefusesEmptyFolders()
    {
        File("trip/photo.jpg"); File("other/photo.jpg");
        var files = LocalSendProtocol.Collect([Path.Combine(_root, "trip"), Path.Combine(_root, "other/photo.jpg"), Path.Combine(_root, "trip/photo.jpg")]);
        Assert.Equal(new[] { "trip/photo.jpg", "photo.jpg", "photo (2).jpg" }, files.Select(file => file.Name));
        Directory.CreateDirectory(Path.Combine(_root, "empty"));
        Assert.Throws<IOException>(() => LocalSendProtocol.Collect([Path.Combine(_root, "empty")]));
        using var stop = new CancellationTokenSource(); stop.Cancel();
        Assert.Throws<OperationCanceledException>(() => LocalSendProtocol.Collect([Path.Combine(_root, "trip")], stop.Token));
    }

    [Fact]
    public async Task UploadUsesThePreparedTokensAndNeverSendsDeclinedFiles()
    {
        var files = LocalSendProtocol.Collect([File("photo.png", [1, 2, 3, 4]), File("notes.txt")]);
        int calls = 0; var progress = new Progress();
        using var identity = new LocalSendIdentity();
        var sender = new LocalSendSender(identity, Online(), _ => new Handler(async (request, token) =>
        {
            calls++;
            if (request.RequestUri!.AbsolutePath.EndsWith("prepare-upload"))
            {
                using var json = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(token));
                Assert.Equal(2, json.RootElement.GetProperty("files").EnumerateObject().Count());
                Assert.Equal("photo.png", json.RootElement.GetProperty("files").GetProperty(files[0].Id).GetProperty("fileName").GetString());
                return Json(new { sessionId = "session &", files = new Dictionary<string,string> { [files[0].Id] = "token &" } });
            }
            Assert.Equal("/api/localsend/v2/upload", request.RequestUri.AbsolutePath);
            Assert.Contains("sessionId=session%20%26", request.RequestUri.Query);
            Assert.Contains("token=token%20%26", request.RequestUri.Query);
            Assert.Equal(new byte[] { 1, 2, 3, 4 }, await request.Content!.ReadAsByteArrayAsync(token));
            Assert.Equal("application/octet-stream", request.Content.Headers.ContentType!.MediaType);
            return new(HttpStatusCode.OK);
        }));
        var result = await sender.SendAsync(Device, new { alias = "Sender" }, files, null, progress, default);
        Assert.Equal(new LocalSendResult(1, 1), result); Assert.Equal(2, calls);
        Assert.Equal(4, progress.Values.Last().Sent); Assert.Equal(4, progress.Values.Last().Total);
    }

    [Theory]
    [InlineData(401, true)] [InlineData(403, false)] [InlineData(409, false)] [InlineData(429, false)]
    public async Task ReceiverFailuresRemainActionable(int code, bool pin)
    {
        using var identity = new LocalSendIdentity();
        var sender = new LocalSendSender(identity, Online(), _ => new Handler((_, _) => Task.FromResult(new HttpResponseMessage((HttpStatusCode)code))));
        var error = await Assert.ThrowsAsync<LocalSendException>(() => sender.SendAsync(Device, new { }, LocalSendProtocol.Collect([File("file.txt")]), null, new Progress(), default));
        Assert.Equal(pin, error.PinRequired); Assert.NotEmpty(error.Message);
    }

    [Fact]
    public async Task PinIsEncodedAndNoContentIsNotReportedAsASentFile()
    {
        using var identity = new LocalSendIdentity();
        var sender = new LocalSendSender(identity, Online(), _ => new Handler((request, _) =>
        {
            Assert.Contains("pin=12%2634", request.RequestUri!.Query);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NoContent));
        }));
        Assert.Equal(new LocalSendResult(0, 1), await sender.SendAsync(Device, new { }, LocalSendProtocol.Collect([File("file.txt")]), "12&34", new Progress(), default));
    }

    [Fact]
    public async Task OfflinePolicyBlocksBothSenderAndDiscoveryBeforeNetworkTraffic()
    {
        var privacy = new Permission(false); int calls = 0;
        using var identity = new LocalSendIdentity();
        var sender = new LocalSendSender(identity, privacy, _ => new Handler((_, _) => { calls++; return Task.FromResult(Json(new { })); }));
        await Assert.ThrowsAsync<HttpRequestException>(() => sender.SendAsync(Device, new { }, LocalSendProtocol.Collect([File("file.txt")]), null, new Progress(), default));
        using var session = new LocalSendSession(privacy);
        await Assert.ThrowsAsync<HttpRequestException>(() => session.ScanAsync(default));
        Assert.Equal(0, calls);
    }

    [Fact]
    public async Task OversizedMetadataAndUnexpectedFileTokensNeverStartUploads()
    {
        using var identity = new LocalSendIdentity(); int calls = 0;
        var files = LocalSendProtocol.Collect([File("file.txt")]);
        var sender = new LocalSendSender(identity, Online(), _ => new Handler((request, _) =>
        {
            if (request.RequestUri!.AbsolutePath.EndsWith("cancel")) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
            calls++; return Task.FromResult(Json(new { sessionId = "s", files = new Dictionary<string,string> { ["unselected"] = "t" } }));
        }));
        await Assert.ThrowsAsync<IOException>(() => sender.SendAsync(Device, new { }, files, null, new Progress(), default));
        Assert.Equal(1, calls);
        await Assert.ThrowsAsync<IOException>(() => LocalSendSender.ReadBoundedAsync(new StringContent(new string('x',65537)), default));
    }

    [Fact]
    public async Task CancellationNotifiesTheReceiverAfterPreparation()
    {
        using var identity = new LocalSendIdentity(); using var stop = new CancellationTokenSource();
        var files = LocalSendProtocol.Collect([File("file.txt")]); bool cancelled = false;
        var sender = new LocalSendSender(identity, Online(), _ => new Handler(async (request, token) =>
        {
            if (request.RequestUri!.AbsolutePath.EndsWith("prepare-upload")) return Json(new { sessionId = "s", files = new Dictionary<string,string> { [files[0].Id] = "t" } });
            if (request.RequestUri.AbsolutePath.EndsWith("cancel")) { cancelled = true; return new(HttpStatusCode.OK); }
            stop.Cancel(); await Task.Delay(Timeout.Infinite, token); return new(HttpStatusCode.OK);
        }));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => sender.SendAsync(Device, new { }, files, null, new Progress(), stop.Token));
        Assert.True(cancelled);
    }

    [Fact]
    public async Task RevokingPermissionCancelsAnInFlightUpload()
    {
        using var permission = new CancellationTokenSource(); using var identity = new LocalSendIdentity();
        var files = LocalSendProtocol.Collect([File("file.txt")]);
        var uploading = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var sender = new LocalSendSender(identity, new RevocablePermission(permission), _ => new Handler(async (request, token) =>
        {
            if (request.RequestUri!.AbsolutePath.EndsWith("prepare-upload")) return Json(new { sessionId = "s", files = new Dictionary<string,string> { [files[0].Id] = "t" } });
            uploading.TrySetResult();
            await Task.Delay(Timeout.Infinite, token); return new(HttpStatusCode.OK);
        }));
        var sending = sender.SendAsync(Device, new { }, files, null, new Progress(), default);
        await uploading.Task.WaitAsync(TimeSpan.FromSeconds(3)); permission.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => sending.WaitAsync(TimeSpan.FromSeconds(3)));
    }

    [Fact]
    public async Task DeniedDiscoveryAndManualConnectionsDoNotOpenNetworkSessions()
    {
        using var session = new LocalSendSession(new Permission(false));
        await Assert.ThrowsAsync<HttpRequestException>(() => session.ScanAsync(default));
        await Assert.ThrowsAsync<HttpRequestException>(() => session.FindAsync(IPAddress.Loopback, 53317, default));
    }

    [Theory]
    [InlineData(true)] [InlineData(false)]
    public async Task RealMutualTlsRoundtripPinsTheReceiverBeforeSendingFiles(bool correctPin)
    {
        byte[] bytes = Enumerable.Range(0, 256).Select(i => (byte)i).ToArray();
        var files = LocalSendProtocol.Collect([File("roundtrip.bin", bytes)]);
        using var rsa = RSA.Create(2048);
        var request = new CertificateRequest("CN=localhost", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        using var generated = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-5), DateTimeOffset.UtcNow.AddDays(1));
        byte[] pfx = generated.Export(X509ContentType.Pfx);
        using var certificate = new X509Certificate2(pfx, (string?)null, X509KeyStorageFlags.UserKeySet);
        CryptographicOperations.ZeroMemory(pfx);
        using var senderIdentity = new LocalSendIdentity();
        using var server = new TcpListener(IPAddress.Loopback, 0); server.Start();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(20));
        var device = Device with { Port = ((IPEndPoint)server.LocalEndpoint).Port, Protocol = "https", Fingerprint = correctPin ? certificate.GetCertHashString(HashAlgorithmName.SHA256) : new string('0',64) };
        int clientCertificates = 0, requestsReceived = 0;
        var receive = Task.Run(async () =>
        {
            for (int i = 0; i < 2; i++)
            {
                using var connection = await server.AcceptTcpClientAsync(deadline.Token);
                using var ssl = new SslStream(connection.GetStream());
                await ssl.AuthenticateAsServerAsync(new SslServerAuthenticationOptions
                {
                    ServerCertificate = certificate, ClientCertificateRequired = true, EnabledSslProtocols = SslProtocols.Tls12,
                    RemoteCertificateValidationCallback = (_, client, _, _) =>
                    {
                        if (client?.GetCertHashString(HashAlgorithmName.SHA256) != senderIdentity.Fingerprint) return false;
                        Interlocked.Increment(ref clientCertificates); return true;
                    }
                }, deadline.Token);
                string header = ""; var one = new byte[1];
                while (!header.EndsWith("\r\n\r\n", StringComparison.Ordinal))
                {
                    await ssl.ReadExactlyAsync(one, deadline.Token); header += (char)one[0]; Assert.True(header.Length < 8192);
                }
                requestsReceived++;
                string length = header.Split("\r\n").Single(line => line.StartsWith("Content-Length:",StringComparison.OrdinalIgnoreCase))[15..];
                var body = new byte[int.Parse(length)]; await ssl.ReadExactlyAsync(body, deadline.Token);
                byte[] response;
                if (i == 0)
                {
                    using var json = JsonDocument.Parse(body); Assert.True(json.RootElement.GetProperty("files").TryGetProperty(files[0].Id, out _));
                    response = JsonSerializer.SerializeToUtf8Bytes(new { sessionId = "s", files = new Dictionary<string,string> { [files[0].Id] = "token" } });
                }
                else { Assert.Equal(bytes, body); response = []; }
                await ssl.WriteAsync(Encoding.ASCII.GetBytes($"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {response.Length}\r\nConnection: close\r\n\r\n"), deadline.Token);
                await ssl.WriteAsync(response, deadline.Token);
            }
        }, deadline.Token);
        var sending = new LocalSendSender(senderIdentity, Online()).SendAsync(device, new { fingerprint = senderIdentity.Fingerprint }, files, null, new Progress(), deadline.Token);
        if (!correctPin)
        {
            await Assert.ThrowsAsync<HttpRequestException>(() => sending);
            var error = await Record.ExceptionAsync(() => receive);
            Assert.True(error is IOException or AuthenticationException);
            Assert.Equal(0, requestsReceived);
            return;
        }
        await Task.WhenAll(receive, sending);
        Assert.Equal(new LocalSendResult(1,0), await sending); Assert.Equal(2, clientCertificates);
    }
    public void Dispose()
    {
        string expected = Path.GetFullPath(Path.GetTempPath()) + "v-notch-localsend-tests-";
        if (!Path.GetFullPath(_root).StartsWith(expected, StringComparison.OrdinalIgnoreCase)) throw new IOException("Unexpected test cleanup path.");
        Directory.Delete(_root, true);
    }
}
