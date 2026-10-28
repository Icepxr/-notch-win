// Local customization: dock the notch to the top, left or right screen edge.
// The top edge is the original placement; a side edge turns the shell, its ears
// and its content onto the vertical axis.
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Shapes;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Threading;
using System.Diagnostics;
using VNotch.Models;
using VNotch.Services;

namespace VNotch;

public partial class MainWindow
{
    private const string DockLogTag = "DOCK";

    /// <summary>
    /// Moving the notch is held behind Ctrl because a plain press is already
    /// spoken for twice over: the shell expands on mouse <em>down</em>, so a
    /// hold has opened the panel before any hold could elapse, and a plain
    /// horizontal drag is the swipe that skips a track. Ctrl collides with
    /// neither, and the tray menu offers the same thing without a mouse.
    /// </summary>
    private const int DockPickUpModifier = Win32Interop.VK_CONTROL;

    private NotchEdge? _appliedDockEdge;
    private bool _isDockDragging;
    private bool _isDockLanding;
    private DockDragSession? _dockDrag;
    private DispatcherTimer? _dockDragTimer;
    private DispatcherTimer? _dockArmingTimer;
    private bool _dockWasArmed;
    private Point _dockGrabFraction;
    private bool _dockDidMove;
    private int _dockMoveVersion;
    private bool _dockNeedsSettle;
    private EventHandler? _dockLandingRendering;
    private TaskCompletionSource? _dockLandingCompletion;
    private EventHandler? _dockDragRendering;
    private bool _dockContentsSuspended;
    private Visibility _dockContentsVisibility;
    private long _dockLandingLastFrameTicks;
    private NotchEdge? _dockForegroundTarget;
    private NotchEdge? _dockPreviewTarget;
    private Size _dockPreviewFromSize, _dockPreviewToSize;
    private CornerRadius _dockPreviewFromRadius, _dockPreviewToRadius;
    private TimeSpan _dockPreviewStarted;
    private bool _dockPreviewSettled;
    internal Func<DockPointerState> DockPointerReader { get; set; } = ReadSystemDockPointer;

    private static DockPointerState ReadSystemDockPointer()
    {
        Win32Interop.GetCursorPos(out var point);
        return new(new Point(point.X, point.Y),
            (Win32Interop.GetAsyncKeyState(Win32Interop.VK_LBUTTON) & 0x8000) != 0,
            (Win32Interop.GetAsyncKeyState(DockPickUpModifier) & 0x8000) != 0,
            (Win32Interop.GetAsyncKeyState(0x1B) & 0x8000) != 0);
    }

    internal NotchEdge DockEdge => NotchDock.Active(_settings.DockEdge, _settings.EnableEdgeDocking);

    internal bool IsDockVertical => NotchDock.IsVertical(DockEdge);

    /// <summary>
    /// A gap on the docked edge alone, so an island floats clear of whichever
    /// edge it hangs from rather than always of the top.
    /// </summary>
    private Thickness DockInset(double gap) => NotchDock.Inset(DockEdge, gap);

    #region Orientation

    /// <summary>
    /// Turn the shell onto the axis of the current edge. Returns at once when
    /// the edge has not moved, so callers can treat it as idempotent.
    /// </summary>
    private void ApplyDockOrientation()
    {
        var edge = DockEdge;
        if (_appliedDockEdge == edge) return;

        bool wasVertical = _appliedDockEdge.HasValue && NotchDock.IsVertical(_appliedDockEdge.Value);
        bool vertical = NotchDock.IsVertical(edge);
        _appliedDockEdge = edge;

        var alignment = NotchDock.Alignment(edge);
        OrientShell(NotchWrapper, edge, alignment);
        OrientShell(NotchShadowWrapper, edge, alignment);

        ApplyEar(LeftEar, edge, leading: true);
        ApplyEar(RightEar, edge, leading: false);
        ApplyEar(LeftShadowEar, edge, leading: true);
        ApplyEar(RightShadowEar, edge, leading: false);

        if (wasVertical != vertical)
        {
            // The pill is a narrow column on a side edge, so what it shows has
            // to stack. The navigation row stays a row: an expanded page is
            // 300-420 wide, which fits the icons across with room to spare, and
            // standing them up would spend a fifth of the page's height on them.
            FlipStack(CollapsedContent, vertical);
            ApplyCompactPillOrientation(vertical);
            // The pill's own margins are decided for an edge, so they have to
            // be decided again now the edge has changed.
            ApplyDynamicIslandLayout();
            ApplyMediaPageOrientation(vertical);
            ApplyClipboardOrientation(vertical);
            ApplyTimerOrientation(vertical);
            ApplyAudioOrientation(vertical);
            ApplyAgentsOrientation(vertical);
            // Pages given a column's width keep it until they are told
            // otherwise, and the top edge never tells them.
            if (!vertical) RestoreAuthoredContentSizes();
        }

        _collapsedWidth = GetCollapsedWidth();
        _collapsedHeight = GetCollapsedHeight();
        _cornerRadiusCollapsed = GetCollapsedCornerRadius();
        if (NotchBorder != null && !_isExpanded && !_isAnimating)
        {
            NotchBorder.Width = _collapsedWidth;
            NotchBorder.Height = _collapsedHeight;
            CurrentCornerRadius = _cornerRadiusCollapsed;
        }

        SyncShellCornerRadius(MakeNotchCornerRadius(_cornerRadiusCollapsed));
        _glassMaterialPresenter.SyncCornerRadius(NotchBorder?.CornerRadius ?? default);
        UpdateNotchClip();

        RuntimeLog.Log(DockLogTag, $"oriented to the {NotchDock.Describe(edge)} edge");
    }

    /// <summary>
    /// The shell sits in a three-cell grid: an ear, the panel, an ear. Those
    /// cells run across the panel on the top edge and down it on a side.
    /// </summary>
    private static void OrientShell(Grid? grid, NotchEdge edge,
        (HorizontalAlignment Horizontal, VerticalAlignment Vertical) alignment)
    {
        if (grid == null) return;

        grid.HorizontalAlignment = alignment.Horizontal;
        grid.VerticalAlignment = alignment.Vertical;
        grid.RenderTransformOrigin = NotchDock.TransformOrigin(edge);

        bool vertical = NotchDock.IsVertical(edge);
        grid.ColumnDefinitions.Clear();
        grid.RowDefinitions.Clear();
        for (int i = 0; i < grid.Children.Count; i++)
        {
            if (vertical) grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            else grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        }

        // The children are authored in order along the edge, so their index is
        // the cell they belong in whichever way the grid runs.
        for (int slot = 0; slot < grid.Children.Count; slot++)
        {
            var child = grid.Children[slot];
            Grid.SetRow(child, vertical ? slot : 0);
            Grid.SetColumn(child, vertical ? 0 : slot);
        }
    }

    private static void ApplyEar(Path? ear, NotchEdge edge, bool leading)
    {
        if (ear == null) return;

        var size = NotchDock.EarSize(edge);
        var alignment = NotchDock.Alignment(edge);
        ear.Data = NotchDock.Ear(edge, leading);
        ear.Width = size.Width;
        ear.Height = size.Height;
        ear.HorizontalAlignment = alignment.Horizontal;
        ear.VerticalAlignment = alignment.Vertical;

        // Overlap the panel by a pixel so antialiasing cannot leave a seam
        // where the flare meets it.
        ear.Margin = NotchDock.IsVertical(edge)
            ? new Thickness(0, leading ? 0 : -1, 0, leading ? -1 : 0)
            : new Thickness(leading ? 0 : -1, 0, leading ? -1 : 0, 0);
    }

    /// <summary>
    /// How far down the navigation row reaches, taken from the row itself. It
    /// is asked for its measurement rather than its laid-out height, because
    /// the first time this is needed the row has not been through a layout
    /// pass and would answer zero.
    /// </summary>
    private double NavigationRowHeight
    {
        get
        {
            if (NavTabsStackPanel == null) return 0;

            // Measure the current row, not its last orientation's layout slot.
            NavTabsStackPanel.Measure(new Size(double.PositiveInfinity, double.PositiveInfinity));
            double height = NavTabsStackPanel.DesiredSize.Height;
            if (!double.IsFinite(height) || height <= 0) return 0;

            // DesiredSize includes the element's margin already.
            return height;
        }
    }

