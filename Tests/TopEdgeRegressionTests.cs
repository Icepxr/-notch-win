// Local customization: the top edge is the original placement. Edge docking is
// allowed to add a left and a right, and nothing else: every one of these pins
// a value the notch had before any of it existed.
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using VNotch.Models;
using VNotch.Services;
using Xunit;

namespace VNotch.Tests;

public class TopEdgeRegressionTests
{
    private static readonly Rect Display = new(0, 0, 1920, 1080);
    private const double Pill = 230;

    [Fact]
    public void TheHostIsTheSameRectangleItAlwaysWas()
    {
        // The numbers OverlayWindowControllerTests pins for the startup host.
        Assert.Equal((668, 0, 1224, 300),
            NotchDock.HostBounds(NotchEdge.Top, new Rect(0, 0, 2560, 1440), 720, 120, 1.5));
        Assert.Equal((348, 0, 1224, 300),
            NotchDock.HostBounds(NotchEdge.Top, new Rect(0, 0, 1920, 1080), 720, 120, 1.5));
    }

    [Fact]
    public void TheHostStillHangsFromTheTopOfTheDisplayItIsOn()
    {
        foreach (var screen in new[] { Display, new Rect(-1920, 0, 1920, 1080), new Rect(0, -1080, 1920, 1080) })
            Assert.Equal((int)screen.Top, NotchDock.HostBounds(NotchEdge.Top, screen, 720, 120, 1).Y);
    }

    [Fact]
    public void TheShellKeepsItsWidthAndHeightTheWayRoundTheyWereSet()
    {
        Assert.Equal(new Size(230, 34), NotchDock.Rotate(NotchEdge.Top, 230, 34));
        Assert.Equal(new Size(220, 40), NotchDock.Rotate(NotchEdge.Top, 220, 40));
    }

    [Fact]
    public void OnlyTheBottomCornersAreRounded()
    {
        Assert.Equal(new CornerRadius(0, 0, 12, 12), NotchDock.Radius(NotchEdge.Top, 12));
        // The island-to-notch transition asks for a radius at each end.
        Assert.Equal(new CornerRadius(4, 4, 12, 12), NotchDock.Radius(NotchEdge.Top, 4, 12));
    }

    [Fact]
    public void TheShellIsCentredAcrossTheTop()
    {
        Assert.Equal((HorizontalAlignment.Center, VerticalAlignment.Top), NotchDock.Alignment(NotchEdge.Top));
        Assert.Equal(new Point(.5, 0), NotchDock.TransformOrigin(NotchEdge.Top));
        Assert.Equal(new Vector(0, -1), NotchDock.Retraction(NotchEdge.Top));
        Assert.Equal(new Thickness(0, 8, 0, 0), NotchDock.Inset(NotchEdge.Top, 8));
    }

    [Fact]
    public void TheShellSitsAtTheTopCentreOfItsHost()
    {
        var host = new Rect(348, 0, 816, 200);

        var notch = NotchDock.NotchRect(NotchEdge.Top, host, new Size(230, 34));

        Assert.Equal(348 + (816 - 230) / 2.0, notch.Left);
        Assert.Equal(0, notch.Top);
    }

    [Fact]
    public void TheRevealZoneReachesOutSidewaysAndDownOnly()
    {
        var notch = new Rect(845, 0, 230, 34);

        Assert.Equal(new Rect(785, 0, 350, 94), NotchDock.HoverZone(NotchEdge.Top, notch, 60));
        Assert.Equal(new Rect(841, 0, 238, 38), NotchDock.SafeArea(NotchEdge.Top, notch, 4));
        Assert.Equal(new Rect(785, 0, 350, 3), NotchDock.EdgeStrip(NotchEdge.Top, notch, 60, 3));
    }

