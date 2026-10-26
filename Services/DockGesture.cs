// Local customization: when the notch stands down so it can be moved.
namespace VNotch.Services;

/// <summary>
/// Ctrl readies the collapsed pill; a press and movement begin the actual drag.
/// </summary>
public static class DockGesture
{
    /// <summary>
    /// Keep the pill collapsed while Ctrl is held or a drag/landing is active.
    /// </summary>
    public static bool SuppressesHover(bool dragging, bool modifierHeld) => dragging || modifierHeld;

    /// <summary>
    /// Whether the pill should say it can be picked up. The modifier alone is
    /// enough for a cursor, which costs nothing if the press never comes.
    /// </summary>
    public static bool OffersPickUp(bool dragging, bool modifierHeld) => dragging || modifierHeld;
}
