// Local customization: bounded, read-only extraction. Conversation text is never retained.
using System.Buffers;
using System.Diagnostics;
using System.IO;
using System.Text.Json;

namespace VNotch.Services.Agents;

internal sealed record AgentLog(IReadOnlyList<AgentRecord> Records, AgentAccount? Account, AgentSession? Recent, bool Partial);
internal static class AgentLogReader
{
    internal const int MaxBytes = 256 * 1024;
    private static readonly JsonDocumentOptions JsonOptions = new() { MaxDepth = 32 };

    internal static AgentLog Read(string path, string provider, DateTimeOffset now)
    {
        using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        long length = file.Length;
        if (length == 0) return new([], null, null, false);
        bool partial = length > MaxBytes;
        int capacity = (int)Math.Min(length, MaxBytes);
        byte[] buffer = ArrayPool<byte>.Shared.Rent(Math.Max(8192, capacity));
        var parser = new LogParser(provider, Path.GetFileNameWithoutExtension(path), now);
        try
        {
            if (partial)
            {
                int head = file.Read(buffer.AsSpan(0, 8192));
                int newline = buffer.AsSpan(0, head).IndexOf((byte)'\n');
                parser.Add(buffer.AsMemory(0, newline < 0 ? head : newline), headerOnly: true);
                file.Seek(length - MaxBytes, SeekOrigin.Begin);
            }
            int used = 0;
            while (used < capacity)
            {
                int read = file.Read(buffer.AsSpan(used, capacity - used));
                if (read == 0) break;
                used += read;
            }
            parser.AddLines(buffer.AsMemory(0, used), skipFirst: partial);
            return parser.Finish(partial);
        }
        finally
        {
            // Log tails can contain conversation text even though only metadata
            // is extracted. Clear it before returning shared storage.
            ArrayPool<byte>.Shared.Return(buffer, clearArray: true);
        }
    }

    internal static AgentLog Parse(IEnumerable<string> lines, string provider, string fileId, DateTimeOffset now)
    {
        var parser = new LogParser(provider, fileId, now);
        foreach (string line in lines) parser.Add(line);
        return parser.Finish();
    }

    private sealed class LogParser(string provider, string fileId, DateTimeOffset now)
    {
        private readonly Dictionary<string, AgentRecord> records = new(StringComparer.Ordinal);
        private AgentAccount? account;
        private AgentSession? recent;
        private string model = "Unknown model", project = "Local session";
        private long lastTotal = -1;

        internal AgentLog Finish(bool partial = false) => new(records.Values.OrderByDescending(r => r.At).ToArray(), account, recent, partial);

        internal void AddLines(ReadOnlyMemory<byte> bytes, bool skipFirst)
        {
            int offset = 0;
            if (skipFirst)
            {
                int first = bytes.Span.IndexOf((byte)'\n');
                if (first < 0) return;
                offset = first + 1;
            }
            while (offset < bytes.Length)
            {
                int newline = bytes.Span[offset..].IndexOf((byte)'\n');
                int count = newline < 0 ? bytes.Length - offset : newline;
                Add(bytes.Slice(offset, count));
                if (newline < 0) break;
                offset += count + 1;
            }
        }

        internal void Add(string line)
        {
            if (string.IsNullOrWhiteSpace(line)) return;
            try { using var document = JsonDocument.Parse(line, JsonOptions); Consume(document.RootElement); }
            catch (Exception ex) when (ex is JsonException or ArgumentOutOfRangeException or InvalidOperationException) { }
        }

        internal void Add(ReadOnlyMemory<byte> line, bool headerOnly = false)
        {
            if (line.IsEmpty) return;
            try
            {
                using var document = JsonDocument.Parse(line, JsonOptions);
                if (!headerOnly || document.RootElement.Get("type").ValueEquals("session_meta")) Consume(document.RootElement);
            }
            catch (Exception ex) when (ex is JsonException or ArgumentOutOfRangeException or InvalidOperationException) { }
        }

