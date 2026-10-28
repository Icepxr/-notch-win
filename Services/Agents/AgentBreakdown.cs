// Local customization: derived only from the bounded, deduplicated local records.
namespace VNotch.Services.Agents;

internal sealed record AgentModelUsage(string Name, long Input, long Output, long Cached, int Responses)
{
    internal long Total => Input + Output;
}
internal sealed record AgentActivityBucket(DateTime Start, DateTime End, long Tokens, int Responses);
internal static class AgentBreakdown
{
    internal static IReadOnlyList<AgentModelUsage> Models(AgentProvider provider)
    {
        var models = new Dictionary<string, (long Input, long Output, long Cached, int Count)>(StringComparer.Ordinal);
        foreach (var record in provider.Records)
        {
            string name = string.IsNullOrWhiteSpace(record.Model) ? "Unspecified model" : record.Model;
            var totals = models.GetValueOrDefault(name);
            models[name] = (checked(totals.Input + record.Input), checked(totals.Output + record.Output), checked(totals.Cached + record.Cached), totals.Count + 1);
        }
        return models.Select(m => new AgentModelUsage(m.Key, m.Value.Input, m.Value.Output, m.Value.Cached, m.Value.Count))
            .OrderByDescending(m => m.Total).ThenBy(m => m.Name, StringComparer.Ordinal).ToArray();
    }

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
