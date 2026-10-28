# Runtime optimization — 28 October 2026

This continues the 26 October pass without lowering the configured animation
rate, changing the notch theme or changing the LocalSend transfer protocol.

## Changes

- Retain morphing-icon contours instead of serializing fresh stream geometry
  each frame. Covers contour count changes and interrupted transitions.
- Reuse the clipboard's row/column panel templates. Reopening the same layout
  preserves its actual items panel, selected card and generated container.
- Parse bounded AI log tails directly as UTF-8. Avoid decoding and splitting
  conversation lines into temporary strings. Return pooled storage only after
  clearing it; no conversation text is retained in the extracted records.
- Enumerate agent logs lazily. Keep at most 65 candidates, retain the previous
  newest-first ordering and stable timestamp ties, and parse at most 64 files.
  Directory depth, reparse-point exclusion and cancellation remain bounded.
- Aggregate provider totals and model groups in single passes. Shorten project
  paths without allocating an array for every path segment.
- Publish LocalSend device lists only when devices/metadata change or expire.
  Discovery announcements and expiry checks continue at their original rates.
  Explicit rescans and manual connections force a fresh publication. Updates
  arriving during a transfer coalesce and replay after completion/cancellation.

## Measurements

Managed allocation per operation in component probes:

| Probe | Before | After | Reduction |
|---|---:|---:|---:|
| Icon morph frame, preserved baseline fixture | 8,560 B | 536 B | 93.7% |
| AI UTF-8 tail read, 28 synthetic records | about 896,120 B | 19,712 B | 97.8% |
| Select latest 65 from 10,000 file candidates | 493,232 B | 14,904 B | 97.0% |
| Group 20,000 usage records by model | 529,176 B | 2,072 B | 99.6% |

The pre-pass production morph probe was 8,248 B/frame, so its reduction is
93.5%. The preserved fixture is an older reference, not that production build.
Icon pixel comparisons pass at 96/144/192 DPI across changing contours and
interrupted animation. Clipboard tests verify object identity, not just counts.
Reader tests compare extracted results with the previous decoding path and
exercise Unicode, CRLF, incomplete lines, invalid bytes, growth and truncation.

These are component allocation results, not whole-application RAM, CPU or FPS
claims. Timings are workload/JIT sensitive. In particular, the retained morph
sample used less allocation but was not consistently faster in CPU time than
the preserved stream fixture; the allocation improvement is the demonstrated
benefit. Raw measurements are under `artifacts/optimization-2026-10-28/` and
the morph probe output is in the Release TRX report.

## Validation

- Expanded Release optimization suite: **389 passed**, no failures/skips.
- Standalone AI core: **14 passed**; standalone AI UI: **10 passed**.
- The allocation regression which failed in the earlier full audit now passes.
- The full 4,000-case suite was not rerun in this pass. Other findings from
  `OPTIMIZATION-2026-10-26.md` remain tracked; this is not a full-suite pass claim.

Reproduce the focused checks on Windows with:

```powershell
pwsh -File scripts/Test-Optimization.ps1
```

## Follow-up: reuse unchanged frame work

Stationary held-pointer frames now skip repeated screen transforms/DPI queries
once their geometry is stable. Pointer release/Escape still get checked, and
pending fades/morphs continue advancing. Layout changes, mutable transform
changes, a replaced transform, and externally changed host bounds invalidate or
bypass the saved anchor. Layout/transform observers exist only for the drag and
detach when it ends. This does not change the live shape preview or snap zones.

Glass clipping keeps at most four frozen silhouettes and four unit-curve tables
per calling thread, avoiding global curve-table locking and rebuilds for a
small interleaved working set. Keys use effective clamped radii and the existing
circular-arc tolerance. Animated frame histories are not retained; older entries
are evicted. This trades a small bounded graphics cache for less repeated work.

Component probes, before/after on this machine:

| Probe | Before | After |
|---|---:|---:|
| Stationary injected pointer, top/left | about 6.0–6.1 us/tick | about 0.05–0.54 us/tick |
| Managed allocation, stationary injected pointer | about 384 B/tick | under 1 B/tick in the probe |
| Four interleaved clip requests | about 16.8 us/call | about 0.03–0.07 us/call |
| Managed allocation, interleaved clip requests | about 7,590 B/call | under 1 B/call in the probe |

The small fractional allocation averages include probe overhead. A separate
warmed 400-call regression checks zero managed allocation for clip-cache hits.
These are hot-path probes with an injected pointer and a four-shape working
set, not physical display FPS or whole-app CPU/RAM measurements. One-off new
silhouettes still need geometry creation. Raw reports and TRX results are in
`artifacts/frame-reuse/`.

Correctness checks compare 120 rendered images against the preserved clipping
implementation at 96/144/192 DPI, exercise bounded eviction and concurrent
consumers, and verify re-anchoring after scale/layout/transform replacement.
The broader full-suite findings from 26 October remain tracked separately.

The final expanded focused Release run passes **469 tests**, with no failures
or skips (94 seconds), including the existing held-button live-preview checks.
