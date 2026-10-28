# Edge docking — move the notch to the left or right of the screen

This addition is on `edge-docking`, based on the completed AI Agent work. The
top edge remains the default and behaves exactly as it did; a settings file
without the new keys loads as `Top`, so nothing changes until you move it.

## Use

- **Hold Ctrl to ready the notch.** An open panel collapses without needing
  mouse movement and stays collapsed while Ctrl is held. The cursor over the
  pill becomes a move cursor. Active text editors retain their Ctrl shortcuts.
- **Ctrl + drag follows your hand.** A 6-DIP threshold rejects small hand
  jitter. The shell follows the grab point on the rendering clock as it shrinks,
  without extra native moves from high-polling mouse messages. Artwork stays
  visible when moving within the same edge. Its orientation stays
  stable during the drag; release to dock at the top/left/right. Position,
  capsule/badge dimensions and corner radii settle together over 220–420ms,
  depending on travel distance. Foreground content and edge flares fade during
  the axis change, keeping artwork from jumping or stretching. Grab again to
  interrupt a landing at its live position and shape. A 24-DIP boundary band
  stops the destination flickering. Releasing
  Ctrl first does not interrupt an active drag. **Esc cancels** the move.
- **Tray menu → Dock at top / Dock at left / Dock at right** does the same
  without a drag, including the morphing transition, and shows which edge is
  current. Reduced motion places the shell immediately.
- The notch is always centred on its edge. There is one decision to make and
  nowhere lopsided to leave it.

Ctrl is required rather than a plain drag because a plain press is already
spoken for twice: the shell expands on mouse *down*, so a press-and-hold has
opened the panel before any hold could elapse, and a plain horizontal drag is
the swipe that skips a track. Ctrl collides with neither.

## Open and close motion

The shell opens in 360 ms and closes in 260 ms with a monotonic ease-out.
Artwork stays at its final size and screen anchor while the rounded shell
reveals it: centre/top on the top edge, left/centre on the left edge and
right/centre on the right. The compact cover uses its own fixed resting slot.
A short, staged dissolve replaces the old spring-scaled flying cover, so two
independent geometry animations cannot pull the preview around. Fixed-size
auxiliary pages share those anchors and fade away without an extra shrink.
Reversals continue from the current rendered dimensions and opacity, and
reduced motion settles without a delayed overlay or corner animation.

## What moves with the edge

- The host surface, which stays a fixed over-sized window so the shell can morph
  inside it without the compositor rebuilding a transparent surface mid-animation.
  On a side edge it is tall where the top edge's is wide.
- The collapsed pill, which stands on its end: the configured width becomes its
  height.
- The silhouette. The corners facing the desktop are rounded and the corners
  against the screen edge stay square; both ears are the top edge's own ears
  turned onto their side, so the flare cannot drift between edges.
- The reveal zone and the safe area, which now reach out from the docked edge
  and never through it — a cursor already off-screen is not hovering.
- The thin edge strip that reveals a notch sitting behind other windows.
- The retraction when the notch hides: it slides out through its own edge.
- A Dynamic Island's 8px float, which clears whichever edge it hangs from.
- The navigation rail and the collapsed row, which stand up as a column, each
  item's gaps carried round with it.

## How a page is sized on a side edge

- **Readable side columns.** The configured pill scales the expanded column
  between 300 and 420 DIPs. A small collapsed badge no longer squeezes a full
  page into 200 pixels. The display still bounds the column at a third of its
  width, including on high-DPI and smaller displays.
- **No page runs the whole edge.** A page that fills whatever it is given would
  take the full height, which turns a panel beside your work into a second
  screen; `NotchDock.MaximumLengthShare` holds it to half of the display.
- **The cover takes its share of the column**, `NotchDock.CoverShareOfColumn`,
  leaving a margin either side and a centre line for the title, the timeline and
  the transport to sit on.
- **A page is as long as it measures**, not as long as a table says. The page is
  asked how tall it would be at the column's width, with its own explicit size
  lifted for the question and its visibility raised from collapsed to hidden so
  it measures at all. A page that fills whatever it is given - a list, a grid of
  cards - measures to nothing useful, so it keeps the budget it asked for across
  the top and spends it down the side instead.
- **A page is never shorter than the pill it grew from**, and never longer than
  the display allows.

## The vertical media page

Side navigation keeps a bounded horizontal strip with edge fades and wheel
scrolling when tabs overflow. Clipboard and timer scrollbars are dark rounded
thumbs with no arrow buttons. The timer uses an editable countdown dial on the
sides; the top retains its clock, calendar and transport row. The side timer's
Pomodoro tab runs 25-minute focus / 5-minute rest phases, with a 15-minute rest
after four completed focus sessions. Pause, reset and skip work without changing
the dock; skipped focus sessions do not count. Timing continues on other tabs.
Timer / Pomodoro buttons are visible at all three dock positions. At the top,
the existing clock/calendar and transport remain, with a compact mode switch
above the controls and a session/Skip footer in focus mode. The panel grows to
fit that footer. The controls' context menu provides the same commands too.

