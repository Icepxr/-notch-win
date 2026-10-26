// Local customization: geometry for docking the notch to the top, left or right
// screen edge. Everything here is pure, so placement is covered by unit tests
// instead of being judged by eye on one monitor.
using System.Globalization;
using System.Windows;
using System.Windows.Media;
using VNotch.Models;

namespace VNotch.Services;

public static class NotchDock
{
    /// How far an ear flares along the edge, and how deep it reaches away from
    /// it. These match the hand-authored paths the top edge has always used.
    public const double EarSpan = 11;
    public const double EarDepth = 10;

    /// Slack the host window keeps beyond the shell. The notch morphs inside a
    /// surface that never resizes, so DWM never has to rebuild it mid-animation.
    public const double AlongEdgePadding = 96;
    public const double AwayFromEdgePadding = 80;

    /// A release within this distance of a side edge docks to that side.
    public const double SnapDistance = 170;

    /// <summary>
    /// The edge actually in force. The stored edge outlives the switch that
    /// turns edge docking off, so everything that places the notch - the host,
    /// the hover zone, the safe area - has to ask the same question or they
    /// end up on different edges.
    /// </summary>
    public static NotchEdge Active(NotchEdge stored, bool enabled) => enabled ? stored : NotchEdge.Top;

    public static bool IsVertical(NotchEdge edge) => edge is NotchEdge.Left or NotchEdge.Right;

    /// <summary>
    /// The column grows with the configured pill between readable bounds.
    /// A tiny compact badge must not squeeze expanded controls into its width.
    /// </summary>
    public const double ColumnDepthInPills = .92;
    // The compact badge may be tiny; a page still needs room for labels and
    // controls. Cap the reading width on large displays and fit small ones.
    public const double MinimumColumnDepth = 300;
    public const double MaximumColumnDepth = 420;

    /// <summary>
    /// The cover's share of the column it sits in. Short of the full width, so
    /// the card reads as a card with artwork inside it rather than a picture
    /// with controls stuck underneath, and so what follows has a line to sit
    /// on. It is a share rather than a size: a bigger notch gives a bigger
    /// cover without anything here changing.
    /// </summary>
    public const double CoverShareOfColumn = .72;

    /// <summary>
    /// Side page depth in DIPs: scale with the pill, keep a readable 300–420
    /// range, and give back space on displays narrower than that range permits.
    /// </summary>
    /// <param name="pillLength">the collapsed shell along its edge</param>
    /// <remarks>
    /// <paramref name="screen"/> is in device-independent units here, not the
    /// physical pixels <see cref="HostBounds"/> places the window in: these are
    /// content sizes, and on a 150% display a 345pt column is 518px wide.
    /// </remarks>
    public static double Depth(double pillLength, Rect screen)
    {
        double wanted = Math.Clamp(pillLength * ColumnDepthInPills, MinimumColumnDepth, MaximumColumnDepth);
        return Math.Max(1, Math.Min(wanted, screen.Width / 3));
    }

    /// <summary>
    /// The shortest a side-docked page may be: the pill it grew out of. Below
    /// that the page would be smaller than the thing that opened it.
    /// </summary>
    public static double MinimumLength(double pillLength) => pillLength;

    /// <summary>
    /// How far a page runs along a side edge. A page transposed onto the
    /// vertical axis needs down the screen roughly what it needed across it,
    /// since it is the same content in the same order; the screen decides the
    /// rest.
    /// </summary>
    public static double Length(double wanted, double pillLength, Rect screen)
    {
        double shortest = MinimumLength(pillLength);
        return Math.Clamp(wanted, shortest, Math.Max(shortest, LongestLength(screen)));
    }

    /// <summary>
    /// The most of the display a side-docked page may run down. A page that
    /// fills whatever it is given would otherwise take the whole edge, which
    /// makes a panel beside your work into a second screen.
    /// </summary>
    public const double MaximumLengthShare = .5;

    public static double LongestLength(Rect screen)
        => Math.Min(screen.Height - AwayFromEdgePadding, screen.Height * MaximumLengthShare);

    /// <summary>
    /// The size a view asks for on this edge: as authored across the top, and
    /// a readable column of the length above down a side.
    /// </summary>
    public static Size ViewSize(NotchEdge edge, double landscapeWidth, double landscapeHeight,
        double pillLength, Rect screen)
        => IsVertical(edge)
            ? new Size(Depth(pillLength, screen), Length(landscapeWidth, pillLength, screen))
            : new Size(landscapeWidth, landscapeHeight);

    /// <summary>
    /// The shell's own size once docked. A side edge turns the pill on its end,
    /// so the configured width becomes its height.
    /// </summary>
    /// <summary>
    /// The artwork's share of the badge, leaving the ring its annulus. Under a
    /// half would leave the artwork too small to recognise a cover by; much
    /// over and the ring has no room to move in.
    /// </summary>
    public const double BadgeArtworkShare = .54;

