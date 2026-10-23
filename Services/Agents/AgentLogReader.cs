// Local customization: bounded, read-only extraction. Conversation text is never retained.
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;

namespace VNotch.Services.Agents;

internal sealed record AgentLog(IReadOnlyList<AgentRecord> Records, AgentAccount? Account, AgentSession? Recent, bool Partial);
internal static class AgentLogReader
{
    internal const int MaxBytes = 256 * 1024;
    internal static AgentLog Read(string path, string provider, DateTimeOffset now)
    {
        using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        bool partial = file.Length > MaxBytes;
        var lines = new List<string>();
        long length = file.Length;
        if (partial)
        {
            byte[] header = new byte[8192]; int head = file.Read(header);
            string first = Encoding.UTF8.GetString(header, 0, head).Split('\n')[0];
            if (first.Contains("session_meta", StringComparison.Ordinal)) lines.Add(first);
            file.Seek(Math.Max(0, length - MaxBytes), SeekOrigin.Begin);
        }
        var buffer = new byte[(int)Math.Min(length, MaxBytes)]; int used = 0;
        while (used < buffer.Length) { int read = file.Read(buffer.AsSpan(used)); if (read == 0) break; used += read; }
        var tail = Encoding.UTF8.GetString(buffer, 0, used).Split('\n');
        lines.AddRange(partial ? tail.Skip(1) : tail); // Do not parse a tail's partial first line.
        return Parse(lines, provider, Path.GetFileNameWithoutExtension(path), now) with { Partial = partial };
    }
    internal static AgentLog Parse(IEnumerable<string> lines, string provider, string fileId, DateTimeOffset now)
    {
        var records = new Dictionary<string, AgentRecord>(StringComparer.Ordinal);
        AgentAccount? account = null; AgentSession? recent = null;
        string model = "Unknown model", project = "Local session"; long lastTotal = -1;
        foreach (string line in lines)
        {
            try
            {
                using var document = JsonDocument.Parse(line, new JsonDocumentOptions { MaxDepth = 32 });
                var root = document.RootElement;
                var timestamp = root.Get("timestamp").Time();
                if (timestamp == null || timestamp > now.AddMinutes(5)) continue;
                var at = timestamp.Value; var payload = root.Get("payload");
                if (provider == "Codex")
                {
                    string type = payload.Get("type").Text();
                    if (root.Get("type").Text() == "session_meta") project = Project(payload.Get("cwd").Text(1024));
                    if (root.Get("type").Text() == "turn_context") model = payload.Get("model").Text() is { Length: > 0 } name ? name : model;
                    if (type is "task_started" or "task_complete" or "turn_aborted")
                        recent = new("Codex", model, project, type == "task_started" && now - at < TimeSpan.FromMinutes(2) ? "Recorded active" : "Recent", at);
                    if (type != "token_count") continue;
                    var quota = AgentJson.CodexWindows(payload.Get("rate_limits"), at, "Log snapshot");
                    if (quota.Count > 0) account = new("Log snapshot", quota, at);
                    var info = payload.Get("info"); long total = info.Get("total_token_usage").Get("total_tokens").Count();
                    if (total > 0 && total == lastTotal) continue;
                    lastTotal = total;
                    var usage = info.Get("last_token_usage");
                    long input = usage.Get("input_tokens").Count(), output = usage.Get("output_tokens").Count();
                    if (input + output == 0) continue;
                    string id = fileId + ":" + at.ToUnixTimeMilliseconds() + ":" + total;
                    records[id] = new(id, at, model, input, output, Math.Min(input, usage.Get("cached_input_tokens").Count()));
                }
                else
                {
                    if (root.Get("type").Text() != "assistant") continue;
                    var message = root.Get("message"); var usage = message.Get("usage");
                    string id = message.Get("id").Text(150); if (id.Length == 0) continue;
                    id = fileId + ":" + id;
                    long cached = usage.Get("cache_read_input_tokens").Count();
                    long input = usage.Get("input_tokens").Count() + cached + usage.Get("cache_creation_input_tokens").Count();
                    long output = usage.Get("output_tokens").Count();
                    if (input + output == 0) continue;
                    model = message.Get("model").Text() is { Length: > 0 } name ? name : model;
                    if (records.TryGetValue(id, out var previous)) { input = Math.Max(input, previous.Input); output = Math.Max(output, previous.Output); cached = Math.Max(cached, previous.Cached); }
                    records[id] = new(id, at, model, input, output, cached);
                    project = Project(root.Get("cwd").Text(1024));
                    recent = new("Claude Code", model, project, "Recent", at);
                }
            }
            catch (Exception ex) when (ex is JsonException or ArgumentOutOfRangeException or InvalidOperationException) { }
        }
        return new(records.Values.OrderByDescending(r => r.At).ToArray(), account, recent, false);
    }
    internal static string Project(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return "Local session";
        return path.Replace('\\', '/').TrimEnd('/').Split('/').LastOrDefault() is { Length: > 0 } name ? name : "Local session";
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
