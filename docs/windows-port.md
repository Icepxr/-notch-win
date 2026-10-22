# Windows adaptation of the notch

Source: [vorssaint/vorssaint-utils](https://github.com/vorssaint/vorssaint-utils)
at `02a13224062342f289753733487f6da85db4e332`, inspected 2026-10-22.
License and attribution: [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

This adapts the Dynamic Island/notch into the Islet application.
SwiftUI, AppKit and macOS frameworks are replaced with Electron/Chromium,
Node.js and Windows WinRT. It is not a Windows build of the complete macOS toolkit.

## Source-level ports

| Upstream source | Local implementation | Behavior |
|---|---|---|
| `NotchSupport.swift / NotchMotion` | `src/renderer/notch-motion.js` | Separate width/height springs, bounded overshoot, settle sampling, exact final size |
| `NotchGestureSupport.swift` | `NotchMotion.Gesture` | Accumulated intent, axis lock, one action per sequence, blocked native controls stay blocked |
| `NotchTimerSupport.swift / NotchTimerSession` | `src/timer.js` | Anchored countdown/stopwatch, pause/resume, explicit Pomodoro phase advancement |
| `NotchMusicSupport.swift` | `media-state.js`, `notch-motion.js` | 1.5s metadata grace and normalized album artwork tint |
| `NotchSectionsView.swift` | Explore gallery | Searchable module destinations with keyboard navigation |
| `NotchMusicView.swift` | Music page | Cover/title, full-width timeline, centred transport, paused cover scale, real source selection |

The source parameters are translated rather than executed as Swift. Browser
wheel events have no AppKit phase/momentum API, so a 350ms gap delimits a
physical sequence; direction and thresholds follow the source.

## Working Windows modules

| Module | Windows implementation |
|---|---|
| Send/files | LocalSend v2, native Explorer drag out/reveal, file-type grid, device drop targets |
| Now Playing | WinRT SMTC, play/pause/previous/next, seeking when supported, selection among real registered apps |
| Clipboard | Electron clipboard, local history, preview search, keyboard copy, confirmation and pause |
| System | Node CPU/memory/disk/uptime with sparklines |
| AI monitor | Codex/Claude log counters, live/recent sessions, provider/period filters, remaining Codex account quota/reset windows, trend, model/project breakdown, activity and card visibility |
| Timer | Main-process monotonic clock, countdown/Pomodoro/stopwatch, compact activity, completion notice |
| Scratchpad | Local UTF-8 file, atomic writes, debounced autosave and shutdown flush |
| Settings | Saved auto-dismiss, music preview, gestures, Notch/Capsule, chosen/primary/cursor display modes and live monitor inventory |

Timer state stays in memory, as upstream does. It continues while the renderer
is collapsed or refreshed and resets when the application exits. Notes and
preferences survive a restart.

The interface, tooltips, notifications and transfer errors are in English.
User-supplied file names, song metadata and notes keep their original language.

## External displays

`src/displays.js` owns placement and screen events. Chosen displays are remembered
through disconnect/reconnect; a missing monitor falls back to the primary without
overwriting the preference. A unique monitor label can recover a changed Windows
display ID; identical labels are not guessed. Primary and cursor modes are also
available in Settings and the tray. Cursor mode waits 400 ms and only follows while
closed and idle; explicit shortcut activation moves immediately.

Screen, cursor and window positions use Electron DIP coordinates, including
negative origins. DPI scale is not applied twice. Small screens fit the stable
backing surface using renderer zoom, and pointer hit testing compensates for zoom.
Display changes update the picker live and keep the window centered after rotation,
resolution, work-area and scaling changes. The OS configuration is never changed.

Verified on this Windows machine with two actual displays at 100% and 150% scaling,
including hidden native-window moves. Simulated tests cover unplug/reconnect,
negative/vertical layouts, changed IDs, duplicate names, small screens and cursor
debouncing. Physical cable unplugging was not automated.

## Remaining platform integrations

AI monitoring currently supports Codex and Claude Code. OpenCode/Copilot readers,
Claude account quota, account switching and API cost estimation are not ported.
Codex account quota is read through the local `codex app-server` with the existing
sign-in. No credentials are copied, inference started or reset credits consumed.
Log-derived session activity is explicitly labeled and expires after ten minutes.
Completion notifications require a newly observed end of a turn lasting at least
60 seconds. Account usage crossing 80% produces a quota notification.

Upstream's per-app mixer/output routing, calendar integration, notification
mirroring, lyrics/queue providers, screen capture, downloads watcher, window
manager and hardware/fan controls have not been ported. They are not exposed as
working buttons in the gallery. In particular, macOS audio taps, Apple Events,
EventKit, Accessibility, IOKit and Dock integrations cannot run on Windows as-is.

The compact bars indicate playback state; no loopback audio capture is enabled.
The transparent Windows host now keeps a fixed backing surface, including the
largest AI panel and spring overshoot. Only painted shell bounds change; native
hit testing follows the painted shape. Fixed-size content layers avoid per-frame
text reflow. Outgoing music artwork fades within 65 ms during collapse; unchanged
SMTC polls neither reload its image nor restart the spring. Marquee measurement
runs on metadata/layout changes rather than the 250 ms progress timer.
LocalSend on the receiving iPad and the same LAN are still required for a real
transfer. Protocol tests use local receivers and do not send the user's files.

## Verification

- `npm test`: LocalSend round trips; media state/command validation; spring,
  gesture and timer behavior; persistent notes; clipboard; AI; system stats.
- `npm run test:ui`: isolated Electron with synthetic data, including gallery,
  source selection, transfer/PIN states, timer, notes, appearance and preferences.
- `node test/media-live-read.js`: reads a real Windows SMTC state once without
  changing playback or volume.
- `node test/ai-live-read.js`: read-only AI history/account integration check;
  prints counts/status only, never conversation content or account identifiers.
- `electron test/displays-live-read.js`: inventories actual displays and verifies
  hidden native window bounds at each display’s DPI without changing OS settings.
- `docs/previews/`: screenshots rendered by the actual Electron renderer.