    /// <summary>
    /// The collapsed shell. Across the top it is the pill the user configured,
    /// which is long because it stands in for a notch cut out of the screen.
    /// Down a side there is nothing to be that long for - the row it carried
    /// becomes a badge - so it is as across as the pill is thick and only half
    /// again as long, with its ends fully rounded.
    /// </summary>
    public static Size CollapsedSize(NotchEdge edge, double width, double height)
        => IsVertical(edge) ? new Size(height, height * BadgeLengthInBreadths) : new Size(width, height);

    /// <summary>
    /// How much longer than it is thick the badge stands. Enough to read as a
    /// pill hanging off the edge rather than a dot, and short enough that it
    /// is still the artwork and its ring you see rather than empty capsule.
    /// </summary>
    public const double BadgeLengthInBreadths = 1.5;

    public static Size Rotate(NotchEdge edge, double width, double height)
        => IsVertical(edge) ? new Size(height, width) : new Size(width, height);

    /// <summary>
    /// The fixed host surface in device-independent units: the shell's longest
    /// extent along the edge plus slack, by its depth plus slack.
    /// </summary>
    public static Size HostSize(NotchEdge edge, double alongEdge, double awayFromEdge)
    {
        double longDip = alongEdge + AlongEdgePadding;
        double shortDip = awayFromEdge + AwayFromEdgePadding;
        return IsVertical(edge) ? new Size(shortDip, longDip) : new Size(longDip, shortDip);
    }

    /// <summary>
    /// The fixed host surface, in physical pixels.
    /// </summary>
    /// <param name="alongEdge">the longest extent any view needs along the edge</param>
    /// <param name="awayFromEdge">the deepest extent any view needs away from it</param>
    public static (int X, int Y, int Width, int Height) HostBounds(
        NotchEdge edge, Rect screen, double alongEdge, double awayFromEdge, double scale)
    {
        var dip = HostSize(edge, alongEdge, awayFromEdge);

        int width = (int)Math.Round(dip.Width * scale);
        int height = (int)Math.Round(dip.Height * scale);
        int screenLeft = (int)Math.Round(screen.Left);
        int screenTop = (int)Math.Round(screen.Top);
        int screenWidth = (int)Math.Round(screen.Width);
        int screenHeight = (int)Math.Round(screen.Height);

        // The notch sits in the middle of whichever edge it hangs from: the top
        // edge centres it horizontally, a side edge vertically.
        if (!IsVertical(edge))
            return (screenLeft + (screenWidth - width) / 2, screenTop, width, height);

        int x = edge == NotchEdge.Left ? screenLeft : screenLeft + screenWidth - width;
        return (x, screenTop + (screenHeight - height) / 2, width, height);
    }

    /// <summary>
    /// Where the collapsed shell lands inside a host of this size, in the same
    /// units the host bounds were given in.
    /// </summary>
    public static Rect NotchRect(NotchEdge edge, Rect host, Size shell) => edge switch
    {
        NotchEdge.Left => new Rect(host.Left, host.Top + (host.Height - shell.Height) / 2, shell.Width, shell.Height),
        NotchEdge.Right => new Rect(host.Right - shell.Width, host.Top + (host.Height - shell.Height) / 2, shell.Width, shell.Height),
        _ => new Rect(host.Left + (host.Width - shell.Width) / 2, host.Top, shell.Width, shell.Height),
    };

    /// <summary>Square on the screen side, rounded where it meets the desktop.</summary>
    public static CornerRadius Radius(NotchEdge edge, double radius) => Radius(edge, 0, radius);

    /// <summary>
    /// A radius for the two corners against the screen edge and another for the
    /// two facing the desktop, turned to suit the edge.
    /// </summary>
    public static CornerRadius Radius(NotchEdge edge, double atEdge, double atDesktop) => edge switch
    {
        NotchEdge.Left => new CornerRadius(atEdge, atDesktop, atDesktop, atEdge),
        NotchEdge.Right => new CornerRadius(atDesktop, atEdge, atEdge, atDesktop),
        _ => new CornerRadius(atEdge, atEdge, atDesktop, atDesktop),
    };

    /// <summary>
    /// The alignment the shell takes inside the host: pinned to its edge, and
    /// centred on the axis that runs along that edge.
    /// </summary>
    public static (HorizontalAlignment Horizontal, VerticalAlignment Vertical) Alignment(NotchEdge edge) => edge switch
    {
        NotchEdge.Left => (HorizontalAlignment.Left, VerticalAlignment.Center),
        NotchEdge.Right => (HorizontalAlignment.Right, VerticalAlignment.Center),
        _ => (HorizontalAlignment.Center, VerticalAlignment.Top),
    };

    /// <summary>
    /// The anchor a morph scales about: the middle of the edge the shell is
    /// attached to, so it grows into the desktop and never through the bezel.
    /// </summary>
    public static Point TransformOrigin(NotchEdge edge) => edge switch
    {
        NotchEdge.Left => new Point(0, .5),
        NotchEdge.Right => new Point(1, .5),
        _ => new Point(.5, 0),
    };