        private void Consume(JsonElement root)
        {
            var timestamp = root.Get("timestamp").Time();
            if (timestamp == null || timestamp > now.AddMinutes(5)) return;
            var at = timestamp.Value; var payload = root.Get("payload");
            if (provider == "Codex")
            {
                string type = payload.Get("type").Text();
                if (root.Get("type").Text() == "session_meta") project = Project(payload.Get("cwd").Text(1024));
                if (root.Get("type").Text() == "turn_context") model = payload.Get("model").Text() is { Length: > 0 } name ? name : model;
                if (type is "task_started" or "task_complete" or "turn_aborted")
                    recent = new("Codex", model, project, type == "task_started" && now - at < TimeSpan.FromMinutes(2) ? "Recorded active" : "Recent", at);
                if (type != "token_count") return;
                var quota = AgentJson.CodexWindows(payload.Get("rate_limits"), at, "Log snapshot");
                if (quota.Count > 0) account = new("Log snapshot", quota, at);
                var info = payload.Get("info"); long total = info.Get("total_token_usage").Get("total_tokens").Count();
                if (total > 0 && total == lastTotal) return;
                lastTotal = total;
                var usage = info.Get("last_token_usage");
                long input = usage.Get("input_tokens").Count(), output = usage.Get("output_tokens").Count();
                if (input + output == 0) return;
                string id = fileId + ":" + at.ToUnixTimeMilliseconds() + ":" + total;
                records[id] = new(id, at, model, input, output, Math.Min(input, usage.Get("cached_input_tokens").Count()));
            }
            else
            {
                if (root.Get("type").Text() != "assistant") return;
                var message = root.Get("message"); var usage = message.Get("usage");
                string id = message.Get("id").Text(150); if (id.Length == 0) return;
                id = fileId + ":" + id;
                long cached = usage.Get("cache_read_input_tokens").Count();
                long input = usage.Get("input_tokens").Count() + cached + usage.Get("cache_creation_input_tokens").Count();
                long output = usage.Get("output_tokens").Count();
                if (input + output == 0) return;
                model = message.Get("model").Text() is { Length: > 0 } name ? name : model;
                if (records.TryGetValue(id, out var previous)) { input = Math.Max(input, previous.Input); output = Math.Max(output, previous.Output); cached = Math.Max(cached, previous.Cached); }
                records[id] = new(id, at, model, input, output, cached);
                project = Project(root.Get("cwd").Text(1024));
                recent = new("Claude Code", model, project, "Recent", at);
            }
        }
    }
    internal static string Project(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return "Local session";
        int end = path.Length;
        while (end > 0 && path[end - 1] is '/' or '\\') end--;
        if (end == 0) return "Local session";
        int start = path.AsSpan(0, end).LastIndexOfAny('/', '\\') + 1;
        return start == 0 && end == path.Length ? path : path.Substring(start, end - start);
    }
    internal static AgentSession? ClaudeSession(string json, DateTimeOffset now, Func<int, DateTimeOffset, bool>? alive = null)
    {
        try
        {
            using var document = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 12 }); var root = document.RootElement;
            long pid = root.Get("pid").Count(); var started = root.Get("startedAt").Time();
            if (pid is < 1 or > int.MaxValue || started == null || started > now) return null;
            string domain = root.Get("pidDomain").Text();
            if (domain.Length > 0 && !domain.Equals("win32:" + Environment.UserName, StringComparison.OrdinalIgnoreCase)) return null;
            if (!(alive ?? Alive)((int)pid, started.Value)) return null;
            string state = root.Get("status").Text(); var updated = root.Get("statusUpdatedAt").Time() ?? root.Get("updatedAt").Time() ?? started.Value;
            string label = state is "busy" or "working" ? "Working" : state is "idle" or "waiting" ? "Waiting" : "Running";
            string name = root.Get("name").Text(90);
            return new("Claude Code", name.Length == 0 ? "Claude Code session" : name, Project(root.Get("cwd").Text(1024)), label, updated > now ? now : updated);
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException or ArgumentOutOfRangeException) { return null; }
    }
    private static bool Alive(int pid, DateTimeOffset started)
    {
        try { using var process = Process.GetProcessById(pid); return !process.HasExited && (process.ProcessName.Contains("claude", StringComparison.OrdinalIgnoreCase) || process.ProcessName.Equals("node", StringComparison.OrdinalIgnoreCase)) && process.StartTime.ToUniversalTime() <= started.UtcDateTime.AddSeconds(5); }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException or System.ComponentModel.Win32Exception) { return false; }
    }
}
