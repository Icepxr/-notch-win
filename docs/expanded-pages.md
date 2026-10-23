# Expanded pages: content contract and review handoff

Branch: `codex/expanded-pages`. Started at `e84def6`, rebased onto local
`main` at `29f7ccb`. No merge or push. Work lives in an isolated checkout at
`.tmp/expanded-pages` so the transition and music sessions can keep their
primary checkout. No production services run in the screenshot harness.

## Delivered scope, and two explicit integration gaps

Seven existing notch panels now use one content structure: Send files, Music,
Clipboard, System, AI Agents, Timer and Notes. Existing controls are moved,
not recreated; their event listeners and IPC services stay attached. Music's
one new header action forwards to the existing lyrics toggle, including its
Shift-click local-LRC path. Notes' new retry calls the existing save service.

**Settings is a separate window, not an eighth notch panel.** The renderer
routes that destination to `openSettings()` before selecting a panel.
`settings.html`, `settings.css` and `settings-source.css` are outside this
task's ownership. Its screenshot is included as evidence of that gap, not
presented as a redesigned eighth page. The owner must either authorize those
files for the same chrome or expose a real Settings section/navigation route.
Adding an unreachable dummy section would not satisfy that requirement.

**Five panels still have fixed native shell heights.** This branch publishes
their measured requests without taking over native sizing or morphs. Timer
and AI already expose height methods consumed by the renderer, so those
methods now return measured requests. Send, Music, Clipboard, System and Notes
need the renderer owner to read the same contract; see the exact handoff below.
The remaining dead bands are measured and listed, rather than hidden with a
different card height or a patch to the forbidden geometry/state machine.

## Structure and source values

The source audit table in `vorssaint-audit/README.th.md` and the source overrides
in `design-tokens.md` supply the values. This is a compact desktop utility;
its existing 28px header is retained rather than applying generic website sizes.

| Part | Value |
| --- | --- |
| Content left/right inset | existing `--source-inset`: 28px |
| Top/bottom inset | 16px / 16px |
| Persistent page header | 28px |
| Header-to-content and content row gap | existing `--source-row-gap`: 10px |
| Group radius / inner padding | existing `--source-card-radius`: 16px / 16px |
| AI group heading-to-content gap | 13px |
| Clipboard row icon / text gap | 26px / 12px |
| Preferred height bounds | 180px through min(510px, viewport height minus 32px) |

Each panel has `.expanded-page-header` and `.expanded-page-content`. The page
name is at the left. The primary action ends 144px before the header's right
edge, leaving the existing Explore/pager controls at the right. Actual primary
controls are Add files, Show/Hide lyrics, Pause/Resume history, Overview,
Refresh AI, Start/Pause/Resume timer, and Copy note. Overview is disabled until
there is a detail to return from; copy is disabled for an empty note.

`expanded-pages.js` installs after the existing panel modules mount. A local
external script is loaded from the owned `panel-clipboard.js` entry point;
no script tag outside the owned section blocks was edited. The module is UMD,
has no dependencies, and neither calls native resize nor changes shell sizing.
DOM text is copied with `textContent`; CSSOM writes are used for numeric
properties. No literal inline style attributes or inline scripts were added.

Open-content selectors are scoped under
`body.expanded-pages-ready:is(.state-open,.is-shrinking)`. The outgoing content
retains its layout while fading during collapse; no compact/hover element is
styled by these rules. Surfaces remain black; outlined groups
provide hierarchy. Music supplies linework and time-label color. Blurred art
is restricted to the expanded lyric column, hidden when lyrics are hidden,
and removed for reduced transparency. File-type icon artwork keeps its pastel
fill with darker lettering for legibility.

## Cascade checked from the actual page

The brief's nine-sheet order does not match `index.html`. The loaded order is:

1. `style.css`
2. `panels.css`
3. `notch.css`
4. `islet.css`
5. `notch-source.css`
6. `ai-source.css`
7. `timer-source.css`
8. `music-source.css`

Settings loads only `settings.css`, then `settings-source.css`.

The new rules outrank later general/module selectors through the open-state
scope. The Timer primary rule also includes the action ID: class specificity
alone cannot beat the late `#timer-action` absolute positioning. Timer's old
344px maximum width is explicitly removed from the panel root so the header
aligns with other pages. Its ruler and controls remain in its own content area.
The legacy `.np { padding: 0 !important }` remains effective; no competing
important padding rule was introduced. The player reserves the 4px transport
overshoot below its 104px grid so lyrics-only music does not gain a scrollbar.

## Measured before and after

Measured offscreen with a 520px shell and default preferences. Empty shelf,
clipboard, note and timer; AI without account data; a synthetic Spotify track
for Music. Before measurements were collected at `e84def6`. The subsequent
transition commits did not change these panel styles. Numbers are CSS pixels,
rounded to whole pixels except where useful for music alignment.

