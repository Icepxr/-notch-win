# Vorssaint source adaptations

This project includes JavaScript adaptations of portions of
[Vorssaint](https://github.com/vorssaint/vorssaint-utils), Copyright (C) 2026 Vorssaint,
licensed under **GPL-3.0-or-later**. The full GPLv3 text is in [LICENSE](LICENSE).

Source revision: `02a13224062342f289753733487f6da85db4e332`.

Adapted files and concepts:

- `Sources/Vorssaint/Services/Notch/NotchSupport.swift`: spring progress,
  per-axis growth/shrink parameters, overshoot bound, settling/frames.
- `Sources/Vorssaint/Services/Notch/NotchGestureSupport.swift`: accumulated
  gesture intent, axis lock, thresholds and one action per physical sequence.
- `Sources/Vorssaint/Services/Notch/NotchTimerSupport.swift`: timer limits,
  rounding and timer/stopwatch/Pomodoro session behavior.
- `Sources/Vorssaint/Services/Notch/NotchMusicSupport.swift`: artwork tint
  normalization and the 1.5-second playback metadata grace period.
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

`src/renderer/provider-marks.js` carries Claude's mark, taken from
[simple-icons](https://github.com/simple-icons/simple-icons), whose icon files
are dedicated under CC0 1.0. The mark is a trademark of Anthropic and is used
only to identify Anthropic's product.

No OpenAI mark is included. simple-icons does not carry one, which is what
happens when a brand asks to be left out, so Codex is shown with a mark of our
own rather than a logo lifted from a brand page against that signal.
