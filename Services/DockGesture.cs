// Local customization: when the notch stands down so it can be moved.
namespace VNotch.Services;

/// <summary>
/// The move gesture is the modifier <em>and</em> a press on the pill. The
/// modifier on its own is not a move: Ctrl is held for copy, paste and tab
/// switching all day, and a notch that stops opening whenever it is down is a
/// notch that stops opening.
/// </summary>
public static class DockGesture
{
    /// <summary>
    /// Whether hover expansion should stand aside. Only a move already under
    /// way counts, so approaching the notch with the modifier held opens it as
    /// it always did.
    /// </summary>
    public static bool SuppressesHover(bool dragging, bool modifierHeld) => dragging;

    /// <summary>
    /// Whether the pill should say it can be picked up. The modifier alone is
    /// enough for a cursor, which costs nothing if the press never comes.
    /// </summary>
    public static bool OffersPickUp(bool dragging, bool modifierHeld) => dragging || modifierHeld;
}