| Page | Old header height/width | New header height/width | Old row gap | New gap | Old shell height | New requested height | Current shell height | Native gap still pending |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Send files | 28 / 464 | 28 / 464 | 9 | 10 | 350 | 295 | 350 | 55 |
| Music | 28 / 28, name hidden | 28 / 464 | 12 | 10 | 260 | 216 | 260 | 44 |
| Clipboard | 28 / 464 | 28 / 464 | 9 | 10 | 390 | 192 | 390 | 198 |
| System | 28 / 464 | 28 / 464 | 9 | 10 | 180 | 180 | 180 | 0 at minimum; details still fixed |
| AI Agents | 28 / 464 | 28 / 464 | 9 | 10 | 280 | 290 | 290 | 0 |
| Timer | 28 / 464 | 28 / 464 | 8 | 10 | 260 | 248 | 248 | 0 |
| Notes | 28 / 464 | 28 / 464 | 9 | 10 | 350 | 264 | 350 | 86 |
| Settings window | 42px titlebar | unchanged | separate sheet | unchanged | 760px fixture window | not a notch request | unchanged | separate owner |

All seven notch pages use padding `[16,28,16,28]`; Music previously used
`[22,28,16,28]`. The body demand is measured without stretching it to consume
the native shell's leftover height. The System request has 10px of intentional
minimum-height allowance above its 170px natural demand.

The brief was directionally right about Music's missing band, but the old
header was not literally absent: a 28px-wide Explore-only header remained.
The dead-space diagnosis is accurate. Most other pages already shared outer
insets; their content rhythm and control locations were the inconsistent parts.
There are 27 current unit command entries, rather than the brief's 24.

### Music continuity

Open keeps hover's three columns (`96px / 1.35fr / 1fr`), 16px column gaps,
96px artwork, 20px cover corners, 14px title, and 44px transport targets.
Timeline coordinates relative to the cover are `(112,36.25)` open versus
`(112,36)` hover. Transport is `(112,60)` in both. The timeline is 3.5px high.
Both time labels use the existing music color and 10px type; the right label
shows total duration like hover. The original remaining-time service element
is preserved but hidden, and a separate visible duration mirrors hover's label.

The middle column has less horizontal room because the required open inset is
28px and hover uses 20px. Open uses the same column proportions rather than
distorting the art or moving controls to a different row. The source selector
and service feedback occupy the added rows below the player. Existing main
subtitle text still includes album/app, because its painter is owned by the
renderer session; that is a documented remaining text difference from hover.
Hover's newer light outside the left cover is not duplicated onto the open
surface: the brief authorizes atmosphere only behind lyrics. The cover tile's
size, corners and wide-image fitting are retained.

There is one accessibility exception to exact time-color equality: the shared
artwork palette guarantees only 3:1 for interactive linework. A dark blue cover
therefore cannot supply readable 4.5:1 text unchanged. This branch keeps every
already-readable color byte-for-byte, and lightens only the open time labels
when necessary through `--expanded-time-accent`. The meter and source tint are
unchanged. The palette/hover owner should adopt the exported pure
`ExpandedPages.timeColor(hex)` rule for hover text too; this branch does not
write to hover or the forbidden palette/media implementation. Exact color
equality is tested with readable artwork, plus a dark-art test requires 4.5:1.

The lyric column mirrors the existing hover presentation and provider state;
it does not perform another LRCLIB request or hold a second lyric clock. The
harness clicks the new header action, observes the real pending IPC call, then
returns synthetic synced lines and verifies both presentations agree. Captured
lyric pixels pass 4.5:1 against their actual backdrop.

## Height handoff for the renderer owner

The public read API is `window.ExpandedPages.requestFor(panelId)`. It returns
an immutable record (or null before that page is measured):

```js
{ id, content, needed, requested, min, max, overflow }
```

`needed` includes top/header/gap/content/bottom. Nested clipboard, AI and note
scroll overflow is counted before clamping. `requested` respects the bounds;
the minimum yields to the available viewport on exceptionally small surfaces.
The AI card editor asks for the bounded maximum while open. Overflow remains
scrollable instead of clipping the header. ResizeObserver, content mutations,
input/change events and existing layout events coalesce into one animation-frame
measurement. No work runs on the inactive/compact presentation.

Scrollable clipboard/AI regions can use the current panel's available height.
A long note grows its editor from 128px into the available space, then scrolls;
its measurement is cached by value, width, font and budget. This adapts again
when the renderer starts consuming the larger height, rather than leaving a
fixed 128px editor inside a newly enlarged page.

On a changed request the active section dispatches bubbling `islet:page-height`
and the existing `notch:layout`, with a copy of the record in `event.detail`.
It also sets `data-preferred-height` and CSSOM `--expanded-requested-height` on
the section for inspection. These values do not directly set shell/window height.

