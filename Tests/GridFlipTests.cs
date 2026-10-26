// Local customization: transposing a page onto the vertical axis.
using System.Windows;
using System.Windows.Controls;
using VNotch.Models;
using VNotch.Services;
using Xunit;

namespace VNotch.Tests;

public class GridFlipTests
{
    /// <summary>The expanded media page: 1.48* cover, auto, 0.72* lyrics.</summary>
    private static Grid ThreeColumnPage()
    {
        var grid = new Grid();
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1.48, GridUnitType.Star) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(.72, GridUnitType.Star) });

        var status = new Border { Margin = new Thickness(0, 0, 5, 0) };
        Grid.SetColumn(status, 0);
        Grid.SetColumnSpan(status, 3);
        var cover = new Border { Margin = new Thickness(8, 2, 0, 0) };
        Grid.SetColumn(cover, 0);
        var lyrics = new Border { Margin = new Thickness(10, 5, 0, 0) };
        Grid.SetColumn(lyrics, 2);

        grid.Children.Add(status);
        grid.Children.Add(cover);
        grid.Children.Add(lyrics);
        return grid;
    }

    private static void OnUi(Action action) => SharedStaTestRunner.RunAsync(() =>
    {
        action();
        return Task.CompletedTask;
    });

    [Fact]
    public void ColumnWeightsBecomeRowWeights() => OnUi(() =>
    {
        var grid = ThreeColumnPage();

        GridFlip.SetVertical(grid, true);

        Assert.Empty(grid.ColumnDefinitions);
        Assert.Equal(3, grid.RowDefinitions.Count);
        Assert.Equal(new GridLength(1.48, GridUnitType.Star), grid.RowDefinitions[0].Height);
        Assert.Equal(GridLength.Auto, grid.RowDefinitions[1].Height);
        Assert.Equal(new GridLength(.72, GridUnitType.Star), grid.RowDefinitions[2].Height);
    });

    [Fact]
    public void EachChildKeepsItsPlaceInTheSequence() => OnUi(() =>
    {
        var grid = ThreeColumnPage();

        GridFlip.SetVertical(grid, true);

        Assert.Equal(0, Grid.GetRow(grid.Children[0]));
        Assert.Equal(3, Grid.GetRowSpan(grid.Children[0]));
        Assert.Equal(0, Grid.GetRow(grid.Children[1]));
        Assert.Equal(2, Grid.GetRow(grid.Children[2]));
        foreach (UIElement child in grid.Children) Assert.Equal(0, Grid.GetColumn(child));
    });

    [Fact]
    public void MarginsTurnWithTheLayout() => OnUi(() =>
    {
        var grid = ThreeColumnPage();

        GridFlip.SetVertical(grid, true);

        // A 10px gap to the left of the lyrics becomes a 10px gap above it.
        Assert.Equal(new Thickness(5, 10, 0, 0), ((FrameworkElement)grid.Children[2]).Margin);
    });

    [Fact]
    public void FlippingBackRestoresTheAuthoredLayoutExactly() => OnUi(() =>
    {
        var grid = ThreeColumnPage();
        var authored = grid.Children.OfType<FrameworkElement>()
            .Select(c => (Grid.GetColumn(c), Grid.GetColumnSpan(c), c.Margin)).ToArray();

        GridFlip.SetVertical(grid, true);
        GridFlip.SetVertical(grid, false);

        Assert.Equal(3, grid.ColumnDefinitions.Count);
        Assert.Empty(grid.RowDefinitions);
        Assert.Equal(new GridLength(1.48, GridUnitType.Star), grid.ColumnDefinitions[0].Width);
        var restored = grid.Children.OfType<FrameworkElement>()
            .Select(c => (Grid.GetColumn(c), Grid.GetColumnSpan(c), c.Margin)).ToArray();
        Assert.Equal(authored, restored);
    });

    [Fact]
    public void ManyChangesOfEdgeDoNotAccumulate() => OnUi(() =>
    {
        var grid = ThreeColumnPage();
        var authored = grid.Children.OfType<FrameworkElement>().Select(c => c.Margin).ToArray();

        for (int i = 0; i < 6; i++)
        {
            GridFlip.SetVertical(grid, true);
            GridFlip.SetVertical(grid, false);
        }

        Assert.Equal(authored, grid.Children.OfType<FrameworkElement>().Select(c => c.Margin).ToArray());
        Assert.Equal(3, grid.ColumnDefinitions.Count);
    });

    [Fact]
    public void AskingForTheLayoutItAlreadyHasChangesNothing() => OnUi(() =>
    {
        var grid = ThreeColumnPage();

        Assert.False(GridFlip.SetVertical(grid, false));
        Assert.True(GridFlip.SetVertical(grid, true));
        Assert.False(GridFlip.SetVertical(grid, true));
    });

    [Fact]
    public void ARowLayoutTurnsIntoColumnsToo() => OnUi(() =>
    {
        var grid = new Grid();
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        var child = new Border();
        Grid.SetRow(child, 1);
        grid.Children.Add(child);

        GridFlip.SetVertical(grid, true);

        // The inner stack of a card runs the other way once the page turns.
        Assert.Equal(2, grid.ColumnDefinitions.Count);
        Assert.Equal(1, Grid.GetColumn(child));
        Assert.Equal(0, Grid.GetRow(child));
    });

    [Fact]
    public void ANullGridIsNotAnError() => OnUi(() => Assert.False(GridFlip.SetVertical(null, true)));
}

