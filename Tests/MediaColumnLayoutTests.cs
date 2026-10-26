using System.Windows;
using System.Windows.Controls;
using VNotch.Controls;
using Xunit;

namespace VNotch.Tests;

public sealed class MediaColumnLayoutTests
{
    [Fact]
    public void LongAndShortTitlesKeepTheirOwnWidthAndRestoreAfterDocking() => SharedStaTestRunner.RunAsync(() =>
    {
        using var view = new MediaPlaybackView();
        var title = (TextBlock)view.FindName("TrackTitle");
        var next = (TextBlock)view.FindName("TrackTitleNext");
        title.Text = "A much longer song title that needs to scroll inside the narrow side dock";
        next.Text = "Short title";
        view.ColumnWidth = 190;
        view.CentreInColumn = true;
        view.Measure(new Size(190, 160)); view.Arrange(new Rect(0, 0, 190, 160)); view.UpdateLayout();
        var outgoing = (Grid)view.FindName("TrackTitleLayer");
        var incoming = (Grid)view.FindName("TrackTitleNextLayer");
        Assert.True(outgoing.Width > 190, "The whole long title must be available to the marquee");
        Assert.InRange(incoming.Width, 189.5, 190.5);
        Assert.Equal(HorizontalAlignment.Left, outgoing.HorizontalAlignment);
        view.CentreInColumn = false;
        view.ColumnWidth = 340;
        view.Measure(new Size(340, 160)); view.Arrange(new Rect(0, 0, 340, 160)); view.UpdateLayout();
        Assert.True(double.IsNaN(outgoing.Width));
        Assert.True(double.IsNaN(incoming.Width));
        Assert.Equal(HorizontalAlignment.Stretch, outgoing.HorizontalAlignment);
        return Task.CompletedTask;
    });
}
