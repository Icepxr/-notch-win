using System.Windows;
using System.Windows.Media.Animation;

namespace VNotch.Services;

// Shell geometry has one owner; artwork only dissolves at its resting anchor.
internal static class NotchRevealMotion
{
    internal static readonly Duration Open = new(TimeSpan.FromMilliseconds(360));
    internal static readonly Duration Close = new(TimeSpan.FromMilliseconds(260));
    internal static readonly Duration Enter = new(TimeSpan.FromMilliseconds(220));
    internal static readonly Duration Exit = new(TimeSpan.FromMilliseconds(100));
    internal static readonly TimeSpan EnterDelay = TimeSpan.FromMilliseconds(70);
    internal static readonly TimeSpan CompactDelay = TimeSpan.FromMilliseconds(150);
    internal static readonly Duration CompactEnter = new(TimeSpan.FromMilliseconds(110));
    internal static readonly CubicEase Ease = CreateEase();

    private static CubicEase CreateEase()
    {
        var ease = new CubicEase { EasingMode = EasingMode.EaseOut };
        ease.Freeze();
        return ease;
    }
}
