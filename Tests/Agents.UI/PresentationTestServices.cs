// Isolated presenter harness: replace logging/display preferences only, not navigation or transitions.
namespace VNotch.Services;
internal static class AnimationConfig { internal static int TargetFps => 60; }
internal static class RuntimeLog
{
    internal static void Log(string tag, string text) { }
    internal static void Warn(string tag, string text) { }
    internal static void Debug(string tag, Func<string> text) { }
    internal static void Error(string tag, string text) { }
}
