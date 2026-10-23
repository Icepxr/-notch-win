// Local customization: bounded metadata and streamed, cancellable uploads.
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;

namespace VNotch.Services.LocalSend;

internal sealed class LocalSendSender(LocalSendIdentity identity, ILocalSendPermission policy,
    Func<LocalSendDevice, HttpMessageHandler>? transport = null)
{
    internal HttpClient CreateClient(LocalSendDevice device, bool bootstrap = false, Action<string>? observed = null)
    {
        if (!LocalSendProtocol.IsNearby(device.Address)) throw new IOException("Choose a device on your local network.");
        var handler = transport?.Invoke(device);
        if (handler == null)
        {
            var http = new HttpClientHandler { UseProxy = false, AllowAutoRedirect = false, MaxResponseHeadersLength = 32 };
            http.ClientCertificates.Add(identity.Certificate);
            http.ServerCertificateCustomValidationCallback = (_, certificate, _, _) =>
            {
                if (certificate == null) return false;
                string actual = certificate.GetCertHashString(HashAlgorithmName.SHA256);
                observed?.Invoke(actual);
                if (bootstrap) return true; // Explicit IP connection establishes the pin for this dialog.
                string expected = device.Fingerprint.Replace(":", "", StringComparison.Ordinal);
                return expected.Length == 64 && expected.All(Uri.IsHexDigit) &&
                    CryptographicOperations.FixedTimeEquals(Convert.FromHexString(actual), Convert.FromHexString(expected));
            };
            handler = http;
        }
        return new HttpClient(new PermissionHandler(policy, handler)) { Timeout = Timeout.InfiniteTimeSpan };
    }

    private sealed class PermissionHandler(ILocalSendPermission permission, HttpMessageHandler transport) : DelegatingHandler(transport)
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellation)
        {
            using var lifetime = CancellationTokenSource.CreateLinkedTokenSource(cancellation, permission.Acquire());
            return await base.SendAsync(request, lifetime.Token).ConfigureAwait(false);
        }
    }

    internal static async Task<byte[]> ReadBoundedAsync(HttpContent content, CancellationToken cancellation)
    {
        const int limit = 65536;
        if (content.Headers.ContentLength > limit) throw new IOException("The receiver returned an oversized response.");
        await using var stream = await content.ReadAsStreamAsync(cancellation);
        using var result = new MemoryStream();
        byte[] buffer = new byte[4096];
        int read;
        while ((read = await stream.ReadAsync(buffer, cancellation)) != 0)
        {
            if (result.Length + read > limit) throw new IOException("The receiver returned an oversized response.");
            result.Write(buffer, 0, read);
        }
        return result.ToArray();
    }

    internal static void CheckStatus(HttpStatusCode status)
    {
        if ((int)status is >= 200 and < 300) return;
        throw status switch
        {
            HttpStatusCode.Unauthorized => new LocalSendException("Enter the PIN shown in LocalSend on the receiving device.", true),
            HttpStatusCode.Forbidden => new LocalSendException("The receiver declined the transfer."),
            HttpStatusCode.Conflict => new LocalSendException("The receiver is busy with another transfer. Try again."),
            HttpStatusCode.TooManyRequests => new LocalSendException("The receiver has limited requests. Wait and try again."),
            _ => new LocalSendException($"The receiver returned HTTP {(int)status}. Try again.")
        };
    }

    internal async Task<LocalSendResult> SendAsync(LocalSendDevice device, object info, IReadOnlyList<LocalSendFile> files,
        string? pin, IProgress<LocalSendProgress> progress, CancellationToken cancellation)
    {
        if (files.Count is < 1 or > LocalSendProtocol.MaxFiles) throw new IOException("Select files before sending.");
        using var permissionLifetime = CancellationTokenSource.CreateLinkedTokenSource(cancellation, policy.Acquire());
        cancellation = permissionLifetime.Token;
        using var client = CreateClient(device);
        string? session = null;
        bool completed = false;
        try
        {
            progress.Report(new($"Waiting for {device.Alias} to accept…"));
            using var prepareDeadline = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
            prepareDeadline.CancelAfter(TimeSpan.FromMinutes(3));
            string path = "/api/localsend/v2/prepare-upload" + (string.IsNullOrEmpty(pin) ? "" : "?pin=" + Uri.EscapeDataString(pin));
            var metadata = files.ToDictionary(file => file.Id, file => new { id = file.Id, fileName = file.Name, size = file.Size, fileType = LocalSendProtocol.Mime(file.Name) });
            using var prepare = new HttpRequestMessage(HttpMethod.Post, device.Endpoint(path.Split('?')[0]));
            if (path.Contains('?')) prepare.RequestUri = new Uri(prepare.RequestUri + path[path.IndexOf('?')..]);
            prepare.Content = new StringContent(JsonSerializer.Serialize(new { info, files = metadata }, LocalSendProtocol.Json), System.Text.Encoding.UTF8, "application/json");
            using var reply = await client.SendAsync(prepare, HttpCompletionOption.ResponseHeadersRead, prepareDeadline.Token);
            CheckStatus(reply.StatusCode);
            if (reply.StatusCode == HttpStatusCode.NoContent) { completed = true; return new(0, files.Count); }
            using var document = JsonDocument.Parse(await ReadBoundedAsync(reply.Content, prepareDeadline.Token), new JsonDocumentOptions { MaxDepth = 8 });
            var root = document.RootElement;
            session = root.GetProperty("sessionId").GetString();
            if (string.IsNullOrEmpty(session) || session.Length > 1024) throw new IOException("The receiver returned an invalid session.");
            var tokens = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var property in root.GetProperty("files").EnumerateObject())
            {
                string? token = property.Value.GetString();
                if (tokens.Count >= files.Count || !metadata.ContainsKey(property.Name) || string.IsNullOrEmpty(token) || token.Length > 1024 || !tokens.TryAdd(property.Name, token))
                    throw new IOException("The receiver returned invalid file tokens.");
            }
            long total = files.Where(file => tokens.ContainsKey(file.Id)).Sum(file => file.Size), offset = 0;
            int sent = 0;
            foreach (var file in files)
            {
                if (!tokens.TryGetValue(file.Id, out string? token)) continue;
                cancellation.ThrowIfCancellationRequested();
                using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
                deadline.CancelAfter(TimeSpan.FromMinutes(30));
                using var request = new HttpRequestMessage(HttpMethod.Post,
                    new Uri(device.Endpoint("/api/localsend/v2/upload") + $"?sessionId={Uri.EscapeDataString(session)}&fileId={Uri.EscapeDataString(file.Id)}&token={Uri.EscapeDataString(token)}"));
                long preceding = offset;
                request.Content = new FileContent(file, bytes => progress.Report(new($"Sending {file.Name}", preceding + bytes, total)), deadline.Token);
                progress.Report(new($"Sending {file.Name}", offset, total));
                using var upload = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
                CheckStatus(upload.StatusCode);
                offset += file.Size; sent++;
            }
            completed = true;
            return new(sent, files.Count - sent);
        }
        catch (OperationCanceledException) when (!cancellation.IsCancellationRequested)
        { throw new LocalSendException("The receiver did not respond in time. Try again."); }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException)
        { throw new LocalSendException("The receiver returned an invalid transfer response."); }
        finally
        {
            if (!completed && session != null)
            {
                // The normal privacy handler still applies, including revocation.
                using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                try { using var cancel = await client.PostAsync(new Uri(device.Endpoint("/api/localsend/v2/cancel") + "?sessionId=" + Uri.EscapeDataString(session)), null, deadline.Token); }
                catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or IOException) { }
            }
        }
    }

    private sealed class FileContent : HttpContent
    {
        private readonly LocalSendFile file;
        private readonly Action<long> progress;
        private readonly CancellationToken cancellation;
        internal FileContent(LocalSendFile file, Action<long> progress, CancellationToken cancellation)
        {
            this.file = file; this.progress = progress; this.cancellation = cancellation;
            Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        }
        protected override bool TryComputeLength(out long length) { length = file.Size; return true; }
        protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) => WriteAsync(stream);
        private async Task WriteAsync(Stream destination)
        {
            await using var source = new FileStream(file.Path, FileMode.Open, FileAccess.Read, FileShare.Read, 65536, FileOptions.Asynchronous | FileOptions.SequentialScan);
            if (source.Length != file.Size) throw new IOException("A selected file changed. Close this window and select it again.");
            byte[] buffer = new byte[65536];
            long sent = 0, last = Environment.TickCount64;
            int read;
            while ((read = await source.ReadAsync(buffer, cancellation)) != 0)
            {
                await destination.WriteAsync(buffer.AsMemory(0, read), cancellation);
                sent += read;
                if (Environment.TickCount64 - last >= 100 || sent == file.Size) { progress(sent); last = Environment.TickCount64; }
            }
        }
    }
}