    [Fact]
    public void TheEarsAreTheOnesThatWereDrawn()
    {
        var leading = NotchDock.Ear(NotchEdge.Top, leading: true);
        var trailing = NotchDock.Ear(NotchEdge.Top, leading: false);

        Assert.Equal(new Size(11, 10), NotchDock.EarSize(NotchEdge.Top));
        foreach (var ear in new[] { leading, trailing })
        {
            Assert.Equal(0, ear.Bounds.Left, 3);
            Assert.Equal(0, ear.Bounds.Top, 3);
            Assert.Equal(11, ear.Bounds.Width, 3);
            Assert.Equal(10, ear.Bounds.Height, 3);
        }

        // Solid against the shell, tapering to nothing at the far end.
        Assert.True(leading.FillContains(new Point(10.5, 5)));
        Assert.False(leading.FillContains(new Point(1, 8)));
        Assert.True(trailing.FillContains(new Point(.5, 5)));
        Assert.False(trailing.FillContains(new Point(10, 8)));
    }

    [Fact]
    public void EveryPageKeepsTheSizeItWasAuthoredAt()
    {
        // Media, clipboard, calendar, audio mixer and an agent page, as they
        // are declared across the top.
        foreach (var (width, height) in new[] { (480d, 147d), (920d, 268d), (600d, 310d), (720d, 378d), (660d, 560d) })
            Assert.Equal(new Size(width, height), NotchDock.ViewSize(NotchEdge.Top, width, height, Pill, Display));
    }

    [Fact]
    public void NoneOfTheColumnRulesReachTheTopEdge()
    {
        // Depth, length and the cover share describe a side edge. Asking for a
        // top-edge page must not consult any of them.
        var huge = NotchDock.ViewSize(NotchEdge.Top, 4000, 4000, Pill, Display);

        Assert.Equal(new Size(4000, 4000), huge);
    }

    [Fact]
    public void AListAcrossTheTopIsTheStripItAlwaysWas()
    {
        var authoredBand = new GridLength(34);

        var layout = ColumnLayout.For(vertical: false, columnWidth: 290, listMargin: 16, clearance: 28,
            authoredCardWidth: 210, authoredGap: 6, authoredBand);

        Assert.Equal(Orientation.Horizontal, layout.Panel);
        Assert.Equal(ScrollBarVisibility.Hidden, layout.HorizontalScroll);
        Assert.Equal(ScrollBarVisibility.Disabled, layout.VerticalScroll);
        Assert.Equal(210, layout.CardWidth);
        Assert.Equal(new Thickness(6, 0, 6, 0), layout.Spacing);
        Assert.Equal(authoredBand, layout.HeaderBand);
        Assert.True(layout.ReserveNavigationColumn);
    }

    [Fact]
    public void ComingBackFromASideEdgeRestoresTheStripExactly()
    {
        var authoredBand = new GridLength(34);
        var authored = ColumnLayout.For(false, 290, 16, 28, 210, 6, authoredBand);

        ColumnLayout.For(true, 290, 16, 28, 210, 6, authoredBand);
        var returned = ColumnLayout.For(false, 290, 16, 28, 210, 6, authoredBand);

        Assert.Equal(authored, returned);
    }

    [Fact]
    public void ASideEdgeTurnsTheStripIntoAList()
    {
        var layout = ColumnLayout.For(true, columnWidth: 290, listMargin: 16, clearance: 28,
            authoredCardWidth: 210, authoredGap: 6, new GridLength(34));

        Assert.Equal(Orientation.Vertical, layout.Panel);
        Assert.Equal(ScrollBarVisibility.Disabled, layout.HorizontalScroll);
        Assert.Equal(290 - 16, layout.CardWidth);
        Assert.Equal(new Thickness(0, 6, 0, 6), layout.Spacing);
        Assert.Equal(new GridLength(34 + 28), layout.HeaderBand);
        Assert.False(layout.ReserveNavigationColumn);
    }

