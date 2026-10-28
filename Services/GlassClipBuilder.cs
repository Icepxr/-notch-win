using System.Windows;
using System.Windows.Media;

namespace VNotch.Services;

internal static class GlassClipBuilder
{
    // The shell, hover glow and material host request the same silhouette in
    // one layout pass. A bounded four-entry cache also handles interleaved
    // shells/materials without retaining an animation's full frame history.
    [ThreadStatic] private static StreamGeometry? _lastClip;
    [ThreadStatic] private static Size _lastClipSize;
    [ThreadStatic] private static CornerRadius _lastClipRadius;
    [ThreadStatic] private static double _lastClipPower;
    [ThreadStatic] private static ClipEntry[]? _clips;
    [ThreadStatic] private static int _nextClip;
    private readonly record struct ClipEntry(Size Size, CornerRadius Radius, double Power, StreamGeometry Geometry);
    private const int CornerSegments = 64;
    private static readonly double[] _unitCos = CreateUnitTrig(useSin: false);
    private static readonly double[] _unitSin = CreateUnitTrig(useSin: true);

    [ThreadStatic] private static CurveEntry[]? _curves;
    [ThreadStatic] private static int _nextCurve;
    private readonly record struct CurveEntry(double Power, double[] Cos, double[] Sin);

    private static double[] CreateUnitTrig(bool useSin)
    {
        var table = new double[CornerSegments];
        for (int i = 1; i < CornerSegments; i++)
        {
            double angle = Math.PI / 2 * i / CornerSegments;
            table[i] = useSin ? Math.Sin(angle) : Math.Cos(angle);
        }
        return table;
    }

    private static (double[] PowCos, double[] PowSin) GetUnitCurve(double power)
    {
        var curves = _curves ??= new CurveEntry[4];
        foreach (var curve in curves)
        {
            if (curve.Cos != null && Math.Abs(power - curve.Power) < 1e-6)
                return (curve.Cos, curve.Sin);
        }
        double exp = 2.0 / power;
        var powCos = new double[CornerSegments];
        var powSin = new double[CornerSegments];
        for (int i = 1; i < CornerSegments; i++)
        {
            powCos[i] = Math.Pow(_unitCos[i], exp);
            powSin[i] = Math.Pow(_unitSin[i], exp);
        }
        curves[_nextCurve] = new CurveEntry(power, powCos, powSin);
        _nextCurve = (_nextCurve + 1) % curves.Length;
        return (powCos, powSin);
    }

    public static StreamGeometry? CreateClip(Size size, CornerRadius radius, double powerFactor = 2)
    {
        double w = size.Width;
        double h = size.Height;
        if (!double.IsFinite(w) || !double.IsFinite(h) || w <= 0 || h <= 0) return null;
        double power = double.IsFinite(powerFactor) ? Math.Max(1.05, powerFactor) : 2;
        // Keep the notch silhouette inside its bounds during animated resizing.
        double maxRadius = Math.Min(w, h) / 2;
        double topLeft = ClampRadius(radius.TopLeft, maxRadius);
        double topRight = ClampRadius(radius.TopRight, maxRadius);
        double bottomRight = ClampRadius(radius.BottomRight, maxRadius);
        double bottomLeft = ClampRadius(radius.BottomLeft, maxRadius);
        radius = new CornerRadius(topLeft, topRight, bottomRight, bottomLeft);
        if (Math.Abs(power - 2) < .01) power = 2; // The same circular arc path.
        if (_lastClip != null && size == _lastClipSize && radius == _lastClipRadius && power == _lastClipPower)
            return _lastClip;
        var clips = _clips ??= new ClipEntry[4];
        foreach (var clip in clips)
        {
            if (clip.Geometry != null && clip.Size == size && clip.Radius == radius && clip.Power == power)
            {
                RememberLast(size, radius, power, clip.Geometry);
                return clip.Geometry;
            }
        }

        var (powCos, powSin) = Math.Abs(power - 2) >= 0.01
            ? GetUnitCurve(power)
            : (System.Array.Empty<double>(), System.Array.Empty<double>());

        var geometry = new StreamGeometry();
        using (var context = geometry.Open())
        {
            context.BeginFigure(new Point(topLeft, 0), true, true);
            context.LineTo(new Point(w - topRight, 0), false, false);
            AddCorner(context, new Point(w, topRight), new Point(w - topRight, topRight), 0, topRight, power, powCos, powSin);
            context.LineTo(new Point(w, h - bottomRight), false, false);
            AddCorner(context, new Point(w - bottomRight, h), new Point(w - bottomRight, h - bottomRight), 1, bottomRight, power, powCos, powSin);
            context.LineTo(new Point(bottomLeft, h), false, false);
            AddCorner(context, new Point(0, h - bottomLeft), new Point(bottomLeft, h - bottomLeft), 2, bottomLeft, power, powCos, powSin);
            context.LineTo(new Point(0, topLeft), false, false);
            AddCorner(context, new Point(topLeft, 0), new Point(topLeft, topLeft), 3, topLeft, power, powCos, powSin);
        }
        geometry.Freeze();
        clips[_nextClip] = new ClipEntry(size, radius, power, geometry);
        _nextClip = (_nextClip + 1) % clips.Length;
        RememberLast(size, radius, power, geometry);
        return geometry;
    }

    private static void RememberLast(Size size, CornerRadius radius, double power, StreamGeometry geometry)
    {
        _lastClipSize = size;
        _lastClipRadius = radius;
        _lastClipPower = power;
        _lastClip = geometry;
    }

    private static double ClampRadius(double radius, double maxRadius) =>
        double.IsNaN(radius) ? 0 : Math.Clamp(radius, 0, maxRadius);

    private static void AddCorner(StreamGeometryContext context, Point end, Point center,
        int quadrant, double radius, double power, double[] powCos, double[] powSin)
    {
        if (radius > 0 && Math.Abs(power - 2) < 0.01)
            context.ArcTo(end, new Size(radius, radius), 0, false, SweepDirection.Clockwise, false, false);
        else if (radius > 0)
        {
            // Match the shader's |x/r|^n + |y/r|^n = 1 boundary using cached unit quadrant curve.
            for (int i = 1; i < CornerSegments; i++)
            {
                double c = powCos[i];
                double s = powSin[i];
                double dx, dy;
                switch (quadrant)
                {
                    case 0: // Top-Right: startAngle = -PI/2 -> cos(t - PI/2) = sin(t), sin(t - PI/2) = -cos(t)
                        dx = s; dy = -c; break;
                    case 1: // Bottom-Right: startAngle = 0 -> cos(t), sin(t)
                        dx = c; dy = s; break;
                    case 2: // Bottom-Left: startAngle = PI/2 -> cos(t + PI/2) = -sin(t), sin(t + PI/2) = cos(t)
                        dx = -s; dy = c; break;
                    default: // Top-Left: startAngle = PI -> cos(t + PI) = -cos(t), sin(t + PI) = -sin(t)
                        dx = -c; dy = -s; break;
                }
                context.LineTo(new Point(center.X + radius * dx, center.Y + radius * dy), false, false);
            }
            context.LineTo(end, false, false);
        }
        else
            context.LineTo(end, false, false);
    }
}
