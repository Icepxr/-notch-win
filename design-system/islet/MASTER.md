# Islet notch — design system

Updated 2026-10-22. Electron 38, vanilla HTML/CSS/JavaScript, Windows desktop.

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
| Resting surface | `#050506` |
| Expanded surface | `#080809` |
| Raised surface | white at 3–6% |
| Primary text | `#f3f3f5` |
| Secondary text | `#b2b2b8` |
| Supporting text | `#9c9ca5` or lighter |
| Accent | `#aac4ef`; semantic colors for activities/modules |
| Font | Segoe UI Variable Text / Segoe UI |
| Content inset | 22px horizontal, 14px top, 12px bottom |
| Artwork | 56px, 11px corner radius |
| Gallery tile | 86px high, 16px radius, 8px gap |
| Gallery viewport | Two rows, one 94px whole-row step |
| Pointer targets | At least 24px for desktop icon controls |

Use system typography for Windows rather than importing a marketing font.
Compact supporting labels follow the source's desktop density; primary content
uses 12–16px. Preserve OS DPI scaling and the app's existing small-screen fitting.
Verify text contrast with rendered pixels, including bright artwork behind glass.

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

Settings contains a miniature resting/expanded preview, labeled sliders with
numeric outputs, named color presets, custom surface/accent pickers and a reset
limited to appearance. Preview immediately; batch persistence after 180ms idle or
on release. Preserve draft values across older IPC broadcasts, and restore stored
values on failure. Flush pending changes before closing Settings.

Obsidian is the default; Midnight, Iris and Moss add restrained colored surfaces.
Keep a chosen hue dark enough for the existing text hierarchy; adapt accent
brightness to at least 4.5:1 over the raised surface. The music timeline uses the
selected accent; a dark album cannot make progress disappear. Native range inputs
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
  Clicking opens the relevant Windows Settings page; System feedback can be disabled.

Runtime styling is in `src/renderer/islet.css`; geometry and activity logic have
dedicated modules and synthetic-data tests.
