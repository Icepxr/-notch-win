// Local customization: what a list looks like across the top edge and down a
// side. Kept apart from the control so the one property that matters - that
// coming back to the top edge restores exactly what was authored - is a thing
// tests can check without building the tray.
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;

namespace VNotch.Services;

public static class ColumnLayout
{
    /// <param name="Panel">which way the items run</param>
    /// <param name="HorizontalScroll">the bar along the items' axis, or Disabled</param>
    /// <param name="CardWidth">how wide one item is</param>
    /// <param name="Spacing">the gap around an item, on the axis the list runs</param>
    /// <param name="HeaderBand">the height of the band above the list</param>
    /// <param name="ReserveNavigationColumn">
    /// whether the header keeps a column clear for the navigation tabs, or a
    /// band above them instead
    /// </param>
    public readonly record struct Layout(
        Orientation Panel,
        ScrollBarVisibility HorizontalScroll,
        ScrollBarVisibility VerticalScroll,
        double CardWidth,
        Thickness Spacing,
        GridLength HeaderBand,
        bool ReserveNavigationColumn);

    /// <summary>
    /// The layout for one orientation. Everything the side edge changes is
    /// derived from what the page was authored with, so asking for the
    /// horizontal layout always gives those values back unchanged.
    /// </summary>
    /// <param name="columnWidth">the room the list has across, on a side edge</param>
    /// <param name="listMargin">what the list keeps either side of its items</param>
    /// <param name="clearance">how far down the navigation row reaches</param>
    public static Layout For(bool vertical, double columnWidth, double listMargin, double clearance,
        double authoredCardWidth, double authoredGap, GridLength authoredBand)
    {
        if (!vertical)
        {
            return new Layout(
                Orientation.Horizontal,
                ScrollBarVisibility.Hidden,
                ScrollBarVisibility.Disabled,
                authoredCardWidth,
                new Thickness(authoredGap, 0, authoredGap, 0),
                authoredBand,
                ReserveNavigationColumn: true);
        }

        double room = columnWidth - listMargin;
        return new Layout(
            Orientation.Vertical,
            ScrollBarVisibility.Disabled,
            // A column holds a handful of cards at a time, so the rest have to
            // be reachable - and a bar you can see and drag is the way to say
            // there are more.
            ScrollBarVisibility.Auto,
            room > 0 ? room : authoredCardWidth,
            new Thickness(0, authoredGap, 0, authoredGap),
            // A band of a fixed height has to lengthen to clear the navigation;
            // one that sizes itself already will.
            authoredBand.IsAbsolute
                ? new GridLength(authoredBand.Value + Math.Max(0, clearance))
                : authoredBand,
            ReserveNavigationColumn: false);
    }
}
