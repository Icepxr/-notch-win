// Local customization: turn a layout that runs across into one that runs down.
// A page docked to a side edge is the same content in the same order, read top
// to bottom instead of left to right, so the pages are transposed rather than
// authored a second time.
using System.Windows;
using System.Windows.Controls;

namespace VNotch.Services;

public static class GridFlip
{
    /// <summary>
    /// What the grid looked like before it was ever flipped. Kept on the grid
    /// itself so flipping back restores the authored layout exactly, however
    /// many times the notch changes edge.
    /// </summary>
    private sealed record Original(
        GridLength[] Columns,
        GridLength[] Rows,
        (int Column, int ColumnSpan, int Row, int RowSpan, Thickness Margin)[] Children);

    private static readonly DependencyProperty OriginalProperty =
        DependencyProperty.RegisterAttached("Original", typeof(Original), typeof(Grid));

    /// <summary>
    /// Lay <paramref name="grid"/> out down the screen instead of across it,
    /// or put it back. Column weights become row weights, each child keeps its
    /// place in the sequence, and margins turn with it so the spacing between
    /// items is the spacing the page was designed with.
    /// </summary>
    /// <returns>true when the grid changed</returns>
    public static bool SetVertical(Grid? grid, bool vertical)
    {
        if (grid == null) return false;

        var original = Capture(grid);
        if (IsVertical(grid) == vertical) return false;

        grid.ColumnDefinitions.Clear();
        grid.RowDefinitions.Clear();

        if (vertical)
        {
            // A column that was 1.48* of the width becomes 1.48* of the height.
            foreach (var width in original.Columns) grid.RowDefinitions.Add(new RowDefinition { Height = width });
            foreach (var height in original.Rows) grid.ColumnDefinitions.Add(new ColumnDefinition { Width = height });
        }
        else
        {
            foreach (var width in original.Columns) grid.ColumnDefinitions.Add(new ColumnDefinition { Width = width });
            foreach (var height in original.Rows) grid.RowDefinitions.Add(new RowDefinition { Height = height });
        }

        for (int i = 0; i < grid.Children.Count && i < original.Children.Length; i++)
        {
            if (grid.Children[i] is not FrameworkElement child) continue;
            var placed = original.Children[i];

            Grid.SetColumn(child, vertical ? placed.Row : placed.Column);
            Grid.SetColumnSpan(child, vertical ? placed.RowSpan : placed.ColumnSpan);
            Grid.SetRow(child, vertical ? placed.Column : placed.Row);
            Grid.SetRowSpan(child, vertical ? placed.ColumnSpan : placed.RowSpan);
            child.Margin = vertical ? Transpose(placed.Margin) : placed.Margin;
        }

        SetIsVertical(grid, vertical);
        return true;
    }

    /// <summary>A margin turned through the same quarter turn as the layout.</summary>
    public static Thickness Transpose(Thickness margin)
        => new(margin.Top, margin.Left, margin.Bottom, margin.Right);

    private static Original Capture(Grid grid)
    {
        if (grid.GetValue(OriginalProperty) is Original kept) return kept;

        var original = new Original(
            grid.ColumnDefinitions.Select(c => c.Width).ToArray(),
            grid.RowDefinitions.Select(r => r.Height).ToArray(),
            grid.Children.OfType<FrameworkElement>()
                .Select(c => (Grid.GetColumn(c), Grid.GetColumnSpan(c), Grid.GetRow(c), Grid.GetRowSpan(c), c.Margin))
                .ToArray());
        grid.SetValue(OriginalProperty, original);
        return original;
    }

    private static readonly DependencyProperty IsVerticalProperty =
        DependencyProperty.RegisterAttached("IsVertical", typeof(bool), typeof(Grid));

    public static bool IsVertical(Grid grid) => grid.GetValue(IsVerticalProperty) is true;

    private static void SetIsVertical(Grid grid, bool vertical) => grid.SetValue(IsVerticalProperty, vertical);
}