    /// <summary>
    /// How far in from the edge the status corner reaches, taken from the
    /// corner itself. Asked for its measurement rather than its laid-out width,
    /// because the first time this is needed it has not been laid out.
    /// </summary>
    private double StatusCornerWidth
    {
        get
        {
            if (StatusBar == null) return 0;

            double width = StatusBar.ActualWidth;
            if (!(width > 0))
            {
                StatusBar.Measure(new Size(double.PositiveInfinity, double.PositiveInfinity));
                width = StatusBar.DesiredSize.Width;
            }
            if (!double.IsFinite(width) || width <= 0) return 0;

            var margin = StatusBar.Margin;
            return width + margin.Left + margin.Right;
        }
    }

    /// <summary>
    /// The clipboard is a strip of tiles across the top and a list down a side,
    /// which is the same cards read the other way.
    /// </summary>
    private void ApplyClipboardOrientation(bool vertical)
    {
        if (ClipboardTrayView == null) return;

        // What the tray itself gets: the column, less the page's inset and the
        // margins the page and the tray each keep. The tray then takes off its
        // own list margin, which only it knows about.
        double margin = ClipboardTrayView.Margin.Left + ClipboardTrayView.Margin.Right
            + (SecondaryContent?.Margin.Left ?? 0) + (SecondaryContent?.Margin.Right ?? 0);
        double column = Math.Max(0, DockColumnDepth - ExpandedContentHorizontalInset - margin);

        ClipboardTrayView.SetColumnLayout(vertical, column, NavigationRowHeight);
    }

    /// <summary>
    /// The collapsed pill along its edge. Every docked size is derived from it,
    /// so changing the notch's size in settings changes the pages with it.
    /// </summary>
    private double DockPillLength => _settings.EnableDynamicIslandMode
        ? _settings.DynamicIslandWidth
        : _settings.Width;

    /// <summary>How deep the column reaches into the desktop.</summary>
    private double DockColumnDepth => NotchDock.Depth(DockPillLength, DockScreenDip);

    /// <summary>
    /// The media page across the top is two columns: the card, and an aside
    /// carrying lyrics, the calendar and the greeting. A side dock is a column
    /// of 300 to 420, which has no room for anything beside the cover, so the
    /// aside stands down and the card takes the whole width.
    ///
    /// Transposing the page wholesale was tried and is wrong: its blurred cover
    /// backdrops and lyrics canvas are layers pinned to particular columns, and
    /// turning the grid scatters them across the page.
    /// </summary>
    private void ApplyMediaPageOrientation(bool vertical)
    {
        if (MediaPageAsideColumn != null)
        {
            _authoredAsideWidth ??= MediaPageAsideColumn.Width;
            MediaPageAsideColumn.Width = vertical ? new GridLength(0) : _authoredAsideWidth.Value;
        }

        // Zero width alone is not enough: the calendar and greeting inside
        // still report a height, which the page would then be padded out to.
        if (MediaPageAside != null)
            MediaPageAside.Visibility = vertical ? Visibility.Collapsed : Visibility.Visible;

        ApplyMediaCardOrientation(vertical);
    }

    /// <summary>
    /// The card reads cover, then what is playing, then the controls. Across
    /// the top that runs left to right; down a side it runs top to bottom, and
    /// the cover grows into the width instead of staying a thumbnail.
    /// </summary>
    private void ApplyMediaCardOrientation(bool vertical)
    {
        GridFlip.SetVertical(MediaCardRow, vertical);

        if (MediaWidgetContainer != null)
        {
            // The card is pulled a little left of its column so it sits against
            // the shell's edge in the wide layout. Centred in a column of its
            // own, that pull only clips it. In its place the card drops below
            // the navigation row, which floats over the page and would
            // otherwise sit on top of the cover.
            _authoredCardOffset ??= MediaWidgetContainer.Margin;
            MediaWidgetContainer.Margin = vertical
                ? new Thickness(0, NavigationRowHeight, 0, 0)
                : _authoredCardOffset.Value;
        }

        if (MediaWidget != null)
        {
            _authoredCardPadding ??= MediaWidget.Padding;
            // The authored padding is lighter on the side the text runs out to.
            // Standing the card up makes every side an outer edge.
            MediaWidget.Padding = vertical
                ? new Thickness(_authoredCardPadding.Value.Left)
                : _authoredCardPadding.Value;
        }

        double column = DockCardContentWidth;

        // Above the text the cover takes its share of the column, leaving a
        // margin either side and a centre line for everything below it to sit
        // on; beside the text it is the thumbnail the page was authored with.
        double cover = vertical ? Math.Round(column * NotchDock.CoverShareOfColumn) : 0;

        if (ThumbnailBorder != null)
        {
            _authoredCoverSize ??= ThumbnailBorder.Width;
            ResizeCover(vertical ? cover : _authoredCoverSize.Value);
            ThumbnailBorder.HorizontalAlignment = vertical ? HorizontalAlignment.Center : HorizontalAlignment.Stretch;
        }

        if (InlineControls != null)
            InlineControls.HorizontalAlignment = vertical ? HorizontalAlignment.Center : HorizontalAlignment.Right;

        if (MediaPlayback != null)
        {
            // The block below the cover is the cover's width, so the title, the
            // timeline and the transport all line up with its edges.
            MediaPlayback.ColumnWidth = vertical ? cover : VNotch.Controls.MediaPlaybackView.DefaultColumnWidth;
            MediaPlayback.CentreInColumn = vertical;
        }

        // The top row carries the navigation on one side and the status buttons
        // on the other. A column has no width to spare for an indent, so the
        // navigation takes the centre and the status buttons keep their corner.
        if (NavTabsStackPanel != null)
        {
            ApplyNavigationClearance(vertical);
        }

    }

    /// <summary>
    /// Grow the cover and everything cut to its shape together. The frame, the
    /// artwork and the rounded clip were each authored at the same size, so
    /// moving one alone leaves a small picture in a large empty frame.
    /// </summary>
    private void ResizeCover(double size)
    {
        if (ThumbnailBorder == null || !(size > 0)) return;

        _authoredCoverSize ??= ThumbnailBorder.Width;
        ThumbnailBorder.Width = size;
        ThumbnailBorder.Height = size;

        if (ThumbnailClipHost != null)
        {
            ThumbnailClipHost.Width = size;
            ThumbnailClipHost.Height = size;
        }

        foreach (var image in new[] { ThumbnailImage, ThumbnailImageNext })
        {
            if (image == null) continue;
            image.Width = size;
            image.Height = size;
        }

        if (ThumbnailClip != null)
        {
            _authoredCoverRadius ??= ThumbnailClip.RadiusX;
            // The corner keeps its share of the cover rather than a fixed
            // radius, so a large cover is not nearly square.
            double authored = _authoredCoverSize.Value;
            double radius = authored > 0 ? _authoredCoverRadius.Value * size / authored : _authoredCoverRadius.Value;
            ThumbnailClip.Rect = new Rect(0, 0, size, size);
            ThumbnailClip.RadiusX = radius;
            ThumbnailClip.RadiusY = radius;
            ThumbnailBorder.CornerRadius = new CornerRadius(radius);
        }
    }

    /// <summary>
    /// The icon row shares its line with the status corner, which floats over
    /// the same strip. Across the top there is width to spare; in a column
    /// there is not, so the icons centre in what is left once that corner has
    /// taken its room. Settled again as a page opens, because the corner only
    /// has a width once it has been shown.
    /// </summary>
    private void ApplyNavigationClearance(bool vertical)
    {
        if (NavTabsStackPanel == null) return;

        _authoredNavMargin ??= NavTabsStackPanel.Margin;
        _authoredNavAlignment ??= NavTabsStackPanel.HorizontalAlignment;
        var authored = _authoredNavMargin.Value;

        NavTabsStackPanel.HorizontalAlignment = vertical ? HorizontalAlignment.Left : _authoredNavAlignment.Value;
        NavTabsStackPanel.Margin = vertical
            ? new Thickness(0, authored.Top, 0, authored.Bottom)
            : authored;
        if (DockNavigation != null)
        {
            double statusWidth = StatusCornerWidth;
            DockNavigation.SetColumnWidth(vertical
                ? Math.Max(48, DockColumnDepth - ExpandedContentHorizontalInset - statusWidth - 24)
                : double.NaN);
            DockNavigation.HorizontalAlignment = HorizontalAlignment.Left;
            DockNavigation.Margin = vertical ? new Thickness(12, 0, statusWidth, 0) : default;
        }
    }

    /// <summary>
    /// Keep the card below the floating navigation row. Called again as a page
    /// opens, because the row only has a height once it has been shown.
    /// </summary>
    private void ApplyMediaCardClearance(bool vertical)
    {
        ApplyNavigationClearance(vertical);

        if (MediaWidgetContainer == null) return;

        _authoredCardOffset ??= MediaWidgetContainer.Margin;
        MediaWidgetContainer.Margin = vertical
            ? new Thickness(0, NavigationRowHeight, 0, 0)
            : _authoredCardOffset.Value;
    }

