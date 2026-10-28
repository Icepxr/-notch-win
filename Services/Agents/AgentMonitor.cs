// Local customization: polling is owned by the visible Agent tab, never app startup.
using System.IO;

namespace VNotch.Services.Agents;

internal sealed class AgentMonitor(Func<CancellationToken> permission, string? home = null) : IAgentMonitor
{
    private readonly string _home = home ?? Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    private readonly bool _useEnvironment = home == null;
    private readonly Dictionary<string, (long Length, DateTime Write, AgentLog Log)> _cache = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, AgentAccount> _accounts = new();
    private readonly SemaphoreSlim _gate = new(1);
    private readonly CancellationTokenSource _stop = new();
    private DateTimeOffset _lastCheck = DateTimeOffset.MinValue;
    public async Task<AgentSnapshot> ReadAsync(int days, CancellationToken cancellation)
    {
        using var lifetime = CancellationTokenSource.CreateLinkedTokenSource(cancellation, _stop.Token);
        await _gate.WaitAsync(lifetime.Token);
        try { return await Task.Run(() => Read(Math.Clamp(days, 1, 30), lifetime.Token), lifetime.Token); }
        finally { _gate.Release(); }
    }
    private AgentSnapshot Read(int days, CancellationToken cancellation)
    {
        var now = DateTimeOffset.Now; var from = new DateTimeOffset(DateTime.Today.AddDays(1 - days));
        var providers = new List<AgentProvider>(); var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        string codexRoot = (_useEnvironment ? Environment.GetEnvironmentVariable("CODEX_HOME") : null) ?? Path.Combine(_home, ".codex");
        string claudeRoot = (_useEnvironment ? Environment.GetEnvironmentVariable("CLAUDE_CONFIG_DIR") : null) ?? Path.Combine(_home, ".claude");
        foreach (string provider in new[] { "Codex", "Claude Code" })
        {
            cancellation.ThrowIfCancellationRequested();
            string root = Path.Combine(provider == "Codex" ? codexRoot : claudeRoot, provider == "Codex" ? "sessions" : "projects");
            var files = RecentFiles(Files(root, "*.jsonl"), from.UtcDateTime, 65, cancellation);
            bool partial = files.Count > 64; var records = new List<AgentRecord>(); var sessions = new List<AgentSession>(); AgentAccount? logged = null;
            foreach (var file in files.Take(64))
            {
                cancellation.ThrowIfCancellationRequested(); seen.Add(file.FullName);
                try
                {
                    if (!_cache.TryGetValue(file.FullName, out var cached) || cached.Length != file.Length || cached.Write != file.LastWriteTimeUtc)
                    { cached = (file.Length, file.LastWriteTimeUtc, AgentLogReader.Read(file.FullName, provider, now)); _cache[file.FullName] = cached; }
                    var log = cached.Log; partial |= log.Partial;
                    records.AddRange(log.Records.Where(r => r.At >= from && r.At <= now));
                    if (log.Account is { } account && (logged == null || account.Checked > logged.Checked)) logged = account;
                    if (log.Recent is { } session && session.Updated >= from) sessions.Add(session with { State = now - session.Updated > TimeSpan.FromMinutes(2) ? "Recent" : session.State });
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { partial = true; }
            }
            if (provider != "Codex")
            {
                var live = new List<AgentSession>();
                foreach (var file in Files(Path.Combine(claudeRoot, "sessions"), "*.json", false).Take(64))
                {
                    cancellation.ThrowIfCancellationRequested();
                    try { if (file.Length <= 65536 && AgentLogReader.ClaudeSession(File.ReadAllText(file.FullName), now) is { } session) live.Add(session); }
                    catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { partial = true; }
                }
                sessions = live.Concat(sessions.Where(s => live.All(l => l.Project != s.Project))).ToList();
            }
            var reading = _accounts.GetValueOrDefault(provider);
            if (reading == null || logged?.Checked > reading.Checked) reading = logged ?? reading;
            providers.Add(new(provider, records.OrderByDescending(r => r.At).ToArray(), sessions.OrderBy(s => s.State == "Working" ? 0 : s.State == "Waiting" ? 1 : 2).ThenByDescending(s => s.Updated).Take(16).ToArray(),
                reading ?? new("Refresh limits to check your account", [], now), partial));
        }
        foreach (string key in _cache.Keys.Where(key => !seen.Contains(key)).ToArray()) _cache.Remove(key);
        return new(providers, now);
    }
    internal static IReadOnlyList<FileInfo> RecentFiles(IEnumerable<FileInfo> files, DateTime fromUtc, int limit, CancellationToken cancellation)
    {
        if (limit <= 0) return [];
        // Keep only the newest bounded candidates, preserving enumeration order
        // for equal timestamps. Never retain thousands of older FileInfo objects.
        var newest = new PriorityQueue<FileInfo, (DateTime Write, long Order)>();
        long order = 0;
        foreach (var file in files)
        {
            cancellation.ThrowIfCancellationRequested();
            DateTime write = file.LastWriteTimeUtc;
            long sequence = order++;
            if (write < fromUtc) continue;
            if (newest.Count < limit) newest.Enqueue(file, (write, -sequence));
            else newest.EnqueueDequeue(file, (write, -sequence));
        }
        return newest.UnorderedItems.OrderByDescending(item => item.Priority.Write).ThenByDescending(item => item.Priority.Order)
            .Select(item => item.Element).ToArray();
    }

    private static IEnumerable<FileInfo> Files(string root, string pattern, bool recursive = true)
    {
        IEnumerator<FileInfo> iterator;
        try
        {
            if (!Directory.Exists(root) || (File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0) yield break;
            iterator = new DirectoryInfo(root).EnumerateFiles(pattern, new EnumerationOptions { RecurseSubdirectories = recursive, MaxRecursionDepth = 6,
                IgnoreInaccessible = true, AttributesToSkip = FileAttributes.ReparsePoint }).GetEnumerator();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { yield break; }
        using (iterator)
        {
            for (int i = 0; i < 10000; i++)
            {
                bool moved;
                try { moved = iterator.MoveNext(); }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { yield break; }
                if (!moved) yield break;
                yield return iterator.Current;
            }
        }
    }
    public async Task RefreshAccountsAsync(CancellationToken cancellation)
    {
        using var lifetime = CancellationTokenSource.CreateLinkedTokenSource(cancellation, _stop.Token);
        await _gate.WaitAsync(lifetime.Token);
        try
        {
            if (DateTimeOffset.Now - _lastCheck < TimeSpan.FromSeconds(30)) return;
            _lastCheck = DateTimeOffset.Now;
            // Keep subprocess cleanup independent of the WPF dispatcher during shutdown.
            var readings = await Task.WhenAll(new[] { "Codex", "Claude Code" }.Select(provider => Task.Run(async () =>
                (provider, account: await AgentAccounts.ReadAsync(provider, permission, lifetime.Token)), lifetime.Token))).ConfigureAwait(false);
            foreach (var (provider, account) in readings) _accounts[provider] = account;
        }
        finally { _gate.Release(); }
    }
    public void Dispose() { if (!_stop.IsCancellationRequested) _stop.Cancel(); }
}
