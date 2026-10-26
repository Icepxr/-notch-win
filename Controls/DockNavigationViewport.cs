using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;

namespace VNotch.Controls;

/// <summary>A bounded tab strip on side docks; the top strip keeps its authored layout.</summary>
public sealed class DockNavigationViewport : ScrollViewer
{
    public bool IsColumn { get; private set; }

    public DockNavigationViewport()
    {
        // A stretched ScrollViewer hit-tests its empty area too. Only the
        // tabs own input; the status corner behind this strip must stay usable.
        HorizontalAlignment = HorizontalAlignment.Left;
        HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled;
        VerticalScrollBarVisibility = ScrollBarVisibility.Disabled;
        CanContentScroll = false;
        Focusable = false;
        BorderThickness = new Thickness(0);
        Padding = new Thickness(0);
        ScrollChanged += (_, _) => UpdateFade();
        SizeChanged += (_, _) => UpdateFade();
    }

    public void SetColumnWidth(double width)
    {
        IsColumn = double.IsFinite(width) && width > 0;
        Width = IsColumn ? width : double.NaN;
        HorizontalScrollBarVisibility = IsColumn ? ScrollBarVisibility.Hidden : ScrollBarVisibility.Disabled;
        PanningMode = IsColumn ? PanningMode.HorizontalOnly : PanningMode.None;
        if (!IsColumn) ScrollToHorizontalOffset(0);
        UpdateFade();
    }

    protected override void OnPreviewMouseWheel(MouseWheelEventArgs e)
    {
        if (IsColumn && ScrollableWidth > .5)
        {
            ScrollToHorizontalOffset(HorizontalOffset - e.Delta / 120d * 52);
            e.Handled = true;
            return;
        }
        base.OnPreviewMouseWheel(e);
    }

    private void UpdateFade()
    {
        if (!IsColumn || ViewportWidth <= 0 || ScrollableWidth < .5)
        {
            OpacityMask = null;
            ToolTip = null;
            return;
        }
        double fade = Math.Min(.2, 12 / ViewportWidth);
        bool leading = HorizontalOffset > .5;
        bool trailing = HorizontalOffset < ScrollableWidth - .5;
        var mask = new LinearGradientBrush { StartPoint = new Point(0, .5), EndPoint = new Point(1, .5) };
        mask.GradientStops.Add(new GradientStop(leading ? Colors.Transparent : Colors.Black, 0));
        mask.GradientStops.Add(new GradientStop(Colors.Black, fade));
        mask.GradientStops.Add(new GradientStop(Colors.Black, 1 - fade));
        mask.GradientStops.Add(new GradientStop(trailing ? Colors.Transparent : Colors.Black, 1));
        mask.Freeze();
        OpacityMask = mask;
        ToolTip = "Scroll to browse tabs";
    }
}
