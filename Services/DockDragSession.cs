using System;
using System.Windows;
using VNotch.Models;

namespace VNotch.Services;

public readonly record struct DockPointerState(Point Position, bool LeftDown, bool ControlDown, bool EscapeDown);

/// <summary>Screen-pixel drag state. Layout changes are committed only on release.</summary>
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

    public static double LandingEase(double progress) => 1 - Math.Pow(1 - Math.Clamp(progress, 0, 1), 3);
}