    private double? _authoredCoverSize;
    private double? _authoredCoverRadius;
    private Thickness? _authoredCardPadding;
    private Thickness? _authoredCardOffset;
    private GridLength? _authoredAsideWidth;
    private Thickness? _authoredNavMargin;
    private HorizontalAlignment? _authoredNavAlignment;

    /// <summary>
    /// The width the media card has to work with: the column, less the page's
    /// inset and the card's own padding.
    /// </summary>
    private double DockCardContentWidth
    {
        get
        {
            double padding = (_authoredCardPadding ?? MediaWidget?.Padding ?? default).Left * 2;
            return Math.Max(0, DockColumnDepth - ExpandedContentHorizontalInset - padding);
        }
    }

    /// <summary>
    /// Stand a row of content on end, carrying each item's gaps round with it
    /// so the rhythm between them is kept.
    /// </summary>
    private static void FlipStack(StackPanel? stack, bool vertical)
    {
        if (stack == null) return;

        var wanted = vertical ? Orientation.Vertical : Orientation.Horizontal;
        if (stack.Orientation == wanted) return;
        stack.Orientation = wanted;

        foreach (var child in stack.Children)
        {
            if (child is FrameworkElement element) element.Margin = Transpose(element.Margin);
        }
        stack.Margin = Transpose(stack.Margin);
    }

    private static Thickness Transpose(Thickness thickness)
        => new(thickness.Top, thickness.Left, thickness.Bottom, thickness.Right);

    /// <summary>
    /// The clock page is a face with a column of dates beside it. A column has
    /// room for one or the other, so the face stands on top of the dates.
    /// </summary>
    private void ApplyTimerOrientation(bool vertical)
    {
        if (DockTimerScroll != null)
            DockTimerScroll.VerticalScrollBarVisibility = vertical
                ? ScrollBarVisibility.Auto : ScrollBarVisibility.Disabled;
        GridFlip.SetVertical(ClockViewHeader, vertical);
        // The side page has its own small wall-clock caption above the dial.
        // Keep the authored clock/calendar composition intact across the top.
        ClockViewHeader.Visibility = vertical ? Visibility.Collapsed : Visibility.Visible;
        TimerPageFlow.RowDefinitions[0].Height = vertical ? GridLength.Auto : new GridLength(1, GridUnitType.Star);

        // Seven day columns across a 180 column gives each one the width of a
        // couple of characters. The month line already carries the date, so
        // the grid stands down rather than being squeezed into nonsense.
        var calendar = vertical ? Visibility.Collapsed : Visibility.Visible;
        if (ClockViewWeekHeader != null) ClockViewWeekHeader.Visibility = calendar;
        if (ClockViewDayGrid != null) ClockViewDayGrid.Visibility = calendar;

        CountdownWidget?.SetCompact(vertical);

        // Across the top the row's last cell takes the slack. Standing up, that
        // slack becomes a gap down the middle of the page, so nothing stretches
        // and the clock, the date and the transport sit together.
        if (vertical && ClockViewHeader != null)
        {
            foreach (var row in ClockViewHeader.RowDefinitions)
                if (row.Height.IsStar) row.Height = GridLength.Auto;
        }

        // Under the clock the date reads as a caption, so it sits on the same
        // centre line rather than against the left edge it had beside it.
        if (ClockViewDateColumn != null)
        {
            _authoredDateAlignment ??= ClockViewDateColumn.HorizontalAlignment;
            ClockViewDateColumn.HorizontalAlignment = vertical
                ? HorizontalAlignment.Center
                : _authoredDateAlignment.Value;
        }

        if (ClockViewMonthText != null)
        {
            _authoredMonthAlignment ??= ClockViewMonthText.TextAlignment;
            ClockViewMonthText.TextAlignment = vertical ? TextAlignment.Center : _authoredMonthAlignment.Value;
        }

    }

    /// <summary>
    /// The mixer's list is authored at a fixed width. It has to be told the
    /// column, because nothing inside it would otherwise narrow.
    /// </summary>
    private void ApplyAudioOrientation(bool vertical)
    {
        if (AudioContent == null) return;

        // The page itself, not only the list inside it: it is authored 682 wide
        // and several paths set that again, which left the sliders sitting off
        // the end of the column with only the names showing.
        _authoredAudioWidth ??= AudioContent.Width;
        AudioContent.Width = vertical
            ? Math.Max(0, DockColumnDepth - ExpandedContentHorizontalInset)
            : _authoredAudioWidth.Value;

        AudioContent.SetColumnWidth(vertical ? PageContentWidth(AudioContent) : double.NaN);
    }

    /// <summary>
    /// The agent dashboard is two cards across with its title and its filters
    /// each sharing a line. In a column it becomes one card across and both
    /// header lines stand up.
    /// </summary>
    private void ApplyAgentsOrientation(bool vertical) => AgentDashboardView?.SetColumnLayout(vertical);

    /// <summary>
    /// The room a page has inside the column, once the shell's inset and the
    /// page's own margins have taken theirs.
    /// </summary>
    private double PageContentWidth(FrameworkElement page)
    {
        double margin = page.Margin.Left + page.Margin.Right;
        return Math.Max(0, DockColumnDepth - ExpandedContentHorizontalInset - margin);
    }

    /// <summary>
    /// The compact pill is a row - artwork, the title that marches past, the
    /// visualiser - sized for a pill that is long across. A side edge gives it
    /// the pill's breadth across and its length down, which a row of artwork
    /// and visualiser cannot fit: both ends fall off and neither is drawn.
    ///
    /// Standing the row up puts the artwork above the visualiser with the title
    /// stood down, because a column that narrow has nowhere for a title to run.
    /// The cells are the ones that were authored, read the other way, so coming
    /// back to the top edge restores the row exactly.
    ///
    /// Only the cells are set here. Every margin and alignment inside the pill
    /// belongs to <see cref="ApplyDynamicIslandContentAlignment"/>, which runs
    /// again on each change of mode and would overwrite anything set here.
    /// </summary>
    private void ApplyCompactPillOrientation(bool vertical)
    {
        var pill = MusicCompactContent;
        if (pill == null) return;

        _authoredPill ??= CapturePill(pill);
        var authored = _authoredPill.Value;

        pill.RowDefinitions.Clear();
        pill.ColumnDefinitions.Clear();

        if (!vertical)
        {
            foreach (var row in authored.Rows) pill.RowDefinitions.Add(new RowDefinition { Height = row });
            foreach (var column in authored.Columns) pill.ColumnDefinitions.Add(new ColumnDefinition { Width = column });
            PlaceInPill(pill, authored, transposed: false);
            RestoreAuthoredCompactArtwork();
            RestoreAuthoredVisualiser();
            if (CompactHoverInfo != null) CompactHoverInfo.Visibility = authored.HoverInfo;
            return;
        }

        // A badge is one cell. The artwork sits in the middle and the
        // visualiser is laid over it as a ring, so they share the cell rather
        // than queueing up in it.
        pill.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        pill.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        foreach (UIElement child in pill.Children)
        {
            Grid.SetRow(child, 0);
            Grid.SetRowSpan(child, 1);
            Grid.SetColumn(child, 0);
            Grid.SetColumnSpan(child, 1);
        }

        ApplyBadge();

        // The title runs the length of the pill, which is now its breadth. It
        // has no room at all, and left visible it would sit over the artwork.
        if (CompactHoverInfo != null) CompactHoverInfo.Visibility = Visibility.Collapsed;
    }

    /// <summary>
    /// Size the badge: the artwork takes its share of the circle and is rounded
    /// right off, and the visualiser fills the whole circle so its ring falls
    /// in the gap left around the artwork.
    /// </summary>
    private void ApplyBadge()
    {
        double badge = GetCollapsedWidth();
        if (!(badge > 0)) return;

        double artwork = Math.Round(badge * NotchDock.BadgeArtworkShare);
        ResizeCompactArtwork(artwork, artwork / 2);

        if (MusicViz == null) return;
        _authoredVisualiser ??= (MusicViz.Width, MusicViz.Height, MusicViz.Margin);
        MusicViz.Radial = true;
        MusicViz.Width = badge;
        MusicViz.Height = badge;
        MusicViz.Margin = new Thickness(0);
    }

