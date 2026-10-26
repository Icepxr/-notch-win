using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using VNotch.Controls;
using Xunit;

namespace VNotch.Tests;

public sealed class DockNavigationTests
{
    [Fact]
    public void EveryTabRemainsReachableInANarrowColumn() => SharedStaTestRunner.RunAsync(() =>
    {
        var strip = new StackPanel { Orientation = Orientation.Horizontal };
        for (int i = 0; i < 12; i++)
            strip.Children.Add(new Button { Width = 22, Height = 22, Margin = new Thickness(0, 0, 4, 0), Content = i });
        var viewport = new DockNavigationViewport { Content = strip };
        // A tiny explicit template avoids depending on desktop theme loading.
        var presenter = new FrameworkElementFactory(typeof(ScrollContentPresenter));
        presenter.Name = "PART_ScrollContentPresenter";
        viewport.Template = new ControlTemplate(typeof(ScrollViewer)) { VisualTree = presenter };
        viewport.SetColumnWidth(150);
        viewport.Measure(new Size(150, 32));
        viewport.Arrange(new Rect(0, 0, 150, 32));
        viewport.UpdateLayout();
        Assert.True(viewport.ScrollableWidth > 100);
        Assert.NotNull(viewport.OpacityMask);
        viewport.ScrollToRightEnd();
        viewport.UpdateLayout();
        Assert.True(viewport.HorizontalOffset > 100);
        var last = (FrameworkElement)strip.Children[^1];
        var bounds = last.TransformToAncestor(viewport).TransformBounds(new Rect(last.RenderSize));
        Assert.InRange(bounds.Right, 0, 150.5);
        viewport.SetColumnWidth(double.NaN);
        viewport.Measure(new Size(600, 32));
        viewport.Arrange(new Rect(0, 0, 600, 32));
        viewport.UpdateLayout();
        Assert.False(viewport.IsColumn);
        Assert.Null(viewport.OpacityMask);
        Assert.Equal(0, viewport.HorizontalOffset);
        return Task.CompletedTask;
    });
}
