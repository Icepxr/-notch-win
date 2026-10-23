# Vorssaint source port — existing Islet features

Implemented 2026-10-23 from revision
`02a13224062342f289753733487f6da85db4e332` of
[vorssaint-utils](https://github.com/vorssaint/vorssaint-utils/tree/02a13224062342f289753733487f6da85db4e332).
The source files were inspected directly. The authoritative presentation layers
for this pass are `src/renderer/notch-source.css`, `settings-source.css` and
`settings-navigation.js`. Islet keeps its own name, mark and Windows services.

| Source | Adaptation in Islet |
|---|---|
| `UI/Settings/SettingsView.swift` | 210px split-view sidebar, settings search with field routing, backward/forward history and independent detail scrolling. Narrow displays reduce the sidebar without horizontal scrolling. |
| `UI/Settings/NotchSettings.swift` | Dynamic Island split into Layout, Content, Activity and Behavior. Existing music options and display placement have their own pages. |
| `UI/Settings/SettingsCard.swift` | 16px group radius/inset, 20px section spacing, 26px icon tiles and 12px row gaps. |
| `UI/Settings/NotchSettingsTabRow.swift` | Accessible segmented tab selection, keyboard movement and an Open notch action. |
| NotchSettings content editor | Reorder and show/hide the seven existing modules. At least one stays visible; keyboard shortcuts and file-drop/transfer routing remain available. Settings remains reachable in Explore. Ordering and visibility persist through the shared preference store. |
| `UI/Notch/NotchView.swift` | Content owns the surface. Remove the fabricated camera band and persistent footer toolbar. Pin, Settings, Collapse and Quit live in the native secondary-click menu; Next activity preserves the previous activity-cycling function. Shift+F10 and Ctrl+Comma provide keyboard access. |
| `Services/Notch/NotchSupport.swift` | Shoulders are `min(14, height × .19)`, animated with the existing per-axis spring. Content inset 28px, row gap 10px, surface radius `min(28, height × .34)`. The native host still reserves spring overshoot. |
| `UI/Notch/NotchMusicView.swift` | 344px player reading width, 56px artwork, 14px semibold title/13px artist, 14px spacing, 44px transport and times beside the seek rail. Playback-state bars remain decorative; playback/seek/source control stays with Windows SMTC. |
| `UI/Notch/NotchSectionsView.swift` | 86px tiles, 8px spacing, four columns/two whole rows for our eight destinations, shortcuts and current selection. Arrow-key movement follows four columns. |
| `UI/Notch/NotchFilesView.swift`, `UI/Shelf/ShelfTilesView.swift` | Single tray in a dashed 20px drop surface; sideways 78×88px shelf tiles. Native file picker, folder batches, drag out and LocalSend destination/progress/PIN handling remain available. |
| `UI/Notch/NotchClipboardView.swift` | 52px vertical cards, 8px gaps, vector type marks, on-demand search (button, typing or Ctrl+F), arrow/Return copying and row-local 1.6s copied feedback. Escape clears/folds search before dismissing. Image thumbnails remain preview-only because Islet stores no full image. Existing pause, remove and clear behavior is retained. |
| `UI/Notch/NotchTimerView.swift`, `Services/Notch/NotchSupport.swift` | 344px reading column, orange mode underline, 82px ruler and 26px setup clock, 28px Start capsule; active session switches to a 62px clock and round primary control. Setup/active island heights are 260/230px. The ruler is a native accessible range control on Windows. Existing timer, Focus cycle and stopwatch service owns the time. |
| `UI/Notch/NotchScratchpadView.swift` | 12px editor surface, 6px vertical/11px horizontal text inset (container plus line padding), quiet header and save status. Existing single-note autosave/Ctrl+S and failed-write feedback are preserved. |
| `UI/Notch/NotchSystemView.swift` | 72px overview cards, 10px gaps, 18px radius, 22px readings, orange pressure warning from 85%. CPU, memory and available storage use real Windows readings. Selecting a card opens the existing history/storage details in-place; Overview/Escape returns focus. Island height changes from 180 to 290px for details without resizing the native host. |
| `UI/Notch/NotchAgentsView.swift`, `Services/Notch/NotchAgentSupport.swift` | Paired provider cards with vertically stacked quota windows and 10px spacing. Provider colors, live/stale/sign-in status, account windows, local activity, period/filter/card visibility and Connect Claude remain intact. Cards may grow above the source's 96px minimum to keep Windows CLI failure/sign-in guidance readable; no quota is invented. |

## Scope and platform choices

The Windows app translates the relevant SwiftUI/AppKit layout and interactions
to Electron/HTML/CSS. It does not run SwiftUI or copy the macOS implementation
of media, display, notification, clipboard or process APIs. Segoe UI, Windows
menus, Windows DPI fitting and user-selected monitor placement remain native.
There is no camera cutout to reserve on Windows.

No unavailable Vorssaint tools are advertised. The settings sidebar's tool
shortcuts open only Files, Music, Clipboard, System, AI Agents, Timer and Notes.
Source size/shape controls configure those existing surfaces. Per the user's
black-only requirement, every notch state uses opaque black and a neutral white
global accent. Saved color/glass preferences normalize to this policy. Dimensions,
LocalSend identity, shelf contents, notes and history remain in the existing profile.

Each of the seven module view files was inspected directly. The source's
unsupported file/media conversion, clipboard manual reordering, multi-pad
notes, extra system sensors and additional AI providers/accounts are outside
this pass. Their controls are not added to Islet. Source page heights follow
the visible content for the System and Timer pages; ordinary sensor/timer
ticks keep the current geometry target and do not restart its spring.

## Black surface and music tint — 2026-10-23

The source's `NotchView.swift` and `NotchComponents.swift` solid-black path is
mandatory in Islet. Glass, surface palettes and custom global accent controls
are removed. Main-process preference loading/writes, renderer updates and the
Settings preview all normalize legacy colors to black/white and glass to off.
Size/scale, shape, monitor and other unrelated preferences are retained.

`NotchMusicService.swift` samples one averaged sRGB artwork pixel.
`NotchMusicSupport.swift` rejects nearly black or low-saturation samples, then
stretches the channels into the source's 0.06–0.92 range. Islet follows that
algorithm rather than choosing a dominant hue. For Windows, a thin interactive
meter tint is lightened only when necessary to reach 3:1 contrast on black.
White is the fallback for neutral/missing/invalid artwork and when the option
is disabled. The artwork color belongs only to the timeline/seek thumb and
music equalizers. It does not color the shell, shoulders, rim, backdrop, labels,
transport controls or another module. Existing semantic/provider colors remain.

`test/notch-theme-ui.js` adds 20 actual-renderer checks, including opaque black
pixels across all seven modules, compact music and capsule states; old theme
preferences; scoped tint; cover fallback and toggling the music color option.
`test/artwork-palette.js` verifies averaging, premultiplied alpha, exact source
tints, malformed input and meter contrast. Preview data is synthetic.

## Capsule hover contour — 2026-10-23

`NotchSupport.swift` uses `NotchLayout.capsuleRadius` (`min(height / 2, 28)`)
for circular compact ends and rounded expanded corners. `NotchView.swift` keeps
the floating silhouette during hover growth. Islet now persists all four
corners under its spring animation, rather than just the lower two. This stops
the more-specific music-preview CSS from squaring the top after animation fill
is cancelled. The old fixed 24px capsule override is removed. Shoulder hiding
and the native 8px floating offset remain; hit testing refreshes after shape-only
changes as well as dimension changes.

The empty shelf no longer creates a green ready dot, so it cannot appear during
the compact/hover crossfade. File counts and meaningful transfer feedback remain.
`test/capsule-hover-ui.js` reproduced the old failures before the fix and now
passes 21 checks: idle/music hover, actual corner pixels, collapse, switching
silhouettes, hit geometry, rapid reversals, reduced motion and file-count recovery,
plus music with three waiting/mixed AI sessions. The legacy green AI dot/count
badge is removed from the preview markup, renderer and CSS. AI session summaries
and meaningful status dots remain on the AI page, with the existing activity
picker available for simultaneous live activities.

## Additional source details — 2026-10-23

- `UI/Notch/NotchClipboardView.swift`, `Core/NotchClipboardSizeStrings.swift`
  and `Services/Clipboard/ClipboardHistoryService.swift`: pin/unpin saved text,
  Pinned filter, search combined with that filter and Clear recent preserving
  pins. Pins hold their position when something is copied again. Windows keeps
  at most 20 pins separately from the 60 recent items. Pin writes use atomic
  replacement and roll back on failure; older history files remain readable.
  Images and oversized transient text remain unpersisted and cannot be pinned.
- The clipboard's compact rows open a lifted preview after the source's 700ms
  pointer dwell or 1.4s keyboard dwell, and close 150ms after exit. An explicit
  Preview button/F2 opens it immediately. Escape closes it and restores the
  row before dismissing the island. The floating surface stays inside the
  visible list without changing row positions. It uses the existing bounded
  preview/thumbnail, with full clipboard text still held in the main process.
- `UI/Notch/NotchScratchpadView.swift` and
  `Services/QuickTools/ScratchpadSupport.swift`/`ScratchpadService.swift`:
  Copy all with 1.6s feedback; note-local find with Ctrl+F, Enter/Shift+Enter,
  Ctrl+G/Shift+Ctrl+G and Escape; persisted text size from 10–22px (default13).
  Find is literal, case-insensitive and uses original Unicode selection
  offsets. A measured editor mirror scrolls distant wrapped results into view
  only when a find action runs. Save/copy/font failures stay visible.
- `UI/Notch/NotchScrollEdgeFade.swift`: 16px edge masks and 180ms easing only
  where content lies beyond the viewport. Applied vertically to clipboard/AI
  and horizontally to the file shelf. Passive scroll events, ResizeObserver
  and coalesced mutation updates avoid a continuous animation loop. Reduced
  motion disables lift/fade transitions.

These additions live in `panel-clipboard.js`, `clipboard.js`, `panel-notes.js`,
`notes-tools.js`, `scroll-edges.js` and `notch-source.css`. Notes stay in the
existing plain-text store; font size uses the shared preference transaction.
No note-document migration or external account/API dependency is introduced.

UI UX Pro Max guidance was checked for navigation. Keyboard Navigation was a
verified match; the source itself determines the sidebar geometry and hierarchy.
The targeted hover-preview query matched Hover vs Tap, applied as the visible
Preview button and F2 alternative to dwell.
No unrelated web sticky-navigation behavior was adopted. Licensing/attribution
is recorded in `THIRD_PARTY_NOTICES.md` and the project remains GPL-3.0-or-later.

## Validation

`npm test` covers the existing services and module preference validation.
`npm run test:ui` covers the full renderer, the two-window settings integration,
source layout, context actions, search/history, narrow windows and a long music
title across custom shell widths. `test/modules-source.js` additionally checks
clipboard keyboard/copy/search, live system detail navigation, Timer/Focus/
stopwatch, Notes save/failure feedback and paired AI status. Screenshots are
under `docs/previews/`.
`test/source-details.js` additionally uses the real clipboard service with a
synthetic clipboard to verify persisted pins, copy promotion, clear-recent,
pin write failures, floating previews, Notes controls and scroll edge changes.
The tests use synthetic service data; they do not send user files, change system
volume/brightness, start model turns or sign in to accounts.

## AI Agents redesign — 2026-10-23

The AI page now ports the reading order and independent card surfaces from
`NotchAgentsView.swift`, `NotchAgentComponents.swift` and `NotchAgentSupport.swift`.
Each provider occupies its own grid tile; charts occupy whole rows and an
unpaired card gets the row's width. Card padding is 12×10px, radius 18px and
gaps 10px. Windows text/status guidance can make an account card taller than
the source's 96px baseline. Empty/short selections reduce the island's height;
opening Customize keeps enough height for the editor until it closes.

- Account cards support Used/Remaining, real reset times, source 80%/95%
  pressure colors and a time-window tick. The tick represents elapsed/remaining
  window time, not a forecast or task progress. Stale/log readings have no tick.
  Reset-due readings show an em dash and omit numeric accessibility values.
  A signed-out account never inherits a former account's quota.
- Only providers with local evidence/account state appear in All. Users can
  choose a provider explicitly for its connection/missing-CLI state. Analytics
  cards wait for local history instead of filling a new account with blank
  charts. Local token/response counts remain labelled separately from quota.
- Customize persists validated order/visibility, quota mode and resting-notch
  readout, migrating the existing `ai-view` preference. It includes drag grips,
  keyboard arrow buttons, Reset layout and recovery when all cards are hidden.
- The resting agent can display elapsed time or the most-used valid quota,
  based on `NotchAgentStrip.swift`. Missing/stale/expired quota falls back to
  elapsed time. No model calls or additional account polling are introduced.
- Daily bars split the real token totals by provider. Hover, click or keyboard
  arrows inspect a date; selected/focused nodes survive incoming snapshots.
  Activity stays at 28 days, within Islet's existing 31-day log retention,
  rather than drawing the source's 13 weeks with invented zero history.
- Keyed DOM updates preserve cards, controls, focus and scroll. The toolbar is
  outside the fading scroll area. Session clocks update text once per second
  only while this page is open; other clock-derived presentation updates every
  15 seconds. CLI checks publish an explicit checking/settled state.

Authoritative implementation: `ai-source.css`, `ai-view.js`, `ai-dom.js` and
`panel-ai.js`. A targeted UI UX Pro Max density query did not return a verified
match; the source views determine the layout. `test/ai-view.js` covers quota,
date/provider aggregation and preference guards. `test/ai-source.js` verifies
32 state/interaction/layout cases with synthetic accounts, including loaded
local provider logos on cards, filters, sessions and the compact notch. Its hidden window
explicitly dispatches the focus handler for chart keyboard inspection.

Provider marks are original SVGs from OpenAI's logo archive and Anthropic's
press kit, bundled locally with provenance in `src/renderer/assets/providers/README.md`.
The OpenAI Blossom identifies the Codex provider; both original colors and
viewBoxes are preserved. Logos do not require a network connection at runtime.

## Timer and Focus interaction pass — 2026-10-23

Read directly at the pinned source revision:
`NotchTimerView.swift`, `NotchTimerRuler.swift`, `NotchComponents.swift` and
`Services/Notch/NotchTimerSupport.swift`.

- A centered scale uses the source's 14px spacing, 4×38px orange ticks,
  five-minute labels and fixed pointer. Dragging moves relative to the chosen
  minute, nearby clicks pick a tick, and fractional trackpad input accumulates.
  Reversing at the 1/180-minute boundary responds immediately. A native range
  input preserves Arrow/Home/End control, spoken values and visible focus.
- Timer and Focus remember separate durations. Focus offers every supported
  short/long break (1–60 minutes), long-break interval (1–24) and total session
  count (1–24), with a 1–180-minute focus duration. Setup is saved in the local
  renderer profile as `timer-view`; save failures remain visible. The new
  controls do not replace the existing shared appearance/preferences store.
- Starting a Focus cycle copies its bounded configuration into the existing
  main-process timer. Drafts and snapshots cannot mutate that running cycle.
  Session progress, next-break guidance and a final Cycle complete state use
  the actual service state. Every next phase requires an explicit action;
  sleeping or hiding the notch cannot silently complete a chain of sessions.
- The active clock uses 300ms movement on changed digits only, with the source's
  opposite directions for countdown/stopwatch. Reduce Motion skips movement,
  including when enabled during an animation. Clock ticks do not resize the
  native host. The Focus setup uses 280px height for four readable Windows
  readouts; ordinary setup stays 260px and active time stays 230px.
- Duplicate commands are blocked while awaiting a reply. Command errors offer
  a usable retry. Starting the next phase retires only the preceding timer
  completion notice, preserving unrelated queued activities.

Implementation: `timer-tools.js`, `timer-ruler.js`, `timer-source.css`,
`panel-utilities.js`, `timer.js` and the renderer's existing activity queue.
`test/timer-source.js` checks complete cycles, source bounds, configuration
ownership, pause/sleep and existing callers. `test/timer-ui.js` checks 27
input/state/layout cases with the real service, controlled time, an isolated
profile and real Chromium pointer/keyboard input. It also verifies renderer
reloads, minimum width, reduced motion and failure recovery.

UI UX Pro Max's narrower range-control query verified Keyboard Navigation.
Its native controls and visible focus guidance apply; the source determines
the scale geometry and readout styling.

## Music layout and playback response — 2026-10-23

The user requested a fuller music page after the source-port pass. The new
`music-source.css` intentionally replaces the source's 344px reading width,
56px art and 230px height: the player fills the panel, artwork is 76px, title
16px, secondary text 14px, primary control 48px and the island height 260px.
The timeline remains full-width with actual side times. Long titles, multiple
sources and hour-long recordings fit the 480px minimum notch. Inner card chrome
is removed in every glass mode. Marquee measurements adapt to the chosen width.

The earlier optimistic toggle was overwritten by the next stale Windows poll.
`media-playback.js` now keeps observed playback separate from requested state.
It paints the icon, equalizer and anchored timeline synchronously, sends
explicit Play/Pause commands with correlated IDs and the displayed app, then
waits for a matching acknowledgement and observed state. Rapid clicks coalesce
behind one in-flight request. Failure or a 5.5s deadline restores observed
state; retired results cannot affect a new track/player. The PowerShell bridge
echoes IDs, targets the original app and avoids toggle-key fallback when the
target already has the requested state or another app is the current player.

`test/media-playback.js` covers the timing/state races. `test/media-playback-bridge.ps1`
exercises the actual command functions with mocked sessions and media keys,
including safe fallback; it does not control Windows playback. `test/music-playback-ui.js`
covers 14 immediate-feedback, stale-poll, rapid-click, failure, compact and
responsive-layout cases with delayed synthetic IPC. The UI UX Pro Max query
matched Active States; immediate press feedback is applied without mobile haptics.