    /// <summary>
    /// Put the visualiser back to the row of bars it was authored as.
    /// </summary>
    private void RestoreAuthoredVisualiser()
    {
        if (MusicViz == null) return;

        MusicViz.Radial = false;
        if (_authoredVisualiser is not { } authored) return;

        MusicViz.Width = authored.Width;
        MusicViz.Height = authored.Height;
        MusicViz.Margin = authored.Margin;
    }

    /// <summary>
    /// The artwork in the collapsed pill, and everything cut to its shape. Like
    /// the expanded cover, the frame, the clip and both images were authored at
    /// one size and have to move together.
    /// </summary>
    private void ResizeCompactArtwork(double size, double radius)
    {
        if (CompactThumbnailBorder == null || !(size > 0)) return;

        _authoredCompactArtwork ??= (CompactThumbnailBorder.Width, CompactThumbnailClip?.RadiusX ?? 0);

        CompactThumbnailBorder.Width = size;
        CompactThumbnailBorder.Height = size;
        CompactThumbnailBorder.CornerRadius = new CornerRadius(radius);

        if (CompactThumbnailClipHost != null)
        {
            CompactThumbnailClipHost.Width = size;
            CompactThumbnailClipHost.Height = size;
        }

        foreach (var image in new[] { CompactThumbnail, CompactThumbnailNext })
        {
            if (image == null) continue;
            image.Width = size;
            image.Height = size;
        }

        if (CompactThumbnailClip != null)
        {
            CompactThumbnailClip.Rect = new Rect(0, 0, size, size);
            CompactThumbnailClip.RadiusX = radius;
            CompactThumbnailClip.RadiusY = radius;
        }

        if (CompactThumbnailRim != null) CompactThumbnailRim.CornerRadius = new CornerRadius(radius);
    }

    private void RestoreAuthoredCompactArtwork()
    {
        if (_authoredCompactArtwork is not { } authored) return;

        ResizeCompactArtwork(authored.Size, authored.Radius);
    }

    private (double Size, double Radius)? _authoredCompactArtwork;
    private (double Width, double Height, Thickness Margin)? _authoredVisualiser;

    private static void PlaceInPill(Grid pill, PillLayout authored, bool transposed)
    {
        for (int i = 0; i < pill.Children.Count && i < authored.Slots.Length; i++)
        {
            var slot = authored.Slots[i];
            var child = pill.Children[i];
            Grid.SetRow(child, transposed ? slot.Column : slot.Row);
            Grid.SetRowSpan(child, transposed ? slot.ColumnSpan : slot.RowSpan);
            Grid.SetColumn(child, transposed ? 0 : slot.Column);
            Grid.SetColumnSpan(child, transposed ? 1 : slot.ColumnSpan);
        }
    }

    private static PillLayout CapturePill(Grid pill)
    {
        var slots = new PillSlot[pill.Children.Count];
        for (int i = 0; i < pill.Children.Count; i++)
        {
            var child = pill.Children[i];
            slots[i] = new PillSlot(
                Grid.GetRow(child), Grid.GetRowSpan(child),
                Grid.GetColumn(child), Grid.GetColumnSpan(child));
        }

        return new PillLayout(
            pill.RowDefinitions.Select(r => r.Height).ToArray(),
            pill.ColumnDefinitions.Select(c => c.Width).ToArray(),
            Visibility.Collapsed,
            slots);
    }

    private readonly record struct PillSlot(int Row, int RowSpan, int Column, int ColumnSpan);

    private readonly record struct PillLayout(
        GridLength[] Rows,
        GridLength[] Columns,
        Visibility HoverInfo,
        PillSlot[] Slots);

    private PillLayout? _authoredPill;
    private double? _authoredAudioWidth;
    private HorizontalAlignment? _authoredDateAlignment;
    private TextAlignment? _authoredMonthAlignment;

    #endregion

    #region Placement

    /// <summary>
    /// Re-place the host for the current edge and tell everything that tracks
    /// the notch on screen where it went.
    /// </summary>
    private void ApplyDockPlacement()
    {
        ApplyDockOrientation();
        PositionAtTop();
    }

    /// <summary>
    /// Pick up the edge and offset from a fresh settings snapshot.
    /// </summary>
    private void DockSettingsChanged(NotchSettings oldSettings, NotchSettings newSettings)
    {
        if (oldSettings.DockEdge == newSettings.DockEdge
            && oldSettings.EnableEdgeDocking == newSettings.EnableEdgeDocking)
            return;

        _notchManager.UpdateSettings(_settings);
        ApplyDockPlacement();
    }

    #endregion

    #region Picking the notch up and moving it

    /// <summary>
    /// True while Ctrl readies the compact pill. A press starts the gesture;
    /// the arming monitor leaves active text editors' shortcuts alone.
    /// </summary>
    /// <remarks>
    /// Asked of the system rather than of WPF. The notch never takes focus -
    /// its window is WS_EX_NOACTIVATE - so WPF can miss the key going back up
    /// and leave the notch believing the modifier is still held, after which
    /// it would never open on hover again.
    /// </remarks>
    internal bool IsDockPickUpArmed =>
        _settings.EnableEdgeDocking && DockPointerReader().ControlDown;

    /// <summary>
    /// True while a move is actually under way, for the hover timers and the
    /// glass motion state to stay out of the way. Holding Ctrl alone prepares
    /// the pill and suppresses hover, without starting a drag session.
    /// </summary>
    internal bool IsDockMoveInProgress => _isDockDragging || _isDockLanding;
    internal bool IsDockHoverSuppressed => DockGesture.SuppressesHover(IsDockMoveInProgress, IsDockPickUpArmed);

    private void UpdateDockArmingMonitor()
    {
        if (_cleanedUp || _settings?.EnableEdgeDocking != true) return;
        if (!_isExpanded && !_isMusicExpanded && !IsDockPickUpArmed && !NotchWrapper.IsMouseOver) return;
        if (_dockArmingTimer == null)
        {
            _dockArmingTimer = new DispatcherTimer(DispatcherPriority.Input, Dispatcher) { Interval = TimeSpan.FromMilliseconds(60) };
            _dockArmingTimer.Tick += (_, _) => UpdateDockArmingState();
        }
        _dockArmingTimer.Start();
    }

    private void UpdateDockArmingState()
    {
        if (_cleanedUp || !_settings.EnableEdgeDocking)
        {
            _dockArmingTimer?.Stop();
            return;
        }
        bool armed = IsDockPickUpArmed;
        if (armed && !IsDockMoveInProgress)
        {
            _dockWasArmed = true;
            _hoverCollapseTimer.Stop();
            _hoverThumbnailDelayTimer.Stop();
            // A held Ctrl prepares the collapsed pill even without mouse
            // movement. Keep normal text editing shortcuts usable, however.
            if ((_isExpanded || _isMusicExpanded) && !_isGreetingActive && !_isDebugViewLocked &&
                !_spotlightMorphSessionActive && !_spotlightMorphOwnsNotchVisibility &&
                Keyboard.FocusedElement is not System.Windows.Controls.Primitives.TextBoxBase)
                CollapseNotch();
        }
        UpdateDockPickUpAffordance();
        if (!armed && !IsDockMoveInProgress && !_isExpanded && !_isMusicExpanded)
        {
            if (!NotchWrapper.IsMouseOver) _dockArmingTimer?.Stop();
            bool restoreHover = _dockWasArmed;
            _dockWasArmed = false;
            if (restoreHover && NotchWrapper.IsMouseOver && !_isAnimating) QueueHoverExpand();
        }
    }

    /// <summary>
    /// Take hold of the notch so the cursor can move it. Returns false when the
    /// press was not a move, so the caller keeps its own handling.
    /// </summary>
    private bool BeginDockPickUp()
    {
        var input = DockPointerReader();
        if (!_settings.EnableEdgeDocking || !input.ControlDown || !input.LeftDown ||
            _isDockDragging || _cleanedUp || _isGreetingActive || _isDebugViewLocked ||
            _spotlightMorphSessionActive || _spotlightMorphOwnsNotchVisibility) return false;
        if (!TryGetDockScreen(out var screen)) return false;
        var origin = NotchBorder.PointToScreen(new Point());
        var end = NotchBorder.PointToScreen(new Point(NotchBorder.ActualWidth, NotchBorder.ActualHeight));
        if (end.X <= origin.X || end.Y <= origin.Y) return false;
        _dockGrabFraction = new Point(Math.Clamp((input.Position.X - origin.X) / (end.X - origin.X), 0, 1),
            Math.Clamp((input.Position.Y - origin.Y) / (end.Y - origin.Y), 0, 1));
        _dockDrag = new DockDragSession(DockEdge, input.Position, screen,
            System.Windows.Media.VisualTreeHelper.GetDpi(this).DpiScaleX);
        ++_dockMoveVersion;
        _dockNeedsSettle = _isDockLanding;
        StopDockLandingFrames();
        _isDockLanding = false;
        _dockDidMove = false;
        _dockForegroundTarget = null;
        _dockPreviewTarget = null;
        _dockPreviewSettled = false;
        // Capture a stable ancestor. A timer scoped to this gesture covers
        // no-activate capture failures and release outside the painted shell.
        bool captured = Mouse.Capture(this, CaptureMode.SubTree);

        _hoverCollapseTimer.Stop();
        _hoverThumbnailDelayTimer.Stop();
        _isDockDragging = true;
        _dockDragTimer ??= CreateDockDragTimer();
        _dockDragTimer.Start();
        StartDockDragFrames();
        UpdateGlassMotionState();
        UpdateDockPickUpAffordance();
        RuntimeLog.Log(DockLogTag, $"picked up (capture={captured})");
        return true;
    }

