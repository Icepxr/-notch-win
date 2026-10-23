// Local customization: read-only CLI control requests; no prompt, turn or login is sent.
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;

namespace VNotch.Services.Agents;

internal sealed record AgentCommand(string File, IReadOnlyList<string> Prefix);
internal static class AgentAccounts
{
    internal static AgentCommand? Find(string provider)
    {
        string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        string name = provider == "Codex" ? "codex.exe" : "claude.exe";
        var candidates = new List<string> { Path.Combine(home, ".local", "bin", name), Path.Combine(home, ".claude", "local", name) };
        candidates.AddRange((Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator).Where(Directory.Exists).Select(dir => Path.Combine(dir, name)));
        if (provider == "Codex")
        {
            string root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OpenAI", "Codex", "bin");
            if (Directory.Exists(root)) candidates.AddRange(Directory.EnumerateDirectories(root).OrderByDescending(Directory.GetLastWriteTimeUtc).Take(10).Select(dir => Path.Combine(dir, name)));
        }
        else
        {
            foreach (var process in Process.GetProcessesByName("claude"))
            {
                using (process) try { if (process.MainModule?.FileName is { } path && Path.GetFileName(path).Equals(name, StringComparison.OrdinalIgnoreCase)) candidates.Add(path); }
                catch (Exception ex) when (ex is System.ComponentModel.Win32Exception or InvalidOperationException or NotSupportedException) { }
            }
        }
        // Desktop Claude.exe has the same name as the CLI, but is a GUI application.
        // Also discover the Desktop-bundled CLI when no Claude session is running.
        if (provider != "Codex")
        {
            string data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Claude-Data");
            foreach (string profile in Directories(data, 16))
                foreach (string version in Directories(Path.Combine(profile, "claude-code"), 10))
                    candidates.AddRange(Directories(version, 4).Select(dir => Path.Combine(dir, name)));
        }
        string? executable = candidates.Distinct(StringComparer.OrdinalIgnoreCase).FirstOrDefault(path => File.Exists(path) && (provider == "Codex" || IsConsoleExecutable(path)));
        if (executable != null) return new(executable, []);
        if (provider != "Codex")
        {
            string script = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "npm", "node_modules", "@anthropic-ai", "claude-code", "cli.js");
            string? node = (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator).Where(Directory.Exists).Select(dir => Path.Combine(dir, "node.exe")).FirstOrDefault(File.Exists);
            if (node != null && File.Exists(script)) return new(node, [script]);
        }
        return null;
    }
    private static IEnumerable<string> Directories(string root, int count)
    {
        try { return Directory.Exists(root) ? Directory.GetDirectories(root).OrderByDescending(Directory.GetLastWriteTimeUtc).Take(count).ToArray() : []; }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { return []; }
    }
    internal static bool IsConsoleExecutable(string path)
    {
        try
        {
            using var file = File.OpenRead(path); using var reader = new BinaryReader(file);
            if (file.Length < 64 || reader.ReadUInt16() != 0x5a4d) return false;
            file.Position = 60; long offset = reader.ReadUInt32();
            if (offset < 64 || offset > file.Length - 94) return false;
            file.Position = offset; if (reader.ReadUInt32() != 0x00004550) return false;
            file.Position = offset + 24; ushort format = reader.ReadUInt16();
            if (format is not (0x10b or 0x20b)) return false;
            file.Position = offset + 92; return reader.ReadUInt16() == 3; // IMAGE_SUBSYSTEM_WINDOWS_CUI
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { return false; }
    }
    internal static void ConfigureClaudeEnvironment(ProcessStartInfo start, string settingsPath)
    {
        start.Environment.Remove("CLAUDECODE");
        start.Environment["DISABLE_AUTOUPDATER"] = "1";
        start.Environment["DISABLE_TELEMETRY"] = "1";
        start.Environment["DISABLE_ERROR_REPORTING"] = "1";
        // Do not inject DISABLE_NONESSENTIAL_TRAFFIC: it also suppresses get_usage.
        // Preserve explicit user traffic opt-outs, proxies and CA settings, without
        // loading hooks, tools, credentials or arbitrary settings-file environment.
        try
        {
            if (!File.Exists(settingsPath) || new FileInfo(settingsPath).Length > 1024 * 1024) return;
            using var document = JsonDocument.Parse(File.ReadAllText(settingsPath), new JsonDocumentOptions { MaxDepth = 32 });
            var env = document.RootElement.Get("env");
            foreach (string name in new[] { "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "NODE_EXTRA_CA_CERTS" })
                if (!start.Environment.ContainsKey(name) && env.Get(name).ValueKind == JsonValueKind.String && env.Get(name).GetString() is { Length: <= 8192 } value)
                    start.Environment[name] = value;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException) { }
    }
    internal static AgentAccount ParseCodex(JsonElement result, DateTimeOffset now)
    {
        var bucket = result.Get("rateLimitsByLimitId").Get("codex");
        if (bucket.ValueKind != JsonValueKind.Object) bucket = result.Get("rateLimits");
        var windows = AgentJson.CodexWindows(bucket, now, "Account");
        return new(windows.Count > 0 ? "Live account" : "No plan limits published", windows, now);
    }
    internal static AgentAccount ParseClaude(JsonElement result, DateTimeOffset now)
    {
        if (result.Get("rate_limits_available").ValueKind == JsonValueKind.False)
            return new("Subscription limits unavailable for this CLI account", [], now);
        var windows = AgentJson.ClaudeWindows(result.Get("rate_limits"), now);
        string status = windows.Count > 0 ? "Live account" : "Claude returned no limits · retry or check network settings";
        return new(status, windows, now);
    }
    internal static async Task<AgentAccount> ReadAsync(string provider, Func<CancellationToken> permission, CancellationToken cancellation)
    {
        var now = DateTimeOffset.Now;
        try
        {
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellation, permission());
            deadline.CancelAfter(TimeSpan.FromSeconds(25));
            deadline.Token.ThrowIfCancellationRequested();
            var command = Find(provider); if (command == null) return new("CLI not found · install or open " + provider, [], now);
            var start = new ProcessStartInfo(command.File) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true,
                RedirectStandardOutput = true, RedirectStandardError = true, WorkingDirectory = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile) };
            foreach (string arg in command.Prefix) start.ArgumentList.Add(arg);
            bool codex = provider == "Codex";
            foreach (string arg in codex ? new[] { "-c", "features.plugins=false", "app-server" } :
                new[] { "--print", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--no-session-persistence",
                    "--tools", "", "--strict-mcp-config", "--mcp-config", "{\"mcpServers\":{}}", "--setting-sources", "", "--settings", "{\"disableAllHooks\":true}" }) start.ArgumentList.Add(arg);
            if (!codex)
            {
                string config = Environment.GetEnvironmentVariable("CLAUDE_CONFIG_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".claude");
                ConfigureClaudeEnvironment(start, Path.Combine(config, "settings.json"));
            }
            using var process = new Process { StartInfo = start };
            try
            {
                deadline.Token.ThrowIfCancellationRequested();
                if (!process.Start()) return new("Could not start CLI", [], now);
                var drain = DrainAsync(process.StandardError, deadline.Token); // Never expose CLI account/auth bodies.
                async Task Send(object request) { await process.StandardInput.WriteLineAsync(JsonSerializer.Serialize(request).AsMemory(), deadline.Token); await process.StandardInput.FlushAsync(deadline.Token); }
                if (codex) await Send(new { id = 1, method = "initialize", @params = new { clientInfo = new { name = "vnotch_agent_monitor", version = "1.0" } } });
                else await Send(new { type = "control_request", request_id = "initialize", request = new { subtype = "initialize" } });
                int characters = 0;
                while (await LineAsync(process.StandardOutput, deadline.Token) is { } line)
                {
                    characters += line.Length; if (characters > 2 * 1024 * 1024) throw new IOException("CLI response too large.");
                    JsonDocument document;
                    try { document = JsonDocument.Parse(line, new JsonDocumentOptions { MaxDepth = 32 }); } catch (JsonException) { continue; }
                    using (document)
                    {
                        var root = document.RootElement;
                        if (codex)
                        {
                            long id = root.Get("id").Count(); if (id == 0) continue;
                            if (root.Get("error").ValueKind == JsonValueKind.Object) return new("Account limits unavailable · check Codex sign-in", [], now);
                            if (id == 1) { await Send(new { method = "initialized", @params = new { } }); await Send(new { id = 2, method = "account/read", @params = new { refreshToken = false } }); }
                            if (id == 2)
                            {
                                string type = root.Get("result").Get("account").Get("type").Text();
                                if (type is not ("chatgpt" or "chatgptAuthTokens" or "personalAccessToken")) return new("Sign in to Codex with a ChatGPT account", [], now);
                                await Send(new { id = 3, method = "account/rateLimits/read", @params = new { } });
                            }
                            if (id == 3) return ParseCodex(root.Get("result"), DateTimeOffset.Now);
                        }
                        else
                        {
                            if (root.Get("type").Text() != "control_response") continue;
                            var response = root.Get("response");
                            if (response.Get("subtype").Text() != "success") return new("Usage unavailable · check sign-in or update Claude Code", [], now);
                            if (response.Get("request_id").Text() == "initialize")
                                await Send(new { type = "control_request", request_id = "usage", request = new { subtype = "get_usage", skip_behaviors = true } });
                            if (response.Get("request_id").Text() == "usage")
                            {
                                var account = ParseClaude(response.Get("response"), DateTimeOffset.Now);
                                return account.Windows.Count == 0 && start.Environment.TryGetValue("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", out string? optOut) && !string.IsNullOrEmpty(optOut)
                                    ? account with { Status = "Usage checks disabled by your Claude traffic setting" } : account;
                            }
                        }
                    }
                }
                return new("CLI closed before returning limits", [], now);
            }
            finally
            {
                try
                {
                    if (!process.HasExited)
                    {
                        process.StandardInput.Close();
                        try { await process.WaitForExitAsync(CancellationToken.None).WaitAsync(TimeSpan.FromSeconds(2)); }
                        catch (TimeoutException) { process.Kill(entireProcessTree: true); await process.WaitForExitAsync(CancellationToken.None).WaitAsync(TimeSpan.FromSeconds(3)); }
                    }
                }
                catch (Exception ex) when (ex is InvalidOperationException or System.ComponentModel.Win32Exception or TimeoutException or IOException or ObjectDisposedException) { }
            }
        }
        catch (OperationCanceledException) when (!cancellation.IsCancellationRequested) { return new("Account check stopped · check network or privacy settings", [], now); }
        catch (System.Net.Http.HttpRequestException) { return new("Account checks are disabled by Privacy settings", [], now); }
        catch (Exception ex) when (ex is IOException or System.ComponentModel.Win32Exception or System.Net.Http.HttpRequestException or UnauthorizedAccessException or JsonException)
        { return new("Account check unavailable · check CLI and network settings", [], now); }
    }
    private static async Task<string?> LineAsync(StreamReader reader, CancellationToken cancellation)
    {
        var result = new StringBuilder(); var single = new char[1];
        while (await reader.ReadAsync(single.AsMemory(), cancellation) != 0)
        {
            if (single[0] == '\n') return result.ToString();
            result.Append(single[0]); if (result.Length > 262144) throw new IOException("CLI response too large.");
        }
        return result.Length > 0 ? result.ToString() : null;
    }
    private static async Task DrainAsync(StreamReader reader, CancellationToken cancellation)
    { try { var buffer = new char[4096]; while (await reader.ReadAsync(buffer.AsMemory(), cancellation) != 0) { } } catch (Exception ex) when (ex is IOException or OperationCanceledException or ObjectDisposedException) { } }
}