The page across the top is two columns: the card, and an aside carrying lyrics,
the calendar and the greeting. A column of 300 to 400 has no room for anything
beside the cover, so the aside stands down and the card takes the whole width,
reading cover, title, artist, timeline, transport, straight down.

Transposing the page wholesale was tried first and is wrong: its blurred cover
backdrops and lyrics canvas are layers pinned to particular columns, and turning
the grid scatters them across the page. `GridFlip` still turns the card's own
row of cover / playback / controls, which is an ordinary three-cell layout and
transposes cleanly.

Everything the card shows is derived rather than restated:

- the cover is the width of the column, and its artwork, its clipping grid and
  its rounded clip grow with it - each of those was authored at 102 and had to
  stop being so;
- the corner keeps its share of the cover rather than a fixed radius;
- the card's padding, its leftward pull and the cover's authored size are read
  off the page the first time they are needed, so moving back to the top edge
  restores exactly what was designed;
- the text, the timeline and the transport take `MediaPlaybackView.ColumnWidth`
  rather than the fixed 340 the wide layout was built around, so the bar reaches
  the full width and the buttons spread across it.

## The vertical clipboard

Across the top the clipboard is a strip of fixed tiles that scrolls sideways.
Down a side it is what it always wanted to be: a list. The cards run down the
tray, each as wide as the column, their gaps falling between them instead of
beside them, and the scrolling follows.

The card is 210 wide across the top, which three interaction tests pin, so the
width became `ClipboardTray.CardWidth` with 210 as its default: those tests
still see 210 and a side dock gets the column. The card takes the column less
the list's own margin, which the tray reads off the list rather than repeating.

The header has to clear the navigation tabs. Across the top that is a column
beside them; a column of 290 has no width to give away, so the clearance becomes
a band above instead - the header band lengthens by the navigation row's own
height, which is measured off that row rather than written down here, and asked
for its measurement rather than its laid-out height because the first time it is
needed it has not been through a layout pass.

## Two bugs this turned up

**Clicking the cover could leave Chrome unopenable.** The cover grew from a
102px thumbnail to most of the column, so it started being clicked often enough
to notice. `MediaWindowActivator.TryActivateWindow` called `ShowWindow(SW_SHOW)`
on whatever window it had matched, and `TryActivateProcessWindows` fed it
`Process.MainWindowHandle` without checking the window was on screen. Chrome
keeps hidden top-level windows for its background host; showing one puts an
empty ghost on screen that the taskbar then opens in place of a real browser
window, which from the outside looks like Chrome refusing to open.

`WindowRevealPolicy.For` now decides: minimised is restored, visible is only
raised, and hidden is refused outright. The same path also stopped relying on
`SetForegroundWindow` alone - the notch never takes focus, so Windows refuses to
let it hand the foreground on and flashes the taskbar button instead. It now
attaches to whichever thread owns the foreground for the length of the call,
which is what lifts that.

**Pages resized for a column stayed that size back on the top edge.** The
clipboard is authored 888 across and the camera 488; a side dock overwrites both
with the column's width, and nothing on the top edge put them back, so the
clipboard opened narrow in a wide shell until the next restart. Each page's size
is now remembered the first time it is overwritten and handed back when the
notch returns to the top.

**The hover zone could sit on a different edge from the notch.** The edge is
stored whether or not edge docking is switched on, and `NotchManager` read the
stored one while the window read the gated one - so turning the switch off with
a side edge stored drew the notch across the top while the zone that opens it
stayed down the side. `NotchDock.Active` is now the single answer to which edge
is in force, and everything asks it.

**A move that lost mouse capture never ended.** Capture can be taken away - by
another window, or by the notch hiding itself for a fullscreen app - and then no
button-up arrives, leaving the move in progress forever and hover suppressed for
good: the same symptom as the Ctrl bug below, from a different cause. The move
now tracks the physical mouse button during the gesture even if WPF capture is
denied or lost. Polling stops on release/cancel and is disposed on shutdown.

**The title had a ghost beside it down a side edge.** Each line is drawn twice,
a dark copy a pixel below for the shadow and then the real one, and the shadow
copies have no names. Centring only the named blocks left the shadows where they
were, which read as a second, ghostly title. Every line under the two morph
layers is aligned now, named or not.

**The collapsed pill lost its artwork and its visualiser on a side edge.**
The compact pill is a row - artwork, the title that marches past, the
visualiser - and a side edge gives it the pill's breadth across, where a row of
22 plus 20 does not fit: both ends fell off and neither was drawn. It now
stands up, artwork above visualiser, with the title stood down because a column
that narrow has nowhere for a title to run. The cells are the authored ones read
the other way, captured once, so the top edge gets its row back exactly.

Two things fed it. `ApplyDynamicIslandContentAlignment` centres the row on the
pill's centre line with a top margin of `(GetCollapsedHeight() - 22) / 2` - which
on a side edge is half the pill's *length*, 109, and shoved the content out of
the pill altogether. It knows which edge it is on now, and centres by alignment
rather than by margin when the row is standing. The same method owns every
margin inside the pill and re-runs on each change of mode, so the orientation
pass sets cells only and asks it to run again; anything else it set would be
overwritten on the next island switch.

