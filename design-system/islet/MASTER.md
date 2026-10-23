# Islet notch — design system

Updated 2026-10-23. Electron 38, vanilla HTML/CSS/JavaScript, Windows desktop.

## Source-port override (current)

The [source-port mapping](../../docs/vorssaint-source-port.md) is the authority
for this pass. `notch-source.css` and `settings-source.css` load after earlier
presentation styles. Settings uses the source's split-view/sidebar and four
Dynamic Island tabs. The island has no artificial camera band or footer toolbar;
its commands use the native context menu. Existing Windows services and profile
data remain intact. Earlier tables below are a baseline where not overridden.

Current metrics: content inset 28px, row gap 10px, dynamic shoulder at most 14px,
music page 520×260 by default with a full-width reading area, artwork 76px,
title 16px/artist 14px and a timeline with side times. Explore has four columns
of 86px tiles in two rows. Settings has a 210px sidebar, 22px detail inset,
20px section spacing, 16px group radius and 26px icon tiles with 12px gaps.
The notch is always opaque `#000000`, including its shoulders, compact states and
capsule shape. Global accent is white. Legacy surface/accent/glass preferences
normalize to this policy; settings offers size/shape controls and no color/glass
picker. Only music timelines and equalizers inherit artwork color. Labels,
transport controls and other modules do not. Semantic module/provider colors stay.

Capsule keeps four equal circular corners at rest/hover (`min(height / 2, 28)`),
and 28px corners when expanded, following `NotchLayout.capsuleRadius`. Persist
the complete contour beneath the spring keyframes; releasing an animation must
not reveal square-top media CSS. Capsule has no concave shoulders. Refresh the
native hit region after a shape-only change, as dimensions can remain equal.
An empty shelf mounts no decorative green ready dot, including during hover
crossfades; parked files retain the actual count.
The hover preview also has no legacy green AI dot/session-count badge. Agent
details belong on the AI page; simultaneous live activities keep the existing
activity picker. Waiting sessions must not add an indicator beside the song.

Music refinement requested by the user: `music-source.css` overrides the earlier
344px/56px source metrics to reduce empty space. The player fills the available
panel width, keeps a 48px primary control and a wider 4px timeline. Artwork stays
separate from the transport to preserve collapse behavior. Play/Pause paints
immediately; actual Windows observations are kept separately until the matching
command and state confirm the intent. Stale polls cannot flip the icon back.
Rapid clicks coalesce, failed/timed-out requests restore observed state, and a
new source retires old pending results. No continuous extra polling is added.

Module source details: shelf tiles 78×88px and tray empty state; clipboard cards
52px/8px gaps with on-demand search and row feedback; Timer ruler 82px,
setup clock 26px/active clock 62px, orange mode underline; Scratchpad radius
12px and 6px vertical inset; System overview cards 72px/18px radius with a
180px overview island and 290px detail island. Timer uses 260px setup/230px
active height. AI providers pair across the strip with stacked window meters.

Additional interaction pass: clipboard pointer dwell 700ms/key dwell 1.4s,
exit delay 150ms; lifted preview bounded to the list with button/F2 alternative
and Escape focus restoration. Pins use a muted gold edge and keep their order.
Notes offers local find, Copy all and persisted 10–22px type. Scroll masks fade
16px over 180ms only on overflowing edges, with reduced-motion overrides.

AI refinement: `ai-source.css` is authoritative for this module. Independent
provider tiles, 18px radius, 12×10px padding, 10px gaps, full-row charts, fixed
controls above the scrolling cards. Used/Remaining and window-time ticks are
readings, never predictions. Keyed updates preserve focus/scroll and keep pulse
layers mounted. Empty layouts fit a 280px island; ordinary content is capped
at 510px. Personalization holds that height while its editor is open.

Timer refinement: `timer-source.css` is authoritative. Use the source's centered
14px minute scale, orange 4×38px ticks and fixed pointer; provide native range
keyboard operation. Remember Timer/Focus durations separately. Four quiet Focus
readouts configure breaks, long-break interval and session count. Focus setup is
280px; regular setup 260px; active clock 230px. The main service owns a captured
cycle configuration. The 62px clock moves changed digits for 300ms only on the
open Timer page; Reduce Motion bypasses it. Tick updates do not change geometry.

Content preferences persist existing module order/visibility. Keep at least one
module and always keep Settings accessible. Search takes users to the actual
field; Alt+Left/Right navigates settings history. Shift+F10 opens island commands.

The user explicitly requested closer fidelity to Vorssaint and prioritized file
dragging, module gestures and brief activities. Preserve Islet branding, English
interface text, separate Settings window, monitor placement, and existing services.

## References and judgment

- Vorssaint source `02a13224062342f289753733487f6da85db4e332`:
  `NotchSupport.swift`, `NotchSectionsView.swift`, `NotchMusicView.swift`.
  Use the source's 56px artwork, 86px tiles, 8px gallery spacing, shortcut labels,
  paired quota cards, and compact surface hierarchy. Attribution remains in
  `THIRD_PARTY_NOTICES.md`.