    private bool IsPointOnDockShell(Point screenPoint)
    {
        var point = NotchBorder.PointFromScreen(screenPoint);
        return point.X >= 0 && point.Y >= 0 && point.X <= NotchBorder.ActualWidth && point.Y <= NotchBorder.ActualHeight;
    }

    private void Window_DockPreviewMouseDown(object sender, MouseButtonEventArgs e)
    {
        // Collapse temporarily disables content hit testing. The stable window
        // must still accept a Ctrl grab on the visible shell during that morph.
        if (e.ChangedButton == MouseButton.Left && IsDockPickUpArmed &&
            CanPickUpDockFrom(e.OriginalSource as DependencyObject) &&
            IsPointOnDockShell(DockPointerReader().Position) && BeginDockPickUp())
            e.Handled = true;
    }

    private bool CanPickUpDockFrom(DependencyObject? source)
    {
        if (!IsDockPickUpArmed) return false;
        if (!_isExpanded && !_isMusicExpanded) return true;
        if (IsInteractiveControl(source)) return false;
        for (var node = source; node != null && node != NotchWrapper; node = InputParent(node))
            if (node is VNotch.Controls.ActionBorder) return false;
        return true;
    }

    private DispatcherTimer CreateDockDragTimer()
    {
        // Only a release/occlusion watchdog. Position updates belong to the
        // rendering clock, which naturally follows the monitor's refresh rate.
        var timer = new DispatcherTimer(DispatcherPriority.Input, Dispatcher) { Interval = TimeSpan.FromMilliseconds(100) };
        timer.Tick += (_, _) =>
        {
            if (_isDockDragging)
            {
                var input = DockPointerReader();
                if (!IsVisible || input.EscapeDown || !input.LeftDown) ContinueDockDrag();
            }
            else if (_isDockLanding && _dockLandingRendering != null &&
                (!IsVisible || Stopwatch.GetElapsedTime(_dockLandingLastFrameTicks).TotalMilliseconds > 250))
                StopDockLandingFrames();
        };
        return timer;
    }

    private void StartDockDragFrames()
    {
        StopDockDragFrames();
        int version = _dockMoveVersion;
        TimeSpan last = TimeSpan.MinValue;
        _dockDragRendering = (_, args) =>
        {
            if (version != _dockMoveVersion || !_isDockDragging) return;
            if (args is RenderingEventArgs rendering)
            {
                if (rendering.RenderingTime == last) return;
                last = rendering.RenderingTime;
            }
            ContinueDockDrag((args as RenderingEventArgs)?.RenderingTime);
        };
        CompositionTarget.Rendering += _dockDragRendering;
    }

    private void StopDockDragFrames()
    {
        if (_dockDragRendering != null) CompositionTarget.Rendering -= _dockDragRendering;
        _dockDragRendering = null;
    }

    /// <summary>
    /// Capture can be taken away - another window grabs it, or the notch hides
    /// itself for a fullscreen app - and then no button-up ever arrives here.
    /// Without this the move stays in progress forever and the notch stops
    /// opening on hover, which is exactly how it behaves when it is broken.
    /// </summary>
    private void NotchWrapper_LostMouseCapture(object sender, MouseEventArgs e)
    {
        // Physical button state still ends/cancels the session after capture
        // changes. Losing capture must not strand a drag or stop it mid-move.
        if (_isDockDragging) RuntimeLog.Log(DockLogTag, "capture changed; tracking physical button until release");
    }

    /// <summary>
    /// Reflect move readiness in the cursor. The arming monitor owns collapse,
    /// so cursor updates never rebuild the layout under an active grab.
    /// </summary>
    private void UpdateDockPickUpAffordance()
    {
        var wanted = DockGesture.OffersPickUp(IsDockMoveInProgress, IsDockPickUpArmed)
            ? Cursors.SizeAll
            : Cursors.Hand;
        if (NotchWrapper.Cursor != wanted) NotchWrapper.Cursor = wanted;
    }

    /// <summary>
    /// Preview the candidate shape while retaining the source layout and grab.
    /// </summary>
    /// <returns>true when the move consumed the event</returns>
    private bool ContinueDockDrag(TimeSpan? renderTime = null)
    {
        if (!_isDockDragging || _dockDrag == null) return false;
        var input = DockPointerReader();
        if (input.EscapeDown || !IsVisible) { FinishDockDrag(true); return true; }
        _dockDrag.Update(input.Position);
        StartDockDragMotion();
        UpdateDockDragForeground();
        if (!input.LeftDown) { FinishDockDrag(false); return true; }
        if (!_dockDrag.HasMoved) return true;
        bool preview = renderTime.HasValue && PrepareDockDragPreview(renderTime.Value);
        var origin = NotchBorder.PointToScreen(new Point());
        var end = NotchBorder.PointToScreen(new Point(NotchBorder.ActualWidth, NotchBorder.ActualHeight));
        var previousPixels = new Size(Math.Max(0, end.X - origin.X), Math.Max(0, end.Y - origin.Y));
        var localOrigin = origin - new Vector(_fixedX, _fixedY);
        if (preview)
        {
            AdvanceDockDragPreview(renderTime!.Value);
            var dpi = VisualTreeHelper.GetDpi(this);
            var nextPixels = new Size(NotchBorder.Width * dpi.DpiScaleX, NotchBorder.Height * dpi.DpiScaleY);
            MoveDockHost(DockDragSession.PreviewHostPosition(input.Position, localOrigin,
                previousPixels, nextPixels, _dockGrabFraction, DockEdge));
        }
        else MoveDockHost(DockDragSession.HostPosition(input.Position, localOrigin, previousPixels, _dockGrabFraction));
        return true;
    }

    private void StartDockDragMotion()
    {
        if (_dockDrag?.HasMoved != true || _dockDidMove) return;
        _dockDidMove = true;
        _gestureController.CancelTracking();
        _isGestureActive = false;
        FadeDockEars(0, 90);
        if (_isExpanded || _isMusicExpanded) CollapseNotch();
    }

    private void UpdateDockDragForeground()
    {
        if (_dockDrag?.HasMoved != true || _dockForegroundTarget == _dockDrag.Target) return;
        _dockForegroundTarget = _dockDrag.Target;
        // Keep artwork with the hand while its layout is unchanged. Fade only
        // when the candidate edge asks for an orientation handoff.
        if (_dockDrag.Target == _dockDrag.Source && _dockContentsSuspended) return;
        FadeDockForeground(_dockDrag.Target == _dockDrag.Source ? 1 : 0, 90);
    }

    private Size DockPreviewSize(NotchEdge edge) => NotchDock.CollapsedSize(edge,
        _settings.EnableDynamicIslandMode ? _settings.DynamicIslandWidth : _settings.Width,
        _settings.EnableDynamicIslandMode ? _settings.DynamicIslandHeight : _settings.Height);

    private CornerRadius DockPreviewRadius(NotchEdge edge, Size size)
    {
        double radius = _settings.EnableDynamicIslandMode || NotchDock.IsVertical(edge)
            ? Math.Min(size.Width, size.Height) / 2 : _settings.CornerRadius;
        return _settings.EnableDynamicIslandMode ? new CornerRadius(radius) : NotchDock.Radius(edge, radius);
    }