The hover bulge had the same shape of bug: it added its width to the width and
its height to the height, so on a side edge the pill swelled across the column
instead of growing longer. It is rotated with the edge now.

**Holding Ctrl stopped the notch opening at all.** The modifier armed the move
on its own, which meant hover expansion stood down for as long as Ctrl was
down - and Ctrl is down all day for copy, paste and tab switching. Approaching
the notch with it held did nothing, and moving the cursor over an open panel
collapsed it, so the panel came and went mid-animation. It applied to every
edge, the top included.

The current interaction deliberately uses Ctrl as a ready-to-move state:
holding it collapses the panel once and suppresses hover expansion; release
restores hover. It reads the physical key state on the non-activating overlay,
without a global keyboard hook. A pointer press plus movement is still required
to move or save the dock. The key monitor runs only while expanded, armed or
hovered, and text-editing shortcuts remain available.

**The notch could stop opening on hover after a drag.** `IsDockPickUpArmed`
asked WPF whether Ctrl was down, and a window with `WS_EX_NOACTIVATE` can miss
the key going back up - after which the notch believed the modifier was still
held and suppressed hover expansion for good. It asks the system now
(`GetAsyncKeyState`), which is not tied to focus.

## What is not done yet

**System, AI Agent, Timer, Calendar and the audio mixer keep their wide
layouts**, so on a side edge they are a wide page in a narrow column. Each needs
the same pass: the aside or the widest row stands down, and what is left reads
downwards.

**Two details on the pages that are done.** The clipboard's category chips run
off the right of the column - they scroll, but the row is visibly cut. And a
media title longer than its column still starts from the left as it marches,
rather than from centred, because the marquee positions its own layer.

Neither is a placement bug; both are page layout.

## Where it lives

`Services/NotchDock.cs` holds every placement decision as pure functions —
host bounds, the shell's rect inside them, corner radii, ear geometry, hover
zone, safe area, the island inset, the retraction direction and the snap. It
takes a screen rectangle and returns numbers, so placement is covered by tests
rather than judged by eye on one monitor.

`Windows/MainWindow.Dock.cs` applies those numbers to the visual tree and owns
the Ctrl-drag and the tray entries. The three-cell shell grid (ear, panel, ear)
is switched between columns and rows in place; the children are authored in
order along the edge, so a child's index is the cell it belongs in either way.

Everything else was already funnelled through single points and only needed to
be told which edge it is on: `MakeNotchCornerRadius` for every layered border,
`GetCollapsedWidth`/`GetCollapsedHeight` for the pill, `OverlayWindowController`
for the host window, `NotchManager` for the hover bounds and safe area.

## Keeping the top edge intact

Edge docking adds a left and a right. It is not allowed to change the top, and
`TopEdgeRegressionTests` pins that: the host rectangle (the same numbers
`OverlayWindowControllerTests` already pins), the shell's size the way round it
was set, the corner radii at both ends of the island transition, the alignment,
the transform origin, the retraction, the island inset, the shell's place in its
host, the reveal zone, the safe area, the edge strip, both ears by bounds and by
what their wedge covers, every page's authored size, and that none of the column
rules reach a top-edge page at all.

The pages a side edge rearranges restore what they were authored with, because
each value is read off the page the first time it is needed rather than written
down twice. For the clipboard that decision is `ColumnLayout.For`, which is pure
and tested both ways round, including that asking for the horizontal layout
after a side dock returns exactly the authored record.

Measured on the running application: the top notch before a Ctrl-drag out to the
left edge and back differs from the one after by 1.0% of sampled pixels, which
is the clock advancing and the title marquee moving.

## Verification

```powershell
./Test-Dock.ps1 -DotNetExe ../dotnet-sdk/dotnet.exe
```

26 cases cover: the top edge producing the identical host rectangle it produced
before (the same numbers `OverlayWindowControllerTests` already pins), the top
edge ignoring the offset, a side dock turning the surface on its end, flush
placement against either side, the offset sliding the notch along an edge and
being clamped when out of range, a second monitor at a negative origin docking
to its own edge, a host taller than the screen centring instead of hanging off
one end, the pill standing on its end, the shell pinned to its edge and centred
along it, the corner radii, the alignment, the reveal zone never reaching
through the screen edge on either side, the top reveal zone being unchanged, the
snap choosing an edge and a position from a release point, and the ears: each
one inside its own box, the side ears being the top ear transposed, and the
wedge solid where it meets the shell and tapered away from it.

Measured on the running application at 1920×1080: docked right, the collapsed
shell occupies a 232px run against the right edge centred at y=539.5 against a
screen centre of 540; docked left in Dynamic Island mode it floats 8px clear of
the left edge with the navigation rail stacked vertically. The expanded panel is
vertically centred. These confirm placement, not page layout — see the section
above for what is still built wide.

The complete application compiles. The complete application test assembly
remains subject to the previously recorded Windows Application Control test-host
limitation, so the isolated dock suite is not claimed as a complete regression
run.
