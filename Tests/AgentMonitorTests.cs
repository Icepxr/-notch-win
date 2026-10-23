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
    public void ClaudeEmptyUsageDoesNotIncorrectlyClaimTheUserIsSignedOut()
    {
        var available = AgentAccounts.ParseClaude(Node(new { rate_limits_available = true, rate_limits = (object?)null }), Now);
        Assert.Empty(available.Windows); Assert.Contains("network", available.Status); Assert.DoesNotContain("sign", available.Status);
        var unavailable = AgentAccounts.ParseClaude(Node(new { rate_limits_available = false }), Now);
        Assert.Contains("Subscription", unavailable.Status);
        Assert.Empty(AgentAccounts.ParseClaude(Node(new { rate_limits_available = false, rate_limits = new { five_hour = new { utilization = 30 } } }), Now).Windows);
        var valid = AgentAccounts.ParseClaude(Node(new { rate_limits_available = true, rate_limits = new { five_hour = new { utilization = 0, resets_at = Now.AddHours(1) }, seven_day = new { utilization = 42.5, resets_at = Now.AddDays(3) } } }), Now);
        Assert.Equal(new[] { "5 hours", "Weekly" }, valid.Windows.Select(w => w.Name));
        Assert.Equal(100, valid.Windows[0].Remaining); Assert.Equal(57.5, valid.Windows[1].Remaining);
    }
    [Fact]
    public void UsageEnvironmentDoesNotInjectTheFlagThatSuppressesClaudeLimitsAndPreservesUserOptOut()
    {
        string path = Path.Combine(Path.GetTempPath(), "vnotch-env-" + Guid.NewGuid().ToString("N") + ".json");
        try
        {
            var start = new System.Diagnostics.ProcessStartInfo();
            foreach (string key in new[] { "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "HTTPS_PROXY", "UNRELATED_SECRET" }) start.Environment.Remove(key);
            File.WriteAllText(path, "{}"); AgentAccounts.ConfigureClaudeEnvironment(start, path);
            Assert.False(start.Environment.ContainsKey("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"));
            Assert.Equal("1", start.Environment["DISABLE_TELEMETRY"]);
            File.WriteAllText(path, Json(new { env = new { CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1", HTTPS_PROXY = "http://fixture.invalid:8080", UNRELATED_SECRET = "must-not-load" } }));
            AgentAccounts.ConfigureClaudeEnvironment(start, path);
            Assert.Equal("1", start.Environment["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"]);
            Assert.Equal("http://fixture.invalid:8080", start.Environment["HTTPS_PROXY"]);
            Assert.False(start.Environment.ContainsKey("UNRELATED_SECRET"));
            start.Environment["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"] = "custom-explicit-value";
            AgentAccounts.ConfigureClaudeEnvironment(start, path);
            Assert.Equal("custom-explicit-value", start.Environment["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"]);
        }
        finally { File.Delete(path); }
    }
    [Fact]
    public void ConsoleSelectionRejectsDesktopClaudeEvenWhenItsFilenameMatches()
    {
        string path = Path.Combine(Path.GetTempPath(), "vnotch-pe-" + Guid.NewGuid().ToString("N") + ".exe");
        try
        {
            var bytes = new byte[256];
            BitConverter.GetBytes((ushort)0x5a4d).CopyTo(bytes, 0); BitConverter.GetBytes(64).CopyTo(bytes, 60);
            BitConverter.GetBytes(0x00004550).CopyTo(bytes, 64); BitConverter.GetBytes((ushort)0x20b).CopyTo(bytes, 88);
            BitConverter.GetBytes((ushort)2).CopyTo(bytes, 156); File.WriteAllBytes(path, bytes);
            Assert.False(AgentAccounts.IsConsoleExecutable(path));
            BitConverter.GetBytes((ushort)3).CopyTo(bytes, 156); File.WriteAllBytes(path, bytes);
            Assert.True(AgentAccounts.IsConsoleExecutable(path));
            File.WriteAllText(path, "invalid"); Assert.False(AgentAccounts.IsConsoleExecutable(path));
        }
        finally { File.Delete(path); }
    }
    [Fact]
    public void BreakdownKeepsCachedTokensInsideInputAndSeparatesModelsAndLocalCalendarBuckets()
    {
        var local = new DateTimeOffset(DateTime.Today.AddHours(12));
        var provider = new AgentProvider("Claude Code", [new("1", local, "alpha", 100, 20, 80), new("2", local.AddHours(-1), "beta", 50, 10, 30),
            new("3", local.AddDays(-1), "alpha", 1000, 200, 900), new("4", local, "", 10, 0, 0)], [], new("", [], local), false);
        var models = AgentBreakdown.Models(provider);
        Assert.Equal("alpha", models[0].Name); Assert.Equal(1320, models[0].Total); Assert.Equal(980, models[0].Cached);
        Assert.Contains(models, m => m.Name == "Unspecified model");
        var today = AgentBreakdown.Activity(provider, 1, local);
        Assert.Equal(12, today.Count); Assert.Equal(190, today.Sum(b => b.Tokens)); Assert.Equal(3, today.Sum(b => b.Responses));
        var week = AgentBreakdown.Activity(provider, 7, local);
        Assert.Equal(7, week.Count); Assert.Equal(1200, week[^2].Tokens); Assert.Equal(190, week[^1].Tokens);
        Assert.Equal(30, AgentBreakdown.Activity(provider, 30, local).Count);
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