    /// <summary>
    /// A gap on the docked edge alone, for an island that floats clear of it.
    /// </summary>
    public static Thickness Inset(NotchEdge edge, double gap) => edge switch
    {
        NotchEdge.Left => new Thickness(gap, 0, 0, 0),
        NotchEdge.Right => new Thickness(0, 0, gap, 0),
        _ => new Thickness(0, gap, 0, 0),
    };

    /// <summary>
    /// Which way the shell retracts when it hides, as a unit vector.
    /// </summary>
    public static Vector Retraction(NotchEdge edge) => edge switch
    {
        NotchEdge.Left => new Vector(-1, 0),
        NotchEdge.Right => new Vector(1, 0),
        _ => new Vector(0, -1),
    };

    /// <summary>
    /// The reveal zone. It reaches out along the edge on both sides of the
    /// shell and away from the edge, never through it.
    /// </summary>
    public static Rect HoverZone(NotchEdge edge, Rect notch, double margin)
    {
        if (notch.IsEmpty) return notch;
        return SpreadFromEdge(edge, notch, margin);
    }

    /// <summary>The area other windows are asked to keep clear.</summary>
    public static Rect SafeArea(NotchEdge edge, Rect notch, double margin)
        => notch.IsEmpty ? notch : SpreadFromEdge(edge, notch, margin);

    private static Rect SpreadFromEdge(NotchEdge edge, Rect notch, double margin) => edge switch
    {
        NotchEdge.Left => new Rect(notch.Left, notch.Top - margin, notch.Width + margin, notch.Height + margin * 2),
        NotchEdge.Right => new Rect(notch.Left - margin, notch.Top - margin, notch.Width + margin, notch.Height + margin * 2),
        _ => new Rect(notch.Left - margin, notch.Top, notch.Width + margin * 2, notch.Height + margin),
    };

    /// <summary>
    /// A thin strip of the screen edge the notch is docked to, widened along
    /// that edge by <paramref name="margin"/>. This is the sliver that reveals
    /// a notch sitting behind other windows.
    /// </summary>
    public static Rect EdgeStrip(NotchEdge edge, Rect notch, double margin, double thickness) => edge switch
    {
        NotchEdge.Left => new Rect(notch.Left, notch.Top - margin, thickness, notch.Height + margin * 2),
        NotchEdge.Right => new Rect(notch.Right - thickness, notch.Top - margin, thickness, notch.Height + margin * 2),
        _ => new Rect(notch.Left - margin, notch.Top, notch.Width + margin * 2, thickness),
    };

    /// <summary>
    /// The edge a drag released at <paramref name="point"/> belongs to. Only
    /// the edge is chosen: the notch is always centred along it, so a drag has
    /// one decision to make and cannot leave it somewhere lopsided.
    /// </summary>
    public static NotchEdge Snap(Point point, Rect screen)
    {
        double fromLeft = point.X - screen.Left;
        double fromRight = screen.Right - point.X;
        double fromTop = point.Y - screen.Top;

        double side = Math.Min(fromLeft, fromRight);
        // The top edge wins a tie, because that is where the notch belongs
        // unless the drag clearly went for a side.
        if (fromTop <= side || side > SnapDistance)
            return NotchEdge.Top;

        return fromLeft <= fromRight ? NotchEdge.Left : NotchEdge.Right;
    }

    // Both ears of the top edge, as authored. Every other edge is one of these
    // two turned onto its side, so the silhouette cannot drift between edges.
    private const string LeadingEar = "M 0,0 L 11,0 L 11,10 C 11,4.4 6.2,0 0,0 Z";
    private const string TrailingEar = "M 11,0 L 0,0 L 0,10 C 0,4.4 4.8,0 11,0 Z";

    /// <summary>
    /// One ear of the silhouette. <paramref name="leading"/> picks the one that
    /// comes first along the edge: left of the shell on top, above it on a side.
    /// </summary>
    public static Geometry Ear(NotchEdge edge, bool leading)
        => _ears.GetOrAdd((edge, leading), static key => BuildEar(key.Edge, key.Leading));

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<(NotchEdge Edge, bool Leading), Geometry> _ears = new();

    private static Geometry BuildEar(NotchEdge edge, bool leading)
    {
        // Geometry.Parse hands back a frozen figure, so turning one onto its
        // side means working on a copy.
        var geometry = Geometry.Parse(leading ? LeadingEar : TrailingEar).Clone();
        if (IsVertical(edge))
        {
            // Transposing swaps the along-edge and depth axes, which is exactly
            // what moving from a horizontal edge to a vertical one does.
            var matrix = new Matrix(0, 1, 1, 0, 0, 0);
            if (edge == NotchEdge.Right) matrix.Append(new Matrix(-1, 0, 0, 1, EarDepth, 0));
            geometry.Transform = new MatrixTransform(matrix);
        }
        geometry.Freeze();
        return geometry;
    }

    /// <summary>The box an ear occupies, so layout can reserve it.</summary>
    public static Size EarSize(NotchEdge edge)
        => IsVertical(edge) ? new Size(EarDepth, EarSpan) : new Size(EarSpan, EarDepth);

    public static string Describe(NotchEdge edge)
        => edge.ToString().ToLower(CultureInfo.InvariantCulture);
}