    private bool PrepareDockDragPreview(TimeSpan renderTime)
    {
        if (_isAnimating || _dockDrag == null) return false;
        var target = _dockDrag.Target;
        if (_dockPreviewTarget == target) return true;
        if (_dockPreviewTarget == null && target == _dockDrag.Source && !_dockContentsSuspended) return false;
        // Let the old artwork fade before its row would be squeezed into a
        // badge. Reversing before that fade finishes leaves the row intact.
        if (!_dockContentsSuspended && NotchLiveContent.Opacity > .02) return false;
        SuspendDockContentLayout();
        var top = DockPreviewSize(NotchEdge.Top);
        var side = DockPreviewSize(NotchEdge.Left);
        if (_overlayWindow.EnsureSurfaceSize(new Size(
            Math.Max(top.Width, side.Width) + NotchDock.AlongEdgePadding,
            Math.Max(top.Height, side.Height) + NotchDock.AwayFromEdgePadding))) UpdateLayout();
        _dockPreviewFromSize = new Size(NotchBorder.ActualWidth, NotchBorder.ActualHeight);
        _dockPreviewFromRadius = NotchBorder.CornerRadius;
        NotchBorder.BeginAnimation(WidthProperty, null);
        NotchBorder.BeginAnimation(HeightProperty, null);
        NotchBorder.Width = _dockPreviewFromSize.Width;
        NotchBorder.Height = _dockPreviewFromSize.Height;
        _dockPreviewToSize = DockPreviewSize(target);
        _dockPreviewToRadius = DockPreviewRadius(target, _dockPreviewToSize);
        _dockPreviewTarget = target;
        _dockPreviewStarted = renderTime;
        _dockPreviewSettled = false;
        return true;
    }

    private void AdvanceDockDragPreview(TimeSpan renderTime)
    {
        if (_dockPreviewSettled) return;
        double progress = AnimationConfig.ReduceMotion ? 1 : Math.Clamp((renderTime - _dockPreviewStarted).TotalMilliseconds / 180, 0, 1);
        SetDockShellFrame(_dockPreviewFromSize, _dockPreviewToSize, _dockPreviewFromRadius,
            _dockPreviewToRadius, DockDragSession.LandingEase(progress));
        if (progress < 1) return;
        _dockPreviewSettled = true;
        if (_dockDrag?.Target == _dockDrag?.Source)
        {
            RestoreDockContentLayout();
            FadeDockForeground(1, 140);
        }
    }

    private void MoveDockHost(Point point)
    {
        int x = (int)Math.Round(point.X), y = (int)Math.Round(point.Y);
        if (x == _fixedX && y == _fixedY) return;
        _overlayWindow.MoveFixedPosition(x, y);
        _liquidGlass?.SetLiveRegion(GetGlassCaptureRegion());
    }

    /// <summary>Put the notch down and remember where it was left.</summary>
    /// <returns>true when a move was in progress, so no click should follow</returns>
    private bool EndDockDrag()
    {
        if (!_isDockDragging) return false;
        _dockDrag?.Update(DockPointerReader().Position);
        StartDockDragMotion();
        UpdateDockDragForeground();
        FinishDockDrag(false);
        return true;
    }

    private void FinishDockDrag(bool cancelled)
    {
        var drag = _dockDrag;
        if (!_isDockDragging || drag == null) return;
        _isDockDragging = false;
        _isDockLanding = true;
        _dockDrag = null;
        StopDockDragFrames();
        if (ReferenceEquals(Mouse.Captured, this) || ReferenceEquals(Mouse.Captured, NotchWrapper)) Mouse.Capture(null);
        CompleteDockLandingAsync(cancelled ? drag.Source : drag.Target, cancelled,
            drag.HasMoved || _dockNeedsSettle, _dockMoveVersion).SafeFireAndForget("DOCK-LANDING");
    }

    private async Task CompleteDockLandingAsync(NotchEdge target, bool cancelled, bool moved, int version)
    {
        try
        {
            if (!moved) return;
            var source = DockEdge;
            // Wait out a quick-release collapse so its callbacks cannot put
            // the old horizontal pill's size back onto the new side badge.
            while (_isAnimating)
            {
                if (_cleanedUp || version != _dockMoveVersion) return;
                if (!cancelled && DockPointerReader().EscapeDown) { target = source; cancelled = true; }
                await Task.Delay(16);
            }
            if (_cleanedUp || version != _dockMoveVersion) return;
            var center = DockShellCenter();
            var fromSize = new Size(NotchBorder.ActualWidth, NotchBorder.ActualHeight);
            var fromRadius = NotchBorder.CornerRadius;
            // Compact media keeps its width clock after the reveal finishes.
            // Detach that owner at its live value before driving this morph.
            NotchBorder.BeginAnimation(WidthProperty, null);
            NotchBorder.BeginAnimation(HeightProperty, null);
            NotchBorder.Width = fromSize.Width;
            NotchBorder.Height = fromSize.Height;
            // Only the foreground fades. The black shell and glass layers
            // stay visible while the row is laid out as a column (or back).
            bool reflow = _dockContentsSuspended || target != DockEdge ||
                Math.Abs(fromSize.Width - _collapsedWidth) > .05 || Math.Abs(fromSize.Height - _collapsedHeight) > .05;
            if (reflow)
            {
                FadeDockContents(0, 0);
                SuspendDockContentLayout();
            }
            _settings.DockEdge = target;
            _notchManager.UpdateSettings(_settings);
            ApplyDockPlacement();
            RefreshDockMenuState();
            var toSize = new Size(_collapsedWidth, _collapsedHeight);
            var toRadius = MakeNotchCornerRadius(_cornerRadiusCollapsed);
            SetDockShellFrame(fromSize, toSize, fromRadius, toRadius, 1);
            UpdateLayout();
            var destination = new Point(_fixedX, _fixedY);
            var destinationCenter = DockShellCenter();
            if (!AnimationConfig.ReduceMotion && IsVisible)
            {
                // Reparent onto the new axis in the same dispatcher turn,
                // retaining the live size and screen centre. There is no
                // painted frame of the final badge at the old location.
                SetDockShellFrame(fromSize, toSize, fromRadius, toRadius, 0);
                UpdateLayout();
                var start = destination + (center - DockShellCenter());
                MoveDockHost(start);
                double scale = VisualTreeHelper.GetDpi(this).DpiScaleX;
                double milliseconds = DockDragSession.LandingMilliseconds((destinationCenter - center).Length / scale);
                await AnimateDockLandingAsync(version, milliseconds, t =>
                {
                    SetDockShellFrame(fromSize, toSize, fromRadius, toRadius, t);
                    MoveDockHost(start + (destination - start) * t);
                });
            }
            if (_cleanedUp || version != _dockMoveVersion) return;
            SetDockShellFrame(fromSize, toSize, fromRadius, toRadius, 1);
            MoveDockHost(destination);
            _notchManager.UpdatePosition();
            if (!cancelled) _settingsService.SaveAsync(_settings).SafeFireAndForget("SETTINGS-SAVE");
            RuntimeLog.Log(DockLogTag, $"{(cancelled ? "cancelled" : "landed")} on {NotchDock.Describe(_settings.DockEdge)}");
        }
        finally
        {
            if (version == _dockMoveVersion)
            {
                StopDockLandingFrames();
                _dockDragTimer?.Stop();
                _isDockLanding = false;
                _dockNeedsSettle = false;
                RestoreDockContentLayout();
                FadeDockContents(1, 140);
                _hoverCollapseTimer.Stop();
                _hoverThumbnailDelayTimer.Stop();
                _suppressHoverCollapseUntilUtc = DateTime.UtcNow.AddMilliseconds(350);
                UpdateGlassMotionState();
                UpdateDockPickUpAffordance();
                UpdateDockArmingMonitor();
            }
        }
    }

    private Point DockShellCenter() =>
        NotchBorder.PointToScreen(new Point(NotchBorder.ActualWidth / 2, NotchBorder.ActualHeight / 2));

    private void SuspendDockContentLayout()
    {
        if (_dockContentsSuspended) return;
        _dockContentsVisibility = NotchLiveContent.Visibility;
        _dockContentsSuspended = true;
        // Opacity zero still measures and arranges the whole live UI. The
        // foreground is already faded out; exclude it from layout until the
        // shell settles, then arrange it once before bringing it back.
        NotchLiveContent.SetCurrentValue(VisibilityProperty, Visibility.Collapsed);
    }

    private void RestoreDockContentLayout()
    {
        if (!_dockContentsSuspended) return;
        _dockContentsSuspended = false;
        if (NotchLiveContent.Visibility == Visibility.Collapsed)
            NotchLiveContent.SetCurrentValue(VisibilityProperty, _dockContentsVisibility);
        if (!_cleanedUp) UpdateLayout();
    }

    private void FadeDockContents(double opacity, double milliseconds)
    {
        FadeDockEars(opacity, milliseconds);
        FadeDockForeground(opacity, milliseconds);
    }

