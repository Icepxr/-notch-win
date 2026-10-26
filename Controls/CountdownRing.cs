using System;
using System.Windows;
using System.Windows.Media;

namespace VNotch.Controls;

/// <summary>Vector progress, redrawn only when its value changes. No render loop.</summary>
public sealed class CountdownRing : FrameworkElement
{
    private static readonly Brush TrackBrush = FrozenTrackBrush();
    private static readonly Pen TrackPen = FrozenPen(TrackBrush, 3);
    private static readonly Pen TickPen = FrozenPen(TrackBrush, 1);
    private DrawingGroup? _dialFace;
    private Size _dialSize;
    private Pen? _accentPen;

    private static Brush FrozenTrackBrush()
    {
        var brush = new SolidColorBrush(Color.FromArgb(28, 255, 255, 255));
        brush.Freeze();
        return brush;
    }

    private static Pen FrozenPen(Brush brush, double thickness)
    {
        var pen = new Pen(brush, thickness);
        pen.Freeze();
        return pen;
    }
    public static readonly DependencyProperty RemainingShareProperty = DependencyProperty.Register(
        nameof(RemainingShare), typeof(double), typeof(CountdownRing),
        new FrameworkPropertyMetadata(1d, FrameworkPropertyMetadataOptions.AffectsRender));
    public static readonly DependencyProperty AccentProperty = DependencyProperty.Register(
        nameof(Accent), typeof(Brush), typeof(CountdownRing),
        new FrameworkPropertyMetadata(Brushes.Coral, FrameworkPropertyMetadataOptions.AffectsRender));
    public double RemainingShare { get => (double)GetValue(RemainingShareProperty); set => SetValue(RemainingShareProperty, value); }
    public Brush Accent { get => (Brush)GetValue(AccentProperty); set => SetValue(AccentProperty, value); }

    protected override void OnRender(DrawingContext dc)
    {
        base.OnRender(dc);
        double size = Math.Min(ActualWidth, ActualHeight);
        if (size < 20) return;
        var center = new Point(ActualWidth / 2, ActualHeight / 2);
        double radius = size / 2 - 12;
        double share = double.IsFinite(RemainingShare) ? Math.Clamp(RemainingShare, 0, 1) : 0;
        var bounds = new Size(ActualWidth, ActualHeight);
        if (_dialFace == null || _dialSize != bounds)
        {
            // The 60 marks do not depend on remaining time or accent. Retain
            // their vector drawing until the control actually changes size.
            var face = new DrawingGroup();
            using (var drawing = face.Open())
            {
                drawing.DrawEllipse(null, TrackPen, center, radius, radius);
                for (int i = 0; i < 60; i++)
                {
                    double angle = i * Math.PI / 30 - Math.PI / 2;
                    double r = radius + (i % 5 == 0 ? 8 : 6);
                    var a = new Point(center.X + (radius + 5) * Math.Cos(angle), center.Y + (radius + 5) * Math.Sin(angle));
                    var b = new Point(center.X + r * Math.Cos(angle), center.Y + r * Math.Sin(angle));
                    drawing.DrawLine(TickPen, a, b);
                }
            }
            face.Freeze();
            _dialFace = face;
            _dialSize = bounds;
        }
        dc.DrawDrawing(_dialFace);
        if (share <= 0) return;
        if (_accentPen == null || !ReferenceEquals(_accentPen.Brush, Accent))
        {
            _accentPen = new Pen(Accent, 3) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round };
            if (Accent.IsFrozen) _accentPen.Freeze();
        }
        var pen = _accentPen;
        if (share >= .99999) dc.DrawEllipse(null, pen, center, radius, radius);
        else
        {
            double angle = share * Math.PI * 2 - Math.PI / 2;
            var end = new Point(center.X + radius * Math.Cos(angle), center.Y + radius * Math.Sin(angle));
            var arc = new StreamGeometry();
            using (var g = arc.Open())
            {
                g.BeginFigure(new Point(center.X, center.Y - radius), false, false);
                g.ArcTo(end, new Size(radius, radius), 0, share > .5, SweepDirection.Clockwise, true, false);
            }
            arc.Freeze(); dc.DrawGeometry(null, pen, arc);
            dc.DrawEllipse(Accent, null, end, 4, 4);
        }
    }
}