    [Fact]
    public void AColumnTooNarrowForACardFallsBackToTheAuthoredWidth()
    {
        var layout = ColumnLayout.For(true, columnWidth: 10, listMargin: 16, clearance: 28,
            authoredCardWidth: 210, authoredGap: 6, new GridLength(34));

        Assert.Equal(210, layout.CardWidth);
    }

    [Fact]
    public void AHeaderThatSizesItselfIsLeftAlone()
    {
        var layout = ColumnLayout.For(true, 290, 16, 28, 210, 6, GridLength.Auto);

        Assert.Equal(GridLength.Auto, layout.HeaderBand);
    }
}

public class MediaSourceActivationTests
{
    [Fact]
    public void AMinimisedWindowIsPutBackUp()
    {
        Assert.Equal(WindowReveal.Restore,
            WindowRevealPolicy.For(isVisible: true, isIconic: true));
        Assert.Equal(WindowReveal.Restore,
            WindowRevealPolicy.For(isVisible: false, isIconic: true));
    }

    [Fact]
    public void AWindowAlreadyOnScreenIsOnlyBroughtForward()
    {
        Assert.Equal(WindowReveal.Raise,
            WindowRevealPolicy.For(isVisible: true, isIconic: false));
    }

    [Fact]
    public void AHiddenWindowIsLeftHidden()
    {
        // Chrome keeps hidden top-level windows for its background host.
        // Showing one puts an empty ghost on screen that the taskbar then opens
        // in place of a real browser window, which reads as Chrome refusing to
        // open at all.
        Assert.Equal(WindowReveal.Refuse,
            WindowRevealPolicy.For(isVisible: false, isIconic: false));
    }
}

public class DockGestureTests
{
    [Fact]
    public void HoldingTheModifierDoesNotStopTheNotchOpening()
    {
        // The modifier is held all day for copy, paste and tab switching. It
        // used to arm the move on its own, which left the notch refusing to
        // open on hover for as long as it was down - on every edge.
        Assert.False(DockGesture.SuppressesHover(dragging: false, modifierHeld: true));
    }

    [Fact]
    public void AMoveUnderWayStandsHoverDown()
    {
        Assert.True(DockGesture.SuppressesHover(dragging: true, modifierHeld: true));
        Assert.True(DockGesture.SuppressesHover(dragging: true, modifierHeld: false));
    }

    [Fact]
    public void NothingHappeningLeavesHoverAlone()
    {
        Assert.False(DockGesture.SuppressesHover(dragging: false, modifierHeld: false));
    }

    [Fact]
    public void TheModifierStillOffersTheMove()
    {
        // The cursor may say a move is available before the press lands; that
        // costs nothing if the press never comes.
        Assert.True(DockGesture.OffersPickUp(dragging: false, modifierHeld: true));
        Assert.True(DockGesture.OffersPickUp(dragging: true, modifierHeld: false));
        Assert.False(DockGesture.OffersPickUp(dragging: false, modifierHeld: false));
    }
}

public class ActiveEdgeTests
{
    [Fact]
    public void TurningEdgeDockingOffPutsEverythingBackOnTheTop()
    {
        // The stored edge outlives the switch. The host, the hover zone and the
        // safe area each used to read it for themselves, so turning the switch
        // off could leave the notch drawn across the top while the zone that
        // opens it stayed down the side.
        Assert.Equal(NotchEdge.Top, NotchDock.Active(NotchEdge.Left, enabled: false));
        Assert.Equal(NotchEdge.Top, NotchDock.Active(NotchEdge.Right, enabled: false));
        Assert.Equal(NotchEdge.Top, NotchDock.Active(NotchEdge.Top, enabled: false));
    }

    [Fact]
    public void WithEdgeDockingOnTheStoredEdgeStands()
    {
        foreach (var edge in new[] { NotchEdge.Top, NotchEdge.Left, NotchEdge.Right })
            Assert.Equal(edge, NotchDock.Active(edge, enabled: true));
    }
}
