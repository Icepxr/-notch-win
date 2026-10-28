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

    [Theory]
    [InlineData(NotchEdge.Top, 1)] [InlineData(NotchEdge.Top, 1.5)] [InlineData(NotchEdge.Top, 2)]
    [InlineData(NotchEdge.Left, 1)] [InlineData(NotchEdge.Left, 1.5)] [InlineData(NotchEdge.Left, 2)]
    [InlineData(NotchEdge.Right, 1)] [InlineData(NotchEdge.Right, 1.5)] [InlineData(NotchEdge.Right, 2)]
    public void APreviewResizeKeepsAnOffCentreGripAtThePointerOnTheNextLayout(NotchEdge source, double scale)
    {
        var host = new Rect(0, 0, 800 * scale, 700 * scale);
        var from = NotchDock.IsVertical(source) ? new Size(40 * scale, 60 * scale) : new Size(240 * scale, 40 * scale);
        var to = NotchDock.IsVertical(source) ? new Size(240 * scale, 40 * scale) : new Size(40 * scale, 60 * scale);
        var inset = new Vector(8 * scale, 8 * scale);
        var oldOrigin = NotchDock.NotchRect(source, host, from).TopLeft + inset;
        var newOrigin = NotchDock.NotchRect(source, host, to).TopLeft + inset;
        var pointer = new Point(-330.5 * scale, 217.75 * scale);
        var grip = new Point(.18, .77);
        var position = DockDragSession.PreviewHostPosition(pointer, oldOrigin, from, to, grip, source);
        var actualGrip = position + (Vector)newOrigin + new Vector(to.Width * grip.X, to.Height * grip.Y);
        Assert.InRange((actualGrip - pointer).Length, 0, .000001);
    }

    [Fact]
    public void LandingEasesOutWithoutOvershooting()
    {
        double previous = 0;
        for (int frame = 0; frame <= 1000; frame++)
        { double t = DockDragSession.LandingEase(frame / 1000d); Assert.InRange(t, previous, 1); previous = t; }
        Assert.Equal(0, DockDragSession.LandingEase(-1));
        Assert.Equal(1, DockDragSession.LandingEase(2));
        // Prompt response instead of spending the first frames barely moving;
        // the shell should be nearly settled by the midpoint of its duration.
        Assert.InRange(DockDragSession.LandingEase(.2), .4, .6);
        Assert.InRange(DockDragSession.LandingEase(.5), .85, .95);
        const double step = .001;
        Assert.InRange(DockDragSession.LandingEase(step) / step, 0, .04);
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
