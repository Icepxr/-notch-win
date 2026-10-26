// Local customization: whether a window picked out as a media source may be
// brought forward, and how. Kept on its own so it can be checked without
// standing up the whole activator.
namespace VNotch.Services;

/// <summary>What may be done with a window that was matched to the media.</summary>
public enum WindowReveal
{
    /// <summary>Leave it alone: it is hidden on purpose.</summary>
    Refuse,
    /// <summary>Minimised, so put it back up.</summary>
    Restore,
    /// <summary>Already on screen, so only bring it forward.</summary>
    Raise,
}

public static class WindowRevealPolicy
{
    /// <summary>
    /// A window that is hidden rather than minimised is hidden deliberately.
    /// Chrome keeps such windows for its background host, and showing one puts
    /// an empty ghost on screen that the taskbar then opens in place of a real
    /// browser window - which looks, from the outside, like Chrome refusing to
    /// open at all.
    /// </summary>
    public static WindowReveal For(bool isVisible, bool isIconic)
    {
        if (isIconic) return WindowReveal.Restore;
        return isVisible ? WindowReveal.Raise : WindowReveal.Refuse;
    }
}
