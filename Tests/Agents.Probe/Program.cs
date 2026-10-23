// Explicit read-only diagnostic. No conversation content or account bodies are printed.
using System.Text.Json;
using VNotch.Services.Agents;
using var stop = new CancellationTokenSource(TimeSpan.FromSeconds(35));
using var monitor = new AgentMonitor(() => CancellationToken.None);
if (args.Contains("--accounts")) await monitor.RefreshAccountsAsync(stop.Token);
var snapshot = await monitor.ReadAsync(1, stop.Token);
Console.WriteLine(JsonSerializer.Serialize(snapshot.Providers.Select(p => new { Provider=p.Name, Records=p.Records.Count,
    Sessions=p.Sessions.Count, Partial=p.Partial, AccountStatus=p.Account.Status, QuotaWindows=p.Account.Windows.Count })));
