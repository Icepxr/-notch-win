using System.Windows;
using VNotch.Models;
using VNotch.Services;
using Xunit;

namespace VNotch.Tests;

public sealed class DockDragSessionTests
{
    [Theory]
    [InlineData(1)] [InlineData(1.5)] [InlineData(2)]
    public void JitterIsNotADragAndPhysicalThresholdScalesWithDpi(double scale)
    {
        var session = new DockDragSession(NotchEdge.Top, new Point(960, 20), new Rect(0, 0, 1920 * scale, 1080 * scale), scale);
        session.Update(new Point(960 + 5 * scale, 20));
        Assert.False(session.HasMoved);
        session.Update(new Point(960 + 7 * scale, 20));
        Assert.True(session.HasMoved);
        session.Update(new Point(960, 20)); Assert.True(session.HasMoved);
    }

    [Fact]
    public void SideBoundaryHasADeadBandInsteadOfFlickering()
    {
        var session = new DockDragSession(NotchEdge.Top, new Point(960, 20), new Rect(0, 0, 1920, 1080), 1);
        session.Update(new Point(130, 540)); Assert.Equal(NotchEdge.Left, session.Target);
        foreach (var x in new[] { 160, 175, 168, 185, 171 })
        { session.Update(new Point(x, 540)); Assert.Equal(NotchEdge.Left, session.Target); }
        session.Update(new Point(210, 540)); Assert.Equal(NotchEdge.Top, session.Target);
        session.Update(new Point(168, 540)); Assert.Equal(NotchEdge.Top, session.Target);
        session.Update(new Point(140, 540)); Assert.Equal(NotchEdge.Left, session.Target);
    }

    [Theory]
    [InlineData(0, 0, 1)] [InlineData(-2560, 0, 1.5)] [InlineData(0, -2160, 2)]
    public void TargetRegionsUseTheConfiguredMonitorOriginAndDpi(double x, double y, double scale)
    {
        var screen = new Rect(x, y, 1920 * scale, 1080 * scale);
        var session = new DockDragSession(NotchEdge.Top, new Point(x + 960 * scale, y + 20 * scale), screen, scale);
        session.Update(new Point(x + 120 * scale, y + 540 * scale)); Assert.Equal(NotchEdge.Left, session.Target);
        session.Update(new Point(screen.Right - 120 * scale, y + 540 * scale)); Assert.Equal(NotchEdge.Right, session.Target);
        session.Update(new Point(x + 960 * scale, y + 20 * scale)); Assert.Equal(NotchEdge.Top, session.Target);
        Assert.Equal(NotchEdge.Top, session.Source);
    }

    [Fact]
    public void GrabFractionStaysUnderPointerAsAnExpandedPanelShrinks()
    {
        var pointer = new Point(600, 300); var grab = new Point(.75, .25); var local = new Point(200, 8);
        foreach (var size in new[] { new Size(600, 310), new Size(350, 170), new Size(240, 40) })
        {
            var host = DockDragSession.HostPosition(pointer, local, size, grab);
            Assert.Equal(pointer.X, host.X + local.X + size.Width * grab.X);
            Assert.Equal(pointer.Y, host.Y + local.Y + size.Height * grab.Y);
        }
    }

    [Fact]
    public void LandingEasesOutWithoutOvershooting()
    {
        double previous = 0;
        for (int frame = 0; frame <= 20; frame++)
        { double t = DockDragSession.LandingEase(frame / 20d); Assert.InRange(t, previous, 1); previous = t; }
        Assert.Equal(0, DockDragSession.LandingEase(-1));
        Assert.Equal(1, DockDragSession.LandingEase(2));
        // Both velocity and acceleration settle at the join with pointer
        // tracking and at rest, rather than starting with a positional kick.
        const double step = .001;
        Assert.InRange(DockDragSession.LandingEase(step) / step, 0, .001);
        Assert.InRange((1 - DockDragSession.LandingEase(1 - step)) / step, 0, .001);
    }

    [Fact]
    public void LandingDurationScalesWithDistanceWithoutDraggingOutLongMoves()
    {
        Assert.Equal(220, DockDragSession.LandingMilliseconds(-10));
        Assert.Equal(220, DockDragSession.LandingMilliseconds(0));
        Assert.InRange(DockDragSession.LandingMilliseconds(500), 300, 320);
        Assert.Equal(420, DockDragSession.LandingMilliseconds(5000));
    }
}
