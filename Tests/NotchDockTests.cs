// Local customization: placement rules for the docked notch.
using System.Windows;
using VNotch.Models;
using VNotch.Services;
using Xunit;

namespace VNotch.Tests;

public class NotchDockTests
{
    private static readonly Rect Primary = new(0, 0, 2560, 1440);

    [Fact]
    public void TopEdgeKeepsTheCenteredPlacementItAlreadyHad()
    {
        // The same numbers OverlayWindowControllerTests pins for the startup host:
        // a 720pt surface plus the 96pt slack, centred on a 2560px screen at 150%.
        var bounds = NotchDock.HostBounds(NotchEdge.Top, Primary,
            alongEdge: 720, awayFromEdge: 120, scale: 1.5);

        Assert.Equal((668, 0, 1224, 300), bounds);
    }

    [Fact]
    public void ASideDockTurnsTheSurfaceOnItsEnd()
    {
        var left = NotchDock.HostBounds(NotchEdge.Left, Primary,
            alongEdge: 560, awayFromEdge: 480, scale: 1);

        // 480 + 80 across, 560 + 96 along, vertically centred, flush left.
        Assert.Equal((0, 392, 560, 656), left);
    }

    [Fact]
    public void TheRightDockSitsFlushAgainstTheOppositeEdge()
    {
        var right = NotchDock.HostBounds(NotchEdge.Right, Primary, 560, 480, 1);

        Assert.Equal(2560 - 560, right.X);
        Assert.Equal(392, right.Y);
    }

    [Fact]
    public void BothSideEdgesCentreTheNotchOnTheSameLine()
    {
        var left = NotchDock.HostBounds(NotchEdge.Left, Primary, 560, 480, 1);
        var right = NotchDock.HostBounds(NotchEdge.Right, Primary, 560, 480, 1);

        Assert.Equal(left.Y, right.Y);
        Assert.Equal(Primary.Height / 2, left.Y + left.Height / 2.0);
    }

    [Fact]
    public void ASecondMonitorLeftOfTheFirstDocksToItsOwnEdge()
    {
        var secondary = new Rect(-1920, 0, 1920, 1080);

        var left = NotchDock.HostBounds(NotchEdge.Left, secondary, 560, 480, 1);
        var right = NotchDock.HostBounds(NotchEdge.Right, secondary, 560, 480, 1);

        Assert.Equal(-1920, left.X);
        Assert.Equal(-1920 + 1920 - 560, right.X);
    }

    [Fact]
    public void AHostTallerThanTheScreenCentresInsteadOfHangingOffOneEnd()
    {
        var shortScreen = new Rect(0, 0, 1280, 400);

        var bounds = NotchDock.HostBounds(NotchEdge.Left, shortScreen,
            alongEdge: 560, awayFromEdge: 480, scale: 1);

        Assert.Equal(656, bounds.Height);
        Assert.Equal((400 - 656) / 2, bounds.Y);
    }

    [Fact]
    public void TheShellTurnsOnItsEndOnASideEdge()
    {
        Assert.Equal(new Size(230, 34), NotchDock.Rotate(NotchEdge.Top, 230, 34));
        Assert.Equal(new Size(34, 230), NotchDock.Rotate(NotchEdge.Left, 230, 34));
        Assert.Equal(new Size(34, 230), NotchDock.Rotate(NotchEdge.Right, 230, 34));
    }

    [Fact]
    public void TheShellIsPinnedToItsEdgeAndCentredAlongIt()
    {
        var host = new Rect(0, 100, 560, 656);
        var shell = new Size(34, 230);

        var left = NotchDock.NotchRect(NotchEdge.Left, host, shell);
        var right = NotchDock.NotchRect(NotchEdge.Right, host, shell);

        Assert.Equal(0, left.Left);
        Assert.Equal(560 - 34, right.Left);
        Assert.Equal(100 + (656 - 230) / 2, left.Top);
        Assert.Equal(left.Top, right.Top);
    }

    [Fact]
    public void OnlyTheCornersFacingTheDesktopAreRounded()
    {
        Assert.Equal(new CornerRadius(0, 0, 8, 8), NotchDock.Radius(NotchEdge.Top, 8));
        Assert.Equal(new CornerRadius(0, 8, 8, 0), NotchDock.Radius(NotchEdge.Left, 8));
        Assert.Equal(new CornerRadius(8, 0, 0, 8), NotchDock.Radius(NotchEdge.Right, 8));
    }

    [Fact]
    public void TheShellIsAlignedToItsOwnEdge()
    {
        Assert.Equal((HorizontalAlignment.Center, VerticalAlignment.Top), NotchDock.Alignment(NotchEdge.Top));
        Assert.Equal((HorizontalAlignment.Left, VerticalAlignment.Center), NotchDock.Alignment(NotchEdge.Left));
        Assert.Equal((HorizontalAlignment.Right, VerticalAlignment.Center), NotchDock.Alignment(NotchEdge.Right));
    }

    [Fact]
    public void TheRevealZoneNeverReachesThroughTheScreenEdge()
    {
        var notch = new Rect(0, 500, 34, 230);

        var zone = NotchDock.HoverZone(NotchEdge.Left, notch, 60);

        Assert.Equal(notch.Left, zone.Left);
        Assert.Equal(notch.Right + 60, zone.Right);
        Assert.Equal(notch.Top - 60, zone.Top);
        Assert.Equal(notch.Bottom + 60, zone.Bottom);
    }