public class VerticalMetricsTests
{
    private static readonly Rect Display = new(0, 0, 1920, 1080);
    private const double DefaultPill = 230;

    [Fact]
    public void TheColumnIsMeasuredInThePillTheUserChose()
    {
        Assert.Equal(DefaultPill * NotchDock.ColumnDepthInPills, NotchDock.Depth(DefaultPill, Display));
    }

    [Fact]
    public void AWiderNotchGivesAWiderColumn()
    {
        // Nothing here is fixed to one notch size: double the pill, double the
        // column, so changing the setting changes the pages with it.
        Assert.Equal(2 * NotchDock.Depth(200, Display), NotchDock.Depth(400, Display), 3);
    }

    [Fact]
    public void ThePageNeverTakesOverMoreThanAThirdOfTheDisplay()
    {
        // 750/3 = 250, short of the 287.5 the pill would otherwise ask for.
        var narrow = new Rect(0, 0, 750, 800);

        Assert.Equal(250, NotchDock.Depth(DefaultPill, narrow));
    }

    [Fact]
    public void TheColumnIsNarrowerThanTheNotchIsWide()
    {
        // A panel beside what you are working on, not a second window.
        Assert.True(NotchDock.Depth(DefaultPill, Display) < DefaultPill * 1.5,
            "the column has grown as wide as the notch it came from");
    }

    [Fact]
    public void TheCoverLeavesAMarginInsideItsColumn()
    {
        Assert.InRange(NotchDock.CoverShareOfColumn, .5, .9);
    }

    [Fact]
    public void APillWiderThanAThirdOfTheDisplayStillFitsItsOwnColumn()
    {
        var narrow = new Rect(0, 0, 600, 800);

        Assert.Equal(DefaultPill, NotchDock.Depth(DefaultPill, narrow));
    }

    [Fact]
    public void APageNeedsDownTheScreenWhatItNeededAcrossIt()
    {
        Assert.Equal(480, NotchDock.Length(480, DefaultPill, Display));
        Assert.Equal(600, NotchDock.Length(600, DefaultPill, Display));
    }

    [Fact]
    public void ALongPageIsCutToWhatTheScreenAllows()
    {
        Assert.Equal(1080 * NotchDock.MaximumLengthShare, NotchDock.Length(1600, DefaultPill, Display), 3);
    }

    [Fact]
    public void APageNeverRunsTheWholeEdge()
    {
        // A panel beside your work, not a second screen.
        Assert.True(NotchDock.LongestLength(Display) < Display.Height * .75,
            "a page may take three quarters of the display down its edge");
    }

    [Fact]
    public void APageIsNeverShorterThanThePillItGrewFrom()
    {
        Assert.Equal(DefaultPill, NotchDock.Length(40, DefaultPill, Display));
    }

    [Fact]
    public void TheTopEdgeKeepsEveryPageExactlyAsAuthored()
    {
        Assert.Equal(new Size(480, 147), NotchDock.ViewSize(NotchEdge.Top, 480, 147, DefaultPill, Display));
    }

    [Fact]
    public void ASideEdgeTurnsAWidePageIntoATallColumn()
    {
        var size = NotchDock.ViewSize(NotchEdge.Left, 480, 147, DefaultPill, Display);

        Assert.Equal(NotchDock.Depth(DefaultPill, Display), size.Width);
        Assert.Equal(480, size.Height);
        Assert.Equal(size, NotchDock.ViewSize(NotchEdge.Right, 480, 147, DefaultPill, Display));
    }
}
