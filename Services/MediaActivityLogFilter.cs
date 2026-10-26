using VNotch.Models;

namespace VNotch.Services;

// Position heartbeats are not activity changes. Keep one bounded state stamp,
// so normal logs describe playback changes rather than writing every poll.
internal sealed class MediaActivityLogFilter
{
    private readonly object _gate = new();
    private (string? Track, string? Artist, string? Source, string? App, bool Playing, bool Active)? _last;

    internal bool ShouldLog(MediaInfo info)
    {
        var next = (info.CurrentTrack, info.CurrentArtist, info.MediaSource, info.SourceAppId, info.IsPlaying, info.IsAnyMediaPlaying);
        lock (_gate)
        {
            if (_last == next) return false;
            _last = next;
            return true;
        }
    }
}
