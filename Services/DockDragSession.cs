using System;
using System.Windows;
using VNotch.Models;

namespace VNotch.Services;

public readonly record struct DockPointerState(Point Position, bool LeftDown, bool ControlDown, bool EscapeDown);

/// <summary>Screen-pixel drag selection. The shell previews Target while held; the persisted edge commits on release.</summary>
public sealed class DockDragSession
{
    private readonly Point _start;
    private readonly Rect _screen;
    private readonly double _scale;
    public NotchEdge Source { get; }
    public NotchEdge Target { get; private set; }
    public bool HasMoved { get; private set; }
    public Point Pointer { get; private set; }

    public DockDragSession(NotchEdge source, Point pointer, Rect screen, double scale)
    {
        Source = Target = source;
        Pointer = _start = pointer;
        _screen = screen;
        _scale = scale > 0 && double.IsFinite(scale) ? scale : 1;
    }

    public void Update(Point pointer)
    {
        Pointer = pointer;
        HasMoved |= (pointer - _start).LengthSquared >= Math.Pow(6 * _scale, 2);
        if (!HasMoved) return;
        var point = new Point((Math.Clamp(pointer.X, _screen.Left, _screen.Right) - _screen.Left) / _scale,
            (Math.Clamp(pointer.Y, _screen.Top, _screen.Bottom) - _screen.Top) / _scale);
        var screen = new Rect(0, 0, _screen.Width / _scale, _screen.Height / _scale);
        var candidate = NotchDock.Snap(point, screen);
        if (candidate == Target) return;
        const double hysteresis = 24;
        double side = Target == NotchEdge.Left ? point.X : screen.Right - point.X;
        if (candidate == NotchEdge.Top && Target != NotchEdge.Top &&
            side < NotchDock.SnapDistance + hysteresis && point.Y > side - hysteresis) return;
        double candidateSide = candidate == NotchEdge.Left ? point.X : screen.Right - point.X;
        if (Target == NotchEdge.Top && candidate != NotchEdge.Top &&
            (candidateSide > NotchDock.SnapDistance - hysteresis || point.Y < candidateSide + hysteresis)) return;
        Target = candidate;
    }

    public static Point HostPosition(Point pointer, Point shellInHostPixels, Size shellPixels, Point grabFraction)
        => new(pointer.X - shellInHostPixels.X - shellPixels.Width * grabFraction.X,
            pointer.Y - shellInHostPixels.Y - shellPixels.Height * grabFraction.Y);

    // Predict the shell's post-layout origin without forcing layout for each
    // animation frame. The stable source alignment owns this preview surface.
    public static Point PreviewHostPosition(Point pointer, Point shellInHostPixels,
        Size previousPixels, Size nextPixels, Point grabFraction, NotchEdge source)
    {
        double dx = previousPixels.Width - nextPixels.Width;
        double dy = previousPixels.Height - nextPixels.Height;
        shellInHostPixels += source switch
        {
            NotchEdge.Left => new Vector(0, dy / 2),
            NotchEdge.Right => new Vector(dx, dy / 2),
            _ => new Vector(dx / 2, 0)
        };
        return HostPosition(pointer, shellInHostPixels, nextPixels, grabFraction);
    }

    private const double LandingStiffness = 7.5;
    private static readonly double LandingTail = Math.Exp(-LandingStiffness);

    // A critically damped response gets moving promptly, then settles without
    // a bounce. Correct the truncated tail so both endpoint velocities are
    // zero and the final native pixel does not receive a positional kick.
    public static double LandingEase(double progress)
    {
        double t = Math.Clamp(progress, 0, 1);
        double normalization = 1 - (1 + LandingStiffness) * LandingTail;
        double response = (1 - (1 + LandingStiffness * t) * Math.Exp(-LandingStiffness * t)) / normalization;
        double endVelocity = LandingStiffness * LandingStiffness * LandingTail / normalization;
        return Math.Clamp(response - endVelocity * t * t * t * (t - 1), 0, 1);
    }

    public static double LandingMilliseconds(double distanceDip)
        => Math.Clamp(220 + Math.Max(0, distanceDip) * .18, 220, 420);
}