- User-provided [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill).
  Verified database matches: Dark Mode (OLED), and Dragging Movements. Apply deep
  surfaces, readable text, visible focus, vector icons and click/keyboard
  alternatives. The broad design-system query returned a marketing-page pattern
  and light palette, which do not fit this product and were not adopted.
- Animation search did not return a verified spring match. Motion guidance comes
  from the skill's quick reference and the existing Vorssaint spring port.
  No GSAP dependency or external fonts are needed for this Electron application.

## Tokens

| Role | Value |
|---|---|
| Resting surface | `#000000` |
| Expanded surface | `#000000` |
| Raised surface | white at 3–6% |
| Primary text | `#f3f3f5` |
| Secondary text | `#b2b2b8` |
| Supporting text | `#9c9ca5` or lighter |
| Accent | `#ffffff`; semantic colors for activities/modules |
| Font | Segoe UI Variable Text / Segoe UI |
| Content inset | 22px horizontal, 14px top, 12px bottom |
| Artwork | 76px, 15px corner radius |
| Gallery tile | 86px high, 16px radius, 8px gap |
| Gallery viewport | Two rows, one 94px whole-row step |
| Pointer targets | At least 24px for desktop icon controls |

Use system typography for Windows rather than importing a marketing font.
Compact supporting labels follow the source's desktop density; primary content
uses 12–16px. Preserve OS DPI scaling and the app's existing small-screen fitting.
Verify text contrast and opaque black shell pixels in the actual renderer.

## Geometry

Painted sizes, in CSS pixels:

| Surface | Size |
|---|---|
| Rest | 184 × 28 |
| Peek | 300 × 46 |
| Music peek | 360 × 50 |
| Activity peek | 360 × 64 |
| Music | 520 × 270 |
| Files / Notes | 520 × 350 |
| Timer / Gallery | 520 × 330 |
| Clipboard / System | 520 × 390 |
| AI | 520 × 510 |

These are the default dimensions. Appearance preferences allow a 160–280px rest,
480–640px expanded width and 85–125% overall size, in bounded steps. Keep content
at the selected natural width; overall size uses Electron zoom, including text,
controls and hit regions. Monitor fitting takes precedence when space is limited.

The transparent native host starts at the selected expanded width + 52px and
554px high before zoom/fitting (572 × 554 by default). It can grow to 692px wide
when preferences grow, retaining that reservation for the process lifetime so an
outgoing wide shell is not clipped by a smaller HWND. Inner layers keep their
natural size; only the shell morphs. Avoid native resizing at animation boundaries.
Disable expensive inner blur while morphing.

## Appearance studio

Settings contains a miniature resting/expanded preview, labeled size sliders with
numeric outputs, a fixed Black theme readout and Reset size. Preview immediately;
batch persistence after 180ms idle or
on release. Preserve draft values across older IPC broadcasts, and restore stored
values on failure. Flush pending changes before closing Settings.

Average one sRGB artwork pixel and apply the source's saturation/darkness checks
and channel normalization. Tint only the music timeline and equalizer; ensure
at least 3:1 meter contrast against black. Neutral, missing or invalid artwork
falls back to white. The Music setting can disable this tint. Native range inputs
retain keyboard interaction, focus rings and value text. Reduced motion bypasses
the miniature morph.

Skill queries for sliders returned unrelated chip/haptic guidance after the
narrow retry. No slider database result was adopted. Labels, native keyboard
controls and feedback use the skill's general accessibility/forms defaults.

## Interaction rules

- Horizontal trackpad gestures or a deliberate pointer swipe on the header move
  between modules. Keep music-track gestures on music surfaces. Preserve vertical
  content scrolling. Do not switch modules during transfers or file dragging.
- Expose previous/next buttons, gallery selection, Alt+Arrow and Alt+1–8. Keep
  visible focus and state labels. Native Add files / Ctrl+O replaces drag-only use.
- Drop feedback belongs to the shelf and actual device target, with a clear text
  instruction, restrained movement and a completed-state pulse.
- Activities show music, timer, transfer and agent events. They do not read global
  Windows notifications. Never take focus automatically or replace an open page.
- Higher-priority events can interrupt previews; coalesce duplicates, bound the
  queue, pause expiry on hover/focus, and offer dismiss/open actions.
- Reduced motion disables page slide, drop pulse and decorative motion. Keep
  existing controls usable immediately; do not wait for an animation to accept input.
- Volume, mute, brightness and Caps Lock use one short system-feedback activity.
  Update meters in place while keys repeat; switching system controls replaces the
  previous one. Expire stale pending adjustments rather than replaying them after
  a timer/transfer. An open module keeps its page and receives inline feedback.
  Feedback is a readout with no click action; System feedback can be disabled.

Runtime styling is in `src/renderer/islet.css`; geometry and activity logic have
dedicated modules and synthetic-data tests.
