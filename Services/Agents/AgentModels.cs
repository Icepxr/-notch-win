// Local customization: local agent telemetry is independent of Spotlight AI chat.
using System.Text.Json;
using System.Text;

namespace VNotch.Services.Agents;

internal sealed record AgentWindow(string Name, double Used, DateTimeOffset? Reset, DateTimeOffset Observed, string Source)
{
    internal bool Expired(DateTimeOffset now) => Reset <= now;
    internal bool Stale(DateTimeOffset now) => now - Observed > TimeSpan.FromMinutes(5);
    internal double Remaining => Math.Clamp(100 - Used, 0, 100);
}
internal sealed record AgentAccount(string Status, IReadOnlyList<AgentWindow> Windows, DateTimeOffset Checked);
internal sealed record AgentRecord(string Id, DateTimeOffset At, string Model, long Input, long Output, long Cached)
{
    internal long Total => Input + Output;
}
internal sealed record AgentSession(string Provider, string Name, string Project, string State, DateTimeOffset Updated);
internal readonly record struct AgentUsageTotals(long Input, long Output, long Cached)
{
    internal long Total => Input + Output;
    internal static AgentUsageTotals Sum(IReadOnlyList<AgentRecord> records)
    {
        long input = 0, output = 0, cached = 0;
        foreach (var record in records)
        {
            input = checked(input + record.Input);
            output = checked(output + record.Output);
            cached = checked(cached + record.Cached);
        }
        return new(input, output, cached);
    }
}
internal sealed record AgentProvider(string Name, IReadOnlyList<AgentRecord> Records, IReadOnlyList<AgentSession> Sessions,
    AgentAccount Account, bool Partial)
{
    internal long Tokens => Records.Sum(r => r.Total);
    internal long Cached => Records.Sum(r => r.Cached);
    internal long Input => Records.Sum(r => r.Input);
    internal long Output => Records.Sum(r => r.Output);
}
internal sealed record AgentSnapshot(IReadOnlyList<AgentProvider> Providers, DateTimeOffset Updated);
internal interface IAgentMonitor : IDisposable
{
    Task<AgentSnapshot> ReadAsync(int days, CancellationToken cancellation);
    Task RefreshAccountsAsync(CancellationToken cancellation);
}

internal static class AgentJson
{
    internal static JsonElement Get(this JsonElement element, string key) => element.ValueKind == JsonValueKind.Object && element.TryGetProperty(key, out var value) ? value : default;
    internal static string Text(this JsonElement element, int limit = 100)
    {
        if (element.ValueKind != JsonValueKind.String || limit <= 0) return "";
        string text = element.GetString() ?? "";
        int length = Math.Min(text.Length, limit);
        for (int i = 0; i < length; i++)
        {
            if (!char.IsControl(text[i])) continue;
            var clean = new StringBuilder(length);
            foreach (char character in text)
            {
                if (char.IsControl(character)) continue;
                clean.Append(character);
                if (clean.Length == limit) break;
            }
            return clean.ToString();
        }
        // Most log metadata is already clean. Avoid a LINQ iterator, temporary
        // character array and second string for every field of every record.
        return length == text.Length ? text : text[..length];
    }
    internal static long Count(this JsonElement element) => element.ValueKind == JsonValueKind.Number && element.TryGetInt64(out long value) && value is >= 0 and <= 1_000_000_000_000 ? value : 0;
    internal static double? Percent(this JsonElement element) => element.ValueKind == JsonValueKind.Number && element.TryGetDouble(out double value) && double.IsFinite(value) ? Math.Clamp(value, 0, 100) : null;
    internal static DateTimeOffset? Time(this JsonElement element) => element.ValueKind == JsonValueKind.String && DateTimeOffset.TryParse(element.GetString(), out var time) ? time :
        element.ValueKind == JsonValueKind.Number && element.TryGetInt64(out long number) && number is > 0 and < 32_503_680_000_000
        ? (number > 32_503_680_000 ? DateTimeOffset.FromUnixTimeMilliseconds(number) : DateTimeOffset.FromUnixTimeSeconds(number)) : null;
    internal static IReadOnlyList<AgentWindow> CodexWindows(JsonElement limits, DateTimeOffset observed, string source)
    {
        var windows = new List<AgentWindow>();
        foreach (string key in new[] { "primary", "secondary" })
        {
            var item = limits.Get(key);
            double? used = item.Get("usedPercent").Percent() ?? item.Get("used_percent").Percent();
            if (used == null) continue;
            long minutes = item.Get("windowDurationMins").Count();
            if (minutes == 0) minutes = item.Get("window_minutes").Count();
            string name = minutes >= 10080 ? "Weekly" : minutes >= 60 ? $"{minutes / 60} hours" : minutes > 0 ? $"{minutes} min" : key == "primary" ? "Primary" : "Secondary";
            windows.Add(new(name, used.Value, item.Get("resetsAt").Time() ?? item.Get("resets_at").Time(), observed, source));
        }
        return windows;
    }
    internal static IReadOnlyList<AgentWindow> ClaudeWindows(JsonElement limits, DateTimeOffset observed)
    {
        var windows = new List<AgentWindow>();
        foreach (var (key, label) in new[] { ("five_hour", "5 hours"), ("seven_day", "Weekly"), ("seven_day_opus", "Weekly · Opus"), ("seven_day_sonnet", "Weekly · Sonnet") })
        {
            var item = limits.Get(key); double? used = item.Get("utilization").Percent();
            if (used != null) windows.Add(new(label, used.Value, item.Get("resets_at").Time(), observed, "Account"));
        }
        return windows;
    }
}
