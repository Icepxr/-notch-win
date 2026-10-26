# Runtime optimization — 26 October 2026

This pass covers the WPF application in this repository. It preserves the black
notch, artwork colors, configured animation frame rate and transfer protocol.

## Changes

- **Countdown rendering:** retain the frozen dial face and its 60 marks until
  dimensions change; reuse track and accent pens. The moving arc remains a
  vector. Mutable accent brushes still update correctly.
- **AI dashboard:** build activity/model charts only while details are shown;
  discard chart items and the presentation snapshot when hidden. Reopening
  details immediately uses the latest snapshot, including the selected period.
- **AI metadata:** reuse already-clean strings instead of allocating LINQ
  iterators, temporary character arrays and a second string for each field.
  Control-character filtering and maximum lengths are unchanged.
- **Playback diagnostics:** log media activity when title, artist, application,
  provider or playback state changes. Position heartbeats still reach the UI.
  Per-snapshot and drift-correction diagnostics use the debug level; disabled
  snapshot diagnostics skip prediction and message formatting.
- **LocalSend lifetime:** remove finished jobs from the session immediately.
  Track registration handlers through shutdown so their certificate dependency
  remains alive until they finish. File uploads remain streamed and cancellable;
  their existing 100 ms progress throttle is retained.
- **Hidden sliders:** do not start fill, indicator or rubber-band clocks for
  unloaded, invisible or reduced-motion controls. Hiding/unloading settles the
  presentation and releases these clocks. Visible controls keep their motion.

The existing media capture leases, visibility-scoped system monitoring, shared
UI scheduler, bounded log reader and streamed transfers were reviewed and kept.
This is a targeted optimization pass, not a claim that every subsystem has been
exhaustively profiled.

## Component measurements

Same-process comparisons use the old implementation reproduced in the tests,
warm up both paths and measure managed allocation on the executing thread.

| Operation | Before | After | Allocation reduction |
|---|---:|---:|---:|
| Countdown drawing update | about 40,465 B | about 2,500 B | 93.8% |
| Clean AI metadata field | 400 B | 48 B | 88.0% |

The countdown comparison checks identical pixels over progress changes,
resizing, accent replacement, mutable accents and 96/144/192 DPI. These figures
describe component allocations, not whole-application RAM, CPU or display FPS.
Raw component measurements are written to `artifacts/optimization/*.json`.

The external live-process sample before optimization averaged 1.19% of total
machine CPU, 446.9 MiB private bytes and 522.5 MiB working set over 25 seconds.
The desktop/media workload was not controlled; a restart or different track
can change those values. Do not attribute differences between live samples to
this patch without reproducing the same workload.

The post-launch 25-second sample averaged 1.17% total-machine CPU, 359.9 MiB
private bytes and 418.1 MiB working set. The app remained responsive while
opening media, timer and clipboard panels. These live figures are observations,
not a controlled CPU/RAM improvement claim. Raw samples are in
`artifacts/optimization-before.json` and `artifacts/optimization-after.json`.

## Validation

The new regression coverage checks exact timer pixels, allocation budgets,
metadata sanitization, hidden chart rebuilding, activity-log deduplication and
release of 1,000 completed LocalSend jobs while retaining active jobs.

Slider presentation checks now compare the fill with the rendered active tick,
accounting for the reserved numeric-caption area instead of assuming the fill
uses the control's entire width.

Final Release regression run: **348 passed, no failures or skips**.
Standalone projects: AI UI 10 passed; AI core 14 passed; docking 80 passed.
These standalone projects overlap with the main suite and are not additional
unique feature cases. Run the focused verification with:

```powershell
pwsh -File scripts/Test-Optimization.ps1
```

The earlier whole-application Debug audit completed with **4,065 passed,
37 failed and 6 skipped out of 4,108**. It preceded the final hidden-slider
and tick-alignment fixes; those nine failing slider cases subsequently pass
in the final Release verification. The entire 4,000-case suite was not rerun
afterward. This application is therefore **not certified full-suite green**.

Other findings remain for a separate repair pass:

| Test group | Initial failures | Finding |
|---|---:|---|
| GlassBackdropAlignment | 1 | Reflection signature mismatch |
| HotPathRegression | 1 | Existing morph allocation threshold |
| Localization | 2 | Translation key/fallback mismatches |
| LocalSendWindow | 1 | Font resource expectation |
| LyricsMultilineLayout | 5 | Missing `SubtitleText` test resource |
| MainWindowNavDrag | 1 | Expected tab order omits Agents |
| MainWindowSettingsIntegration | 2 | Preview/cancel assertions |
| MainWindowUpdateNotification | 2 | Null notification test state |
| MainWindowVolumeInteraction | 1 | Fill geometry expectation |
| MediaMetadataRecovery | 1 | SoundCloud title separator handling |
| MusicVisualizerAudioPipeline | 6 | Reflection signature mismatches |
| SettingsWindowControl | 3 | Tab-order persistence timeouts |
| SubjectAwareBlurOptimization | 1 | One-channel, one-level pixel difference |
| TranslationWrittenNumber | 1 | Unicode numeral handling |

Several findings involve code/tests unchanged by this optimization, but an
isolated clean-HEAD baseline was not run; do not assume every failure is
pre-existing. Exact errors and the final passing Release report are retained
locally under `artifacts/optimization-tests/`.