The needed owner change is in `renderer.js`'s `geometryFor('open')`: for all
active panels (including System detail), choose the existing width/shape preset
and replace its fixed height with this record's `requested` when available.
Keep the gallery branch, native backing-surface reserve, morph interruption and
display clamping in the renderer owner's implementation. Its current layout
listener already schedules geometry; it currently ignores event detail, and
only Timer/AI get dynamic values through their public module methods.
When integrating, promote the harness's actual-versus-requested assertion from
Timer/AI to every panel. Until then the table above is the outstanding work.

Settings additionally needs its navigation/content ownership resolved before
it can consume this structure or publish a comparable height request. Header
gesture listeners are still attached to the existing global header/pager; the
renderer owner should attach those handlers to the new page header band too.

## States and verification

Existing Send discovery, transfer/PIN errors, clipboard empty/search/paused and
copy errors, media empty/unavailable/source/command errors, and AI account states
remain connected to their services. New handling adds:

- Notes: saving text, visible save failure with retained draft, retry through
  `saveNote`, and disabled retry during an outstanding save.
- Timer: pending-command words and `aria-busy`, then the existing real error
  and re-enabled action if the reply fails.
- AI: pending refresh words and `aria-busy`; failures immediately re-enable
  retry instead of imposing the successful-request cooldown.
- System: waiting/unavailable sensor words, disabled readings while unavailable,
  safe malformed/error samples, and recovery on the next valid reading.

`test/expanded-pages-checks.js` runs from the existing `renderer-smoke.js`, so
`npm run test:ui` includes it without editing the unowned package script. It
checks equal header origin/height/width, primary-action placement, padding/gap,
independently measured demand within 2px after bounds, black shells, text
contrast over composed solid/gradient backgrounds, music geometry/colors,
lyric provider wiring/pixel contrast, populated clipboard growth and source
dimensions, empty wording, slow services, errors, retry and recovery. It only
asserts native height consumption where it is actually integrated (AI/Timer).

`test/expanded-pages.js` is the standalone hidden-window report/screenshot entry
point. Its top-level requires are guarded, paths normalized to `/`, asynchronous
errors caught, and it exits directly rather than destroying live fixture windows
while requests are pending. It never opens production discovery or providers.
The existing main renderer harness's imports are now guarded too.

Validation commands:

```text
npm test
npm run test:ui
npx electron test/expanded-pages.js
```

Validation on 2026-10-23: unit command exit 0; complete UI command exit 0;
standalone expanded-page harness 103 checks, exit 0. After adaptive scroller
sizing, the affected Source details (32 checks) and AI source (32 checks)
suites also pass. The latest lyric capture measured 19.95:1 contrast.
Ownership verification compared HTML with all panel sections stripped and
confirmed the rest of `index.html` is byte-equivalent after newline
normalization. No forbidden source file or package manifest changed.

Five existing assertions encode the superseded design and were updated:

- `test/music-playback-ui.js`: 76px cover / 16px title becomes 96px / 14px,
  because this task explicitly requires matching hover. Full-width fit and
  the 260px native-shell assertion remain.
- The same suite's narrow-player check now requires the timeline width and
  left edge to equal the middle text column, instead of spanning the whole
  panel. Its horizontal/vertical overflow and transport-bottom checks remain.
- `test/modules-source.js`: the running timer's constant 230px becomes equality
  to its measured request, still no taller than 230px; the original no-overflow
  assertion remains.
- `test/ai-source.js`: an all-hidden AI layout's constant 280px becomes equality
  to its measured request, below the 510px ceiling. The real Show all recovery
  control and its behavioral test remain.
- `test/notch-theme-ui.js`: neutral time labels become music-colored time
  labels, as requested. The same assertion still requires a neutral backdrop
  and shell edge; both labels are checked, with an added dark-art text contrast
  check. All black-pixel assertions remain.

No existing behavioral assertion was removed or relaxed.

`test/expanded-pages-contract.js`, included by the existing unit module suite,
checks the public text contrast guarantee over 216 RGB colors and ensures
already-readable colors remain unchanged. The offscreen report also checks
that the outgoing expanded cover does not change size during collapse.

Screenshots (generated by the harness, with the separate Settings gap explicit):

- [Send files](previews/expanded-send.png)
- [Music](previews/expanded-media.png), [synced lyrics](previews/expanded-music-lyrics.png)
- [Clipboard](previews/expanded-clipboard.png), [saved item](previews/expanded-clipboard-item.png)
- [System](previews/expanded-system.png)
- [AI Agents](previews/expanded-ai.png)
- [Timer](previews/expanded-timer.png)
- [Notes](previews/expanded-notes.png), [save error](previews/expanded-notes-error.png)
- [Settings — unchanged separate window](previews/expanded-settings.png)
