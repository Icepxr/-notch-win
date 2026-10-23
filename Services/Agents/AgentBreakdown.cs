// Local customization: derived only from the bounded, deduplicated local records.
namespace VNotch.Services.Agents;

internal sealed record AgentModelUsage(string Name, long Input, long Output, long Cached, int Responses)
{
    internal long Total => Input + Output;
}
internal sealed record AgentActivityBucket(DateTime Start, DateTime End, long Tokens, int Responses);
internal static class AgentBreakdown
{
    internal static IReadOnlyList<AgentModelUsage> Models(AgentProvider provider) => provider.Records
        .GroupBy(r => string.IsNullOrWhiteSpace(r.Model) ? "Unspecified model" : r.Model)
        .Select(g => new AgentModelUsage(g.Key, g.Sum(r => r.Input), g.Sum(r => r.Output), g.Sum(r => r.Cached), g.Count()))
        .OrderByDescending(m => m.Total).ThenBy(m => m.Name, StringComparer.Ordinal).ToArray();

    internal static IReadOnlyList<AgentActivityBucket> Activity(AgentProvider provider, int days, DateTimeOffset now)
    {
        days = Math.Clamp(days, 1, 30);
        DateTime from = now.LocalDateTime.Date.AddDays(1 - days);
        var step = days == 1 ? TimeSpan.FromHours(2) : TimeSpan.FromDays(1);
        int count = days == 1 ? 12 : days;
        var tokens = new long[count]; var responses = new int[count];
        foreach (var record in provider.Records)
        {
            if (record.At > now) continue;
            int index = (int)Math.Floor((record.At.LocalDateTime - from).TotalSeconds / step.TotalSeconds);
            if (index < 0 || index >= count) continue;
            tokens[index] += record.Total; responses[index]++;
        }
        return Enumerable.Range(0, count).Select(i => new AgentActivityBucket(from + step * i, from + step * (i + 1), tokens[i], responses[i])).ToArray();
    }
}