    [Fact]
    public void TheRevealZoneOnTheRightGrowsInwardOnly()
    {
        var notch = new Rect(2526, 500, 34, 230);

        var zone = NotchDock.HoverZone(NotchEdge.Right, notch, 60);

        Assert.Equal(notch.Right, zone.Right);
        Assert.Equal(notch.Left - 60, zone.Left);
    }

    [Fact]
    public void TheTopRevealZoneIsUnchanged()
    {
        var notch = new Rect(1165, 0, 230, 34);

        var zone = NotchDock.HoverZone(NotchEdge.Top, notch, 60);

        Assert.Equal(new Rect(1105, 0, 350, 94), zone);
    }

    [Fact]
    public void ADragReleasedNearASideEdgeDocksToIt()
    {
        Assert.Equal(NotchEdge.Left, NotchDock.Snap(new Point(40, 700), Primary));
        Assert.Equal(NotchEdge.Right, NotchDock.Snap(new Point(2540, 700), Primary));
    }

    [Fact]
    public void ADragReleasedNearTheTopGoesBackToTheTop()
    {
        Assert.Equal(NotchEdge.Top, NotchDock.Snap(new Point(30, 20), Primary));
    }

    [Fact]
    public void ADragReleasedInTheMiddleOfTheScreenGoesBackToTheTop()
    {
        Assert.Equal(NotchEdge.Top, NotchDock.Snap(new Point(1280, 700), Primary));
    }

    [Fact]
    public void HowFarDownASideEdgeTheDragEndedMakesNoDifference()
    {
        // The notch is centred on its edge, so the drag chooses an edge only.
        foreach (double y in new[] { 200.0, 400, 720, 1400 })
            Assert.Equal(NotchEdge.Left, NotchDock.Snap(new Point(40, y), Primary));
    }

    [Fact]
    public void ACornerBelongsToTheTopEdgeRatherThanTheSide()
    {
        // Close to both edges at once the top wins, so a drag that barely left
        // the notch puts it back where it started.
        Assert.Equal(NotchEdge.Top, NotchDock.Snap(new Point(40, 20), Primary));
        Assert.Equal(NotchEdge.Top, NotchDock.Snap(new Point(2540, 20), Primary));
    }

    [Fact]
    public void AnEarOnASideEdgeIsTheTopEdgeEarTurnedOnItsSide()
    {
        var top = NotchDock.Ear(NotchEdge.Top, leading: true).Bounds;
        var left = NotchDock.Ear(NotchEdge.Left, leading: true).Bounds;

        Assert.Equal(NotchDock.EarSpan, top.Width, 3);
        Assert.Equal(NotchDock.EarDepth, top.Height, 3);
        Assert.Equal(NotchDock.EarDepth, left.Width, 3);
        Assert.Equal(NotchDock.EarSpan, left.Height, 3);
        Assert.Equal(new Size(NotchDock.EarDepth, NotchDock.EarSpan), NotchDock.EarSize(NotchEdge.Left));
    }

    [Fact]
    public void EveryEarStaysInsideItsOwnBox()
    {
        foreach (var edge in new[] { NotchEdge.Top, NotchEdge.Left, NotchEdge.Right })
        {
            foreach (bool leading in new[] { true, false })
            {
                var bounds = NotchDock.Ear(edge, leading).Bounds;
                var box = NotchDock.EarSize(edge);

                Assert.True(bounds.Left >= -.01, $"{edge}/{leading} reaches left of its box");
                Assert.True(bounds.Top >= -.01, $"{edge}/{leading} reaches above its box");
                Assert.True(bounds.Right <= box.Width + .01, $"{edge}/{leading} overflows its box");
                Assert.True(bounds.Bottom <= box.Height + .01, $"{edge}/{leading} overflows its box");
            }
        }
    }

    [Fact]
    public void AnEarIsThickWhereItMeetsTheShellAndTapersAwayFromIt()
    {
        // Top edge: solid against the shell's side, nothing at the far end.
        var top = NotchDock.Ear(NotchEdge.Top, leading: true);
        Assert.True(top.FillContains(new Point(10.5, 5)));
        Assert.False(top.FillContains(new Point(1, 8)));

        // Left edge: the same wedge, now solid against the shell's top.
        var left = NotchDock.Ear(NotchEdge.Left, leading: true);
        Assert.True(left.FillContains(new Point(5, 10.5)));
        Assert.False(left.FillContains(new Point(8, 1)));

        // Right edge: mirrored, so it hugs the right side of its box.
        var right = NotchDock.Ear(NotchEdge.Right, leading: true);
        Assert.True(right.FillContains(new Point(5, 10.5)));
        Assert.True(right.FillContains(new Point(9.5, 5)));
        Assert.False(right.FillContains(new Point(2, 1)));
    }

    [Fact]
    public void BothEarsOfOneEdgeAreMirrorImages()
    {
        foreach (var edge in new[] { NotchEdge.Top, NotchEdge.Left, NotchEdge.Right })
        {
            var leading = NotchDock.Ear(edge, leading: true).Bounds;
            var trailing = NotchDock.Ear(edge, leading: false).Bounds;

            Assert.Equal(leading.Width, trailing.Width, 3);
            Assert.Equal(leading.Height, trailing.Height, 3);
        }
    }

    [Fact]
    public void OnlyTheSideEdgesAreVertical()
    {
        Assert.False(NotchDock.IsVertical(NotchEdge.Top));
        Assert.True(NotchDock.IsVertical(NotchEdge.Left));
        Assert.True(NotchDock.IsVertical(NotchEdge.Right));
    }
}
