# V-Notch policy adaptations

`src/media/session-policy.ps1` and the bounded browser-session gap in
`src/renderer/media-state.js` adapt the selection, switch arbitration, and
metadata recovery ideas from [rainaku/V-Notch](https://github.com/rainaku/V-Notch),
revision `b843d2340bacd94bab1b4ea6439fb29b91555f17`:

- `Services/SessionScorer.cs`
- `Services/SessionSwitchArbiter.cs`
- `Services/MediaSessionSelectionPolicy.cs`
- `Services/MediaMetadataRecoveryPolicy.cs`

The upstream source is licensed under Apache-2.0; the complete license is
retained in [licenses/V-Notch-Apache-2.0.txt](licenses/V-Notch-Apache-2.0.txt).
Islet rewrites the policies for sampled SMTC observations in PowerShell:
metadata/source weights are simplified, the latest observed playing source
stays preferred, and pinning identifies an application rather than a browser
tab. The renderer preserves existing Vorssaint metadata grace and adds a
bounded browser-session gap with disabled controls. These are modified
adaptations, not unmodified upstream files. Islet remains GPL-3.0-or-later.
No V-Notch WPF UI, fonts, icons, models, or binary dependencies are bundled.

# Vorssaint source adaptations

This project includes JavaScript adaptations of portions of
[Vorssaint](https://github.com/vorssaint/vorssaint-utils), Copyright (C) 2026 Vorssaint,
licensed under **GPL-3.0-or-later**. The full GPLv3 text is in [LICENSE](LICENSE).

Source revision: `02a13224062342f289753733487f6da85db4e332`.

Adapted files and concepts:

- `UI/Settings/SettingsView.swift`, `NotchSettings.swift`,
  `NotchSettingsTabRow.swift` and `SettingsCard.swift`: the 210px sidebar,
  Layout/Content/Activity/Behavior routing, grouped card metrics, icon rows,
  existing-module order/visibility and keyboard/search navigation. Adapted in
  `settings-navigation.js`, `settings-source.css` and `notch-modules.js`.
- `UI/Notch/NotchView.swift`, `NotchMusicView.swift`, `NotchSectionsView.swift`
  and `Services/Notch/NotchSupport.swift`: page-first chrome, secondary-click
  island commands, responsive shoulders, 344px player reading width,
  56px artwork, 14/13px titles, time labels beside the timeline and complete
  gallery rows. Adapted in `notch-source.css` and `renderer.js`.
- `Services/Notch/NotchSupport.swift` (`capsuleRadius`, `capsulePath`) and
  `UI/Notch/NotchView.swift`: circular compact capsule ends, 28px expanded
  corners and retaining the floating silhouette on hover, adapted in the
  renderer's persistent contour and spring frames.
- `UI/Notch/NotchFilesView.swift`, `UI/Shelf/ShelfTilesView.swift`,
  `NotchClipboardView.swift`, `NotchSystemView.swift`, `NotchTimerView.swift`,
  `NotchScratchpadView.swift` and `NotchAgentsView.swift`: sideways file tiles,
  tray empty state, clipboard search/copy feedback, system overview/details,
  timer ruler/clock/actions, scratchpad insets and paired provider layout.
  Adapted in `notch-source.css`, `renderer.js`, `panel-clipboard.js`,
  `panel-system.js`, `panel-utilities.js`, `panel-ai.js` and `notch-geometry.js`.
- `Core/NotchClipboardSizeStrings.swift`,
  `Services/Clipboard/ClipboardHistoryService.swift` and `UI/Notch/NotchClipboardView.swift`:
  pin order, clear-recent behavior, pointer/key dwell, lifted previews and exit
  timing, adapted in `clipboard.js`, `panel-clipboard.js` and `notch-source.css`.
- `Services/QuickTools/ScratchpadSupport.swift`, `ScratchpadService.swift`
  and `UI/Notch/NotchScratchpadView.swift`: text size bounds, local find actions
  and copy feedback, adapted in `notes-tools.js` and `panel-notes.js`.
- `UI/Notch/NotchScrollEdgeFade.swift`: geometry-dependent 16px scroll fades,
  adapted in `scroll-edges.js` and `notch-source.css`.
- `UI/Notch/NotchTimerRuler.swift`, `NotchTimerView.swift`, `NotchComponents.swift`
  and `Services/Notch/NotchTimerSupport.swift`: centered 14px ruler spacing,
  relative pointer/scroll selection, bounded saved Focus configuration, captured
  cycle settings, explicit phase transitions and 300ms numeric movement.
  Adapted in `timer-tools.js`, `timer-ruler.js`, `timer-source.css`,
  `panel-utilities.js` and `timer.js`; native HTML range/select controls provide
  keyboard interaction and Windows accessibility.
- `UI/Notch/NotchAgentsView.swift`, `NotchAgentComponents.swift`,
  `NotchAgentStrip.swift` and `Services/Notch/NotchAgentSupport.swift`:
  independent provider tiles, paired rows, card order/visibility, quota mode,
  time-window ticks, pressure thresholds, chart inspection and compact readout,
  adapted in `ai-source.css`, `ai-view.js`, `panel-ai.js` and `renderer.js`.

- `Sources/Vorssaint/Services/Notch/NotchSupport.swift`: spring progress,
  per-axis growth/shrink parameters, overshoot bound, settling/frames.
- `Sources/Vorssaint/Services/Notch/NotchGestureSupport.swift`: accumulated
  gesture intent, axis lock, thresholds and one action per physical sequence.
- `Sources/Vorssaint/Services/Notch/NotchTimerSupport.swift`: timer limits,
  rounding and timer/stopwatch/Pomodoro session behavior.
- `Sources/Vorssaint/Services/Notch/NotchMusicSupport.swift`: artwork tint
  normalization and the 1.5-second playback metadata grace period.
- `Sources/Vorssaint/Services/Notch/NotchMusicService.swift`: averaged one-pixel
  sRGB artwork sampling, adapted with the tint normalization in
  `artwork-palette.js` and `renderer.js`. Music timeline/equalizer scoping follows
  `NotchMusicView.swift`; the Windows meter has a minimum contrast adaptation.
  `NotchComponents.swift` and `NotchView.swift` inform the solid black surface.
- `Sources/Vorssaint/UI/Notch/NotchSectionsView.swift`: module gallery navigation.
  The current `islet.css` and renderer use its 86px tile/8px row spacing,
  whole-row stepping and shortcut-label hierarchy. `NotchMusicView.swift` and
  `NotchSupport.swift` inform the 56px artwork and compact player proportions.
- `Sources/Vorssaint/Services/AgentUsage/Harness/CodexReader.swift` and
  `ClaudeReader.swift`: usage counters, deduplication keys and turn lifecycle
  mapping, adapted in `src/ai-usage.js`.
- `Sources/Vorssaint/Services/AgentUsage/AgentCodexServer.swift`: read-only
  account handshake, adapted for Windows in `src/ai-codex.js`.
- `Sources/Vorssaint/Services/AgentUsage/AgentClaudeServer.swift`: read-only
  Claude Code control requests, cache freshness and account-change checks,
  adapted for Windows in `src/ai-claude.js`.
- `Sources/Vorssaint/UI/Notch/NotchAgentsView.swift` and
  `Services/Notch/NotchAgentSupport.swift`: paired cards, periods, provider
  filters, remaining allowance, idle timeout and 80% quota alert behavior.

Platform integrations are implemented for Windows/Electron. Islet is
an independent adaptation; it is not an official Vorssaint release. Vorssaint's
name, icons, logo, signing identity and update feed are not used as this app's branding.

# Provider marks

`src/renderer/assets/providers/` bundles original, unmodified SVG files from
the [OpenAI logo package](https://cdn.openai.com/brand/OpenAI-Logos-2025.zip)
and [Anthropic press kit](https://www.anthropic.com/press-kit), retrieved
2026-10-23. The white OpenAI Blossom identifies the Codex integration; the
Clay Claude Spark identifies Claude. These marks belong to OpenAI and
Anthropic respectively and are not covered by Islet's GPL license.

They identify connected providers within Islet and do not imply endorsement
or affiliation. See [OpenAI's design guidelines](https://openai.com/brand/)
and the trademark guidelines in [Anthropic's legal center](https://www.anthropic.com/legal).
Archive members and SHA-256 hashes are recorded in
`src/renderer/assets/providers/README.md`. All marks load locally; no logo
service or network request is used by the renderer.
