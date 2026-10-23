using System.IO;
using System.Text.Json;
using VNotch.Services.Agents;
using Xunit;

namespace VNotch.Tests;
public sealed class AgentMonitorTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 23, 12, 0, 0, TimeSpan.Zero);
    private static string Json(object value) => JsonSerializer.Serialize(value);
    private static JsonElement Node(object value) => JsonSerializer.SerializeToElement(value);
    [Fact]
    public void CodexSnapshotsDedupeCumulativeUpdatesAndKeepCachedInputInsideInput()
    {
        string Usage(int total) => Json(new { timestamp = Now, type = "event_msg", payload = new { type = "token_count", info = new { total_token_usage = new { total_tokens = total }, last_token_usage = new { input_tokens = 100, output_tokens = 20, cached_input_tokens = 70 } }, rate_limits = new { primary = new { used_percent = 25, window_minutes = 300, resets_at = Now.AddHours(2).ToUnixTimeSeconds() } } } });
        var log = AgentLogReader.Parse([Usage(120), Usage(120), "{broken", Usage(240)], "Codex", "session", Now);
        Assert.Equal(2, log.Records.Count); Assert.Equal(240, log.Records.Sum(r => r.Total)); Assert.Equal(140, log.Records.Sum(r => r.Cached));
        Assert.Equal(75, Assert.Single(log.Account!.Windows).Remaining); Assert.Equal("Log snapshot", log.Account.Status);
    }
    [Fact]
    public void ClaudeStreamingUpdatesCountOneResponseAndIncludeCacheOnce()
    {
        string Usage(int output) => Json(new { timestamp = Now, type = "assistant", cwd = "C:\\work\\demo", message = new { id = "response", model = "fixture-model", usage = new { input_tokens = 10, cache_read_input_tokens = 80, cache_creation_input_tokens = 5, output_tokens = output }, content = "private prompt or response must not be retained" } });
        var log = AgentLogReader.Parse([Usage(2), Usage(20)], "Claude Code", "file", Now);
        var record = Assert.Single(log.Records); Assert.Equal(115, record.Total); Assert.Equal(80, record.Cached);
        Assert.Equal("demo", log.Recent!.Project); Assert.DoesNotContain("private", Json(log));
    }
    [Theory]
    [InlineData("busy", "Working")][InlineData("idle", "Waiting")][InlineData("other", "Running")]
    public void ClaudeSessionsUseExplicitStateAndRequireLocalLiveProcess(string status, string expected)
    {
        object Session(string domain) => new { pid = 123, startedAt = Now.AddMinutes(-5).ToUnixTimeMilliseconds(), pidDomain = domain, status, statusUpdatedAt = Now.ToUnixTimeMilliseconds(), name = "Fixture", cwd = "C:\\work\\demo" };
        string local = "win32:" + Environment.UserName;
        Assert.Equal(expected, AgentLogReader.ClaudeSession(Json(Session(local)), Now, (_, _) => true)!.State);
        Assert.Null(AgentLogReader.ClaudeSession(Json(Session(local)), Now, (_, _) => false));
        Assert.Null(AgentLogReader.ClaudeSession(Json(Session("win32:another-user")), Now, (_, _) => true));
    }
    [Fact]
    public void OlderClaudeFilesWithoutAStatusNeverInventWorking()
    {
        var session = AgentLogReader.ClaudeSession(Json(new { pid = 123, startedAt = Now.AddMinutes(-1).ToUnixTimeMilliseconds(), cwd = "C:\\work\\demo" }), Now, (_, _) => true);
        Assert.Equal("Running", session!.State);
        Assert.Null(AgentLogReader.ClaudeSession("[]", Now, (_, _) => true));
    }
    [Fact]
    public void MissingLimitsAreNotZeroAndResetWindowsExpire()
    {
        Assert.Empty(AgentAccounts.ParseCodex(Node(new { }), Now).Windows);
        Assert.Empty(AgentAccounts.ParseClaude(Node(new { rate_limits_available = false }), Now).Windows);
        var response = AgentAccounts.ParseCodex(Node(new { rateLimitsByLimitId = new { codex = new { primary = new { usedPercent = 101, windowDurationMins = 300, resetsAt = Now.AddSeconds(-1).ToUnixTimeSeconds() } } } }), Now);
        Assert.True(Assert.Single(response.Windows).Expired(Now)); Assert.Equal(0, response.Windows[0].Remaining);
        var claude = AgentAccounts.ParseClaude(Node(new { rate_limits = new { five_hour = new { utilization = 30.5, resets_at = Now.AddHours(1) }, seven_day = new { utilization = 60, resets_at = Now.AddDays(2) } } }), Now);
        Assert.Equal(2, claude.Windows.Count); Assert.Equal(69.5, claude.Windows[0].Remaining);
    }
    [Fact]
    public async Task PrivacyDenialDoesNotStartACommand()
    {
        int acquired = 0;
        var account = await AgentAccounts.ReadAsync("Codex", () => { acquired++; throw new System.Net.Http.HttpRequestException("Denied"); }, default);
        Assert.Equal(1, acquired); Assert.Empty(account.Windows); Assert.Contains("settings", account.Status);
    }
    [Fact]
    public async Task CacheRefreshesChangedLogsAndCancellationStopsReads()
    {
        string root = Path.Combine(Path.GetTempPath(), "vnotch-agent-test-" + Guid.NewGuid().ToString("N"));
        try
        {
            string folder = Path.Combine(root, ".claude", "projects", "fixture"); Directory.CreateDirectory(folder);
            string path = Path.Combine(folder, "session.jsonl");
            string Record(string id) => Json(new { timestamp = DateTimeOffset.Now, type = "assistant", message = new { id, model = "fixture", usage = new { input_tokens = 100, output_tokens = 20 } } });
            await File.WriteAllTextAsync(path, Record("one") + "\n");
            using var monitor = new AgentMonitor(() => CancellationToken.None, root);
            var first = await monitor.ReadAsync(1, default); Assert.Equal(120, first.Providers.Single(p => p.Name == "Claude Code").Tokens);
            await File.AppendAllTextAsync(path, Record("two") + "\n");
            var second = await monitor.ReadAsync(1, default); Assert.Equal(240, second.Providers.Single(p => p.Name == "Claude Code").Tokens);
            using var stop = new CancellationTokenSource(); stop.Cancel(); await Assert.ThrowsAnyAsync<OperationCanceledException>(() => monitor.ReadAsync(1, stop.Token));
        }
        finally
        {
            string expected = Path.GetFullPath(Path.Combine(Path.GetTempPath(), "vnotch-agent-test-"));
            if (!Path.GetFullPath(root).StartsWith(expected, StringComparison.OrdinalIgnoreCase)) throw new IOException("Unexpected fixture cleanup path");
            Directory.Delete(root, true);
        }
    }
    [Fact]
    public void OversizedLogTailsAreMarkedPartialAndNeverParseAPartialFirstLine()
    {
        string path = Path.Combine(Path.GetTempPath(), "vnotch-agent-" + Guid.NewGuid().ToString("N") + ".jsonl");
        try
        {
            File.WriteAllText(path, new string('x', AgentLogReader.MaxBytes + 1000) + "\n" + Json(new { timestamp = Now, type = "assistant", message = new { id = "a", usage = new { input_tokens = 2, output_tokens = 3 } } }) + "\n");
            var log = AgentLogReader.Read(path, "Claude Code", Now); Assert.True(log.Partial); Assert.Equal(5, Assert.Single(log.Records).Total);
        }
        finally { File.Delete(path); }
    }
}
