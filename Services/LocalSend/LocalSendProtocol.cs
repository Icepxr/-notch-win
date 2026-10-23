// Local customization: send-only LocalSend protocol v2 support.
using System.IO;
using System.Net;
using System.Text.Json;

namespace VNotch.Services.LocalSend;

internal sealed record LocalSendDevice(string Alias, IPAddress Address, int Port, string Protocol,
    string Fingerprint, string Model = "")
{
    public string Key => $"{Address}:{Port}";
    public string DisplayName => Alias;
    public string Detail => string.IsNullOrWhiteSpace(Model) ? Address.ToString() : $"{Model} · {Address}";
    public Uri Endpoint(string path) => new UriBuilder(Protocol, Address.ToString(), Port, path).Uri;
}

internal sealed record LocalSendFile(string Id, string Path, string Name, long Size);
internal sealed record LocalSendProgress(string Message, long Sent = 0, long Total = 0);
internal sealed record LocalSendResult(int Sent, int Skipped);
internal sealed class LocalSendException(string message, bool pinRequired = false) : IOException(message)
{
    public bool PinRequired { get; } = pinRequired;
}

internal interface ILocalSendPermission
{
    CancellationToken Acquire();
}

internal interface ILocalSendSession : IDisposable
{
    event Action<IReadOnlyList<LocalSendDevice>>? DevicesChanged;
    Task ScanAsync(CancellationToken cancellation);
    Task<LocalSendDevice> FindAsync(IPAddress address, int port, CancellationToken cancellation);
    Task<LocalSendResult> SendAsync(LocalSendDevice device, IReadOnlyList<LocalSendFile> files, string? pin,
        IProgress<LocalSendProgress> progress, CancellationToken cancellation);
}

internal static class LocalSendProtocol
{
    internal const int Port = 53317;
    internal const int MaxFiles = 4096;
    internal static readonly IPAddress Multicast = IPAddress.Parse("224.0.0.167");
    internal static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    internal static bool IsNearby(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        if (IPAddress.IsLoopback(address)) return true;
        var bytes = address.GetAddressBytes();
        return bytes.Length == 4
            ? bytes[0] == 10 || bytes[0] == 192 && bytes[1] == 168 || bytes[0] == 172 && bytes[1] is >= 16 and <= 31 || bytes[0] == 169 && bytes[1] == 254
            : address.IsIPv6LinkLocal || (bytes[0] & 0xfe) == 0xfc;
    }

    internal static LocalSendDevice? ReadDevice(ReadOnlySpan<byte> json, IPAddress address)
    {
        if (json.Length > 32768 || !IsNearby(address)) return null;
        try
        {
            using var document = JsonDocument.Parse(json.ToArray(), new JsonDocumentOptions { MaxDepth = 8 });
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return null;
            string Text(string key, int max = 96) => root.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String
                ? new string((value.GetString() ?? "").Where(c => !char.IsControl(c)).Take(max).ToArray()).Trim() : "";
            var fingerprint = Text("fingerprint", 128);
            if (fingerprint.Length == 0) return null;
            int port = root.TryGetProperty("port", out var number) && number.TryGetInt32(out int parsed) ? parsed : Port;
            if (port is < 1 or > 65535) return null;
            string protocol = Text("protocol");
            if (protocol.Length == 0) protocol = "https";
            if (protocol is not ("https" or "http")) return null;
            string alias = Text("alias");
            return new(alias.Length == 0 ? address.ToString() : alias, address, port, protocol, fingerprint, Text("deviceModel"));
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException or FormatException) { return null; }
    }

    internal static IReadOnlyList<LocalSendFile> Collect(IEnumerable<string> paths, CancellationToken cancellation = default)
    {
        var files = new List<LocalSendFile>();
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var roots = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        void Add(string path, string name, int depth)
        {
            cancellation.ThrowIfCancellationRequested();
            if (depth > 32) throw new IOException("The selected folder is too deeply nested.");
            var attributes = File.GetAttributes(path);
            if ((attributes & FileAttributes.ReparsePoint) != 0) throw new IOException("Linked files and folders cannot be sent. Select the original files instead.");
            if ((attributes & FileAttributes.Directory) != 0)
            {
                foreach (string child in Directory.EnumerateFileSystemEntries(path)) Add(child, name + "/" + System.IO.Path.GetFileName(child), depth + 1);
                return;
            }
            if (files.Count >= MaxFiles) throw new IOException($"Select at most {MaxFiles:N0} files per transfer.");
            if (name.Split('/').Any(part => part is "" or "." or ".." || part.Contains(':') || part.Contains('\\')) || !names.Add(name))
                throw new IOException("The selection contains conflicting file names.");
            files.Add(new(Guid.NewGuid().ToString("N"), System.IO.Path.GetFullPath(path), name, new FileInfo(path).Length));
        }
        foreach (string path in paths)
        {
            string full = System.IO.Path.GetFullPath(path);
            if (full.StartsWith("\\\\", StringComparison.Ordinal)) throw new IOException("Select files stored on this PC.");
            string original = System.IO.Path.GetFileName(System.IO.Path.TrimEndingDirectorySeparator(full));
            string name = original;
            for (int suffix = 2; !roots.Add(name); suffix++) name = System.IO.Path.GetFileNameWithoutExtension(original) + $" ({suffix})" + System.IO.Path.GetExtension(original);
            Add(full, name, 0);
        }
        if (files.Count == 0) throw new IOException("There are no files to send. Empty folders cannot be transferred.");
        return files;
    }

    internal static string Mime(string name) => System.IO.Path.GetExtension(name).ToLowerInvariant() switch
    {
        ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg", ".heic" => "image/heic", ".gif" => "image/gif",
        ".webp" => "image/webp", ".pdf" => "application/pdf", ".txt" or ".md" => "text/plain", ".json" => "application/json",
        ".zip" => "application/zip", ".mp4" => "video/mp4", ".mov" => "video/quicktime", ".mp3" => "audio/mpeg", _ => "application/octet-stream"
    };
}
