// Local customization: which screen edge the notch is docked to.
namespace VNotch.Models;

/// <summary>
/// The screen edge the notch hangs from. <see cref="Top"/> is the original
/// behaviour; the side edges present the notch vertically.
/// </summary>
public enum NotchEdge
{
    Top = 0,
    Left = 1,
    Right = 2,
}