    private void FadeDockEars(double opacity, double milliseconds)
    {
        // Ears belong to the edge, rather than to the floating shell. Keep
        // their authored opacity underneath the gesture's temporary clock.
        foreach (var ear in new[] { LeftEar, RightEar, LeftShadowEar, RightShadowEar })
        {
            double earFrom = ear.Opacity;
            double earTo = opacity == 0 ? 0 : (double)ear.GetAnimationBaseValue(OpacityProperty);
            ear.BeginAnimation(OpacityProperty, null);
            double duration = AnimationConfig.ReduceMotion ? 0 : milliseconds;
            if (opacity == 1 && duration <= 0) continue;
            ear.BeginAnimation(OpacityProperty, new DoubleAnimation(duration <= 0 ? earTo : earFrom, earTo,
                TimeSpan.FromMilliseconds(duration))
            {
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut },
                FillBehavior = opacity == 0 ? FillBehavior.HoldEnd : FillBehavior.Stop
            });
        }
    }

    private void FadeDockForeground(double opacity, double milliseconds)
    {
        double from = NotchLiveContent.Opacity;
        NotchLiveContent.BeginAnimation(OpacityProperty, null);
        NotchLiveContent.Opacity = opacity;
        if (milliseconds <= 0 || AnimationConfig.ReduceMotion || Math.Abs(from - opacity) < .001) return;
        NotchLiveContent.BeginAnimation(OpacityProperty, new DoubleAnimation(from, opacity,
            TimeSpan.FromMilliseconds(milliseconds))
        {
            EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut },
            FillBehavior = FillBehavior.Stop
        });
    }

    private void SetDockShellFrame(Size from, Size to, CornerRadius fromRadius, CornerRadius toRadius, double t)
    {
        static double Mix(double a, double b, double progress) => a + (b - a) * progress;
        double width = Mix(from.Width, to.Width, t), height = Mix(from.Height, to.Height, t);
        if (NotchBorder.Width != width) NotchBorder.Width = width;
        if (NotchBorder.Height != height) NotchBorder.Height = height;
        var radius = new CornerRadius(Mix(fromRadius.TopLeft, toRadius.TopLeft, t),
            Mix(fromRadius.TopRight, toRadius.TopRight, t),
            Mix(fromRadius.BottomRight, toRadius.BottomRight, t),
            Mix(fromRadius.BottomLeft, toRadius.BottomLeft, t));
        if (NotchBorder.CornerRadius != radius)
        {
            SyncShellCornerRadius(radius);
            _glassMaterialPresenter.SyncCornerRadius(radius);
            UpdateNotchClip();
        }
    }

    private Task AnimateDockLandingAsync(int version, double milliseconds, Action<double> frame)
    {
        var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _dockLandingCompletion = completion;
        var clock = Stopwatch.StartNew();
        _dockLandingLastFrameTicks = Stopwatch.GetTimestamp();
        TimeSpan lastRender = TimeSpan.MinValue;
        double elapsedMilliseconds = 0;
        _dockLandingRendering = (_, args) =>
        {
            // A detached handler may already be in the rendering dispatch's
            // invocation list. It must never stop a newer gesture's clock.
            if (version != _dockMoveVersion) return;
            if (_cleanedUp) { StopDockLandingFrames(); return; }
            if (args is RenderingEventArgs rendering)
            {
                if (rendering.RenderingTime == lastRender) return;
                if (lastRender != TimeSpan.MinValue)
                    elapsedMilliseconds += Math.Max(0, (rendering.RenderingTime - lastRender).TotalMilliseconds);
                lastRender = rendering.RenderingTime;
            }
            else elapsedMilliseconds = clock.Elapsed.TotalMilliseconds;
            _dockLandingLastFrameTicks = Stopwatch.GetTimestamp();
            double progress = AnimationConfig.ReduceMotion ? 1 : Math.Min(1, elapsedMilliseconds / milliseconds);
            frame(DockDragSession.LandingEase(progress));
            if (progress >= 1) StopDockLandingFrames();
        };
        CompositionTarget.Rendering += _dockLandingRendering;
        return completion.Task;
    }

    private void StopDockLandingFrames()
    {
        if (_dockLandingRendering != null) CompositionTarget.Rendering -= _dockLandingRendering;
        _dockLandingRendering = null;
        var completion = _dockLandingCompletion;
        _dockLandingCompletion = null;
        completion?.TrySetResult();
    }

    private void DisposeDockDrag()
    {
        ++_dockMoveVersion;
        StopDockDragFrames();
        StopDockLandingFrames();
        _dockDragTimer?.Stop();
        _dockArmingTimer?.Stop();
        _dockWasArmed = false;
        _isDockDragging = _isDockLanding = false;
        _dockDrag = null;
        _dockNeedsSettle = false;
        RestoreDockContentLayout();
        FadeDockContents(1, 0);
        if (ReferenceEquals(Mouse.Captured, this) || ReferenceEquals(Mouse.Captured, NotchWrapper)) Mouse.Capture(null);
    }

    /// <summary>
    /// Send the notch to an edge without a mouse, for the tray menu.
    /// </summary>
    internal void MoveDockTo(NotchEdge edge)
    {
        bool interrupted = IsDockMoveInProgress;
        if (interrupted)
        {
            DisposeDockDrag();
        }
        if (!interrupted && _settings.DockEdge == edge && _settings.EnableEdgeDocking)
        {
            RefreshDockMenuState();
            return;
        }

        _settings.EnableEdgeDocking = true;
        if (IsVisible && !_cleanedUp)
        {
            ++_dockMoveVersion;
            _isDockLanding = true;
            _dockDragTimer ??= CreateDockDragTimer();
            _dockDragTimer.Start();
            _hoverCollapseTimer.Stop();
            _hoverThumbnailDelayTimer.Stop();
            FadeDockContents(0, 90);
            if (_isExpanded || _isMusicExpanded) CollapseNotch();
            UpdateGlassMotionState();
            CompleteDockLandingAsync(edge, false, true, _dockMoveVersion).SafeFireAndForget("DOCK-MENU-LANDING");
            return;
        }
        _settings.DockEdge = edge;
        _notchManager.UpdateSettings(_settings);
        ApplyDockPlacement();
        RefreshDockMenuState();
        _settingsService.SaveAsync(_settings).SafeFireAndForget("SETTINGS-SAVE");
        RuntimeLog.Log(DockLogTag, $"moved to the {NotchDock.Describe(edge)} edge from the tray");
    }

    private void DockTop_Click(object sender, RoutedEventArgs e) => MoveDockTo(NotchEdge.Top);

    private void DockLeft_Click(object sender, RoutedEventArgs e) => MoveDockTo(NotchEdge.Left);

    private void DockRight_Click(object sender, RoutedEventArgs e) => MoveDockTo(NotchEdge.Right);

    /// <summary>
    /// The three tray entries are one choice, so exactly the current edge is
    /// ticked however the notch got there.
    /// </summary>
    private void RefreshDockMenuState()
    {
        var edge = DockEdge;
        if (MenuDockTop != null) MenuDockTop.IsChecked = edge == NotchEdge.Top;
        if (MenuDockLeft != null) MenuDockLeft.IsChecked = edge == NotchEdge.Left;
        if (MenuDockRight != null) MenuDockRight.IsChecked = edge == NotchEdge.Right;
    }

    private bool TryGetDockScreen(out Rect screen)
    {
        screen = DockScreen;
        return screen.Width > 0 && screen.Height > 0;
    }

    /// <summary>The display the notch is placed on, in physical pixels.</summary>
    private Rect DockScreen
    {
        get
        {
            var bounds = MonitorSelection.Resolve(_settings).Bounds;
            return new Rect(bounds.Left, bounds.Top, bounds.Width, bounds.Height);
        }
    }

    /// <summary>
    /// The same display measured the way content is. Page sizes are in
    /// device-independent units, so deciding how deep a column should be from
    /// physical pixels would make it half as wide again on a 150% display.
    /// </summary>
    private Rect DockScreenDip
    {
        get
        {
            var screen = MonitorSelection.Resolve(_settings);
            double scale = MonitorSelection.GetScale(screen);
            if (!(scale > 0)) scale = 1;
            var bounds = screen.Bounds;
            return new Rect(bounds.Left / scale, bounds.Top / scale, bounds.Width / scale, bounds.Height / scale);
        }
    }

    /// <summary>
    /// The size a view should morph to on the current edge. Across the top this
    /// is what the view asked for. Down a side the page has been transposed, so
    /// it becomes a readable column; how long that column is depends on the
    /// page, which is why the ones that size themselves to their content are
    /// measured rather than guessed at.
    /// </summary>
    private Size DockedViewSize(NotchView view, double width, double height)
    {
        var screen = DockScreenDip;
        if (!IsDockVertical) return NotchDock.ViewSize(DockEdge, width, height, DockPillLength, screen);

        double depth = DockColumnDepth;
        // Reapply width-dependent layouts before measuring. Changing notch size
        // or monitor DPI without changing edge must also resize the cover/list.
        ApplyMediaPageOrientation(true);
        if (view == NotchView.Timer) ApplyTimerOrientation(true);
        if (view == NotchView.AudioMixer) ApplyAudioOrientation(true);
        if (view == NotchView.Agents) ApplyAgentsOrientation(true);
        // Settle the card's clearance before measuring, not after: the gap the
        // navigation row needs is part of how long the page turns out to be,
        // and the row only has a height once it has been shown.
        ApplyMediaCardClearance(true);
        // The page sits inside the shell with an inset all round, so the shell
        // has to be that much longer than the page itself.
        double measureWidth = view == NotchView.Timer
            ? depth - TimerContent.Margin.Left - TimerContent.Margin.Right
            : depth - ExpandedContentHorizontalInset;
        double length = MeasureDockedLength(SelfSizingContent(view), measureWidth);
        if (length > 0) length += view == NotchView.Timer
            ? TimerContent.Margin.Top + TimerContent.Margin.Bottom
            : ExpandedContentVerticalInset;
        // A page that fills whatever it is given - a list, a grid of cards -
        // measures to nothing useful, so it keeps the budget it asked for
        // across the top and spends it down the side instead.
        if (!(length > 0)) length = view == NotchView.AudioMixer ? height : width;
        return new Size(depth, NotchDock.Length(length, DockPillLength, screen));
    }

    /// <summary>
    /// The size a view should take on the current edge, with the page inside it
    /// given the same treatment. Views reached through <c>ExpandNotch</c> get
    /// this at its one chokepoint; the clock and the mixer are switched to by
    /// paths of their own, which is why they went on being laid out for the top
    /// edge however the notch was docked. They ask here instead.
    /// </summary>
    /// <summary>
    /// The media page on the current edge, with the inner surface that goes
    /// with it. The direct switches back to media set both from the authored
    /// numbers, which on a side edge is a page laid out for the top inside a
    /// shell the width of a column - the content simply runs off the side.
    /// </summary>
    internal Size DockedPrimaryTarget(out double contentWidth, out double contentHeight)
    {
        var target = DockedViewTarget(NotchView.Media, _expandedWidth, _expandedHeight);
        contentWidth = target.Width - ExpandedContentHorizontalInset;
        contentHeight = target.Height - ExpandedContentVerticalInset;
        return target;
    }

    internal Size DockedViewTarget(NotchView view, double width, double height)
    {
        if (!IsDockVertical) return new Size(width, height);

        var docked = DockedViewSize(view, width, height);
        ResizeDockedContent(view, docked);
        return docked;
    }

    private int _timerSizeRequest;

    private void RefreshTimerSize() => RefreshTimerSizeAfterTransitionAsync(++_timerSizeRequest)
        .SafeFireAndForget("TIMER-LAYOUT");

    private async Task RefreshTimerSizeAfterTransitionAsync(int request)
    {
        // Mode changes during a resize must not be dropped, or a quick second
        // click can leave the focus footer clipped at the timer's old height.
        while (_isAnimating)
        {
            if (!IsVisible || !_isTimerView || request != _timerSizeRequest) return;
            await Task.Delay(35);
        }
        if (!IsVisible || !_isTimerView || request != _timerSizeRequest) return;
        if (!IsDockVertical)
        {
            PrepareClockViewContentSize();
            ApplyClockViewWindowSize();
        }
        var target = DockedViewTarget(NotchView.Timer, _clockViewWidth, _clockViewHeight);
        if (Math.Abs(NotchBorder.ActualHeight - target.Height) < 1) return;
        AnimateClockViewNotchResize(NotchBorder.ActualWidth, NotchBorder.ActualHeight,
            target.Width, target.Height, new Duration(TimeSpan.FromMilliseconds(220)), TimeSpan.Zero);
    }

    /// <summary>
    /// The content of a view that is as tall as what is in it, or null for one
    /// that lays itself out at whatever size the shell hands it.
    /// </summary>
    private FrameworkElement? SelfSizingContent(NotchView view) => view switch
    {
        NotchView.Media or NotchView.Compact => ExpandedContent,
        // Stood up, the clock page is as tall as the face plus the dates
        // under it, which is a good deal shorter than its wide budget.
        NotchView.Timer => TimerPageFlow,
        _ => null,
    };

    private static double MeasureDockedLength(FrameworkElement? content, double width)
    {
        if (content == null || width <= 0) return 0;

        // Two things stand in the way of a true answer. The page is still
        // collapsed at this point in the expand, and a collapsed element
        // measures to nothing; Hidden measures as normal and draws nothing.
        // And the page was last given an explicit size for the top edge, which
        // it would simply hand back, so that is lifted for the question.
        var visibility = content.Visibility;
        double fixedWidth = content.Width, fixedHeight = content.Height;
        if (visibility == Visibility.Collapsed) content.Visibility = Visibility.Hidden;
        content.Width = double.NaN;
        content.Height = double.NaN;
        try
        {
            // A cached measure from an earlier pass would be returned verbatim,
            // so the element is asked to work it out again at this width.
            content.InvalidateMeasure();
            content.Measure(new Size(width, double.PositiveInfinity));
            double measured = content.DesiredSize.Height;
            return double.IsFinite(measured) ? measured : 0;
        }
        finally
        {
            content.Width = fixedWidth;
            content.Height = fixedHeight;
            if (content.Visibility != visibility) content.Visibility = visibility;
        }
    }

    /// <summary>
    /// Views that lay themselves out at an explicit size were handed the one
    /// they asked for before the edge was taken into account. Give them the
    /// docked size instead.
    /// </summary>
    private void ResizeDockedContent(NotchView view, Size size)
    {
        // Remember the authored size first. The orientation passes below write
        // to some of these pages, so capturing after them would record a
        // column's width as the size the page was designed at.
        RememberAuthoredSize(view);

        // The clipboard's header clears the navigation row, whose height is only
        // known once it has been shown. Settle that each time the page opens.
        if (view == NotchView.Secondary) ApplyClipboardOrientation(IsDockVertical);

        // Settle the page's own layout each time it opens, not only when the
        // edge changes. A page that was never opened on this edge has had no
        // other chance to hear about it, and one whose content arrived later
        // would otherwise keep the shape it was authored with.
        if (view == NotchView.AudioMixer) ApplyAudioOrientation(IsDockVertical);
        if (view == NotchView.Timer) ApplyTimerOrientation(IsDockVertical);
        if (view == NotchView.Agents) ApplyAgentsOrientation(IsDockVertical);

        var content = DockedPageFor(view);
        if (content == null) return;

        double width = size.Width - content.Margin.Left - content.Margin.Right;
        double height = size.Height - content.Margin.Top - content.Margin.Bottom;
        if (!double.IsNaN(content.Width)) content.Width = Math.Max(0, width);
        if (!double.IsNaN(content.Height)) content.Height = Math.Max(0, height);
    }

    /// <summary>
    /// Hand every page a side edge resized back the size it was authored at.
    /// </summary>
    /// <summary>
    /// Note what a page was authored at, once, before anything resizes it.
    /// These are real numbers in the XAML - the clipboard is 888 across, the
    /// camera 488 - and nothing on the top edge would put them back.
    /// </summary>
    private void RememberAuthoredSize(NotchView view)
    {
        var content = DockedPageFor(view);
        if (content == null || _authoredContentSizes.ContainsKey(content)) return;

        _authoredContentSizes[content] = (content.Width, content.Height);
    }

    private FrameworkElement? DockedPageFor(NotchView view) => view switch
    {
        NotchView.Secondary => SecondaryContent,
        NotchView.Camera => CameraContent,
        NotchView.Agents => AgentContent,
        NotchView.AudioMixer => AudioContent,
        NotchView.Timer => TimerContent,
        _ => null,
    };

    private void RestoreAuthoredContentSizes()
    {
        foreach (var (content, authored) in _authoredContentSizes)
        {
            content.Width = authored.Width;
            content.Height = authored.Height;
        }

        _authoredContentSizes.Clear();
    }

    private readonly Dictionary<FrameworkElement, (double Width, double Height)> _authoredContentSizes = new();

    #endregion
}
