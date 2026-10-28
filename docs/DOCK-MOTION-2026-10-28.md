# Dock movement and shape transitions

The previous release changed orientation and size immediately on mouse-up,
then moved the already-changed shell into place over 180ms. This change keeps
the live screen centre, dimensions and corners through the orientation handoff.
Position and geometry then settle on one WPF rendering clock.

- Damped spring timing with zero endpoint velocity. No bounce
  outside the screen edge. Travel duration scales from 220 to 420ms in DIPs.
- Foreground stays visible while moving within the same edge. Cross-edge
  handoffs fade it out over 90ms and back over 140ms on landing.
  The black shell remains visible. Screen-edge flares hide while floating;
  their underlying opacity and current theme remain intact.
- Actual pointer tracking stays direct. Orientation is committed at release,
  preserving the original grab point, capture-loss fallback and hysteresis.
  Pointer updates are coalesced onto distinct WPF rendering timestamps instead
  of competing 16ms timer and high-polling mouse events.
- A new Ctrl-grab interrupts a landing at its live geometry. Releasing without
  another drag still finishes docking instead of stranding an intermediate size.
- Tray placement uses the same transition; reduced motion lands immediately.
- Compact media's retained width clock is detached before the morph. Music
  beginning during a move updates content without installing a competing clock.
- Rendering callbacks detach when the move completes, is interrupted or the
  window closes. There is no idle rendering subscription for docking.

## Validation

Real WPF/native-window frame tests cover all six source/destination directions,
intermediate geometry and screen-centre continuity, standard/island corners,
foreground/flares, re-grab with and without further movement, reduced motion,
closing during motion, music already playing and music starting mid-landing.
They run on the isolated test desktop, not by automating the user's desktop.
Rendered intermediate/settled PNGs are retained locally in `.tmp/.test-output`
beside this checkout; test TRX reports are under `artifacts/dock-motion-tests`.

The initial coordinated-motion pass validated **406 tests**, with no failures
or skips (78 seconds), plus a dedicated docking/music run of **37 tests**.
Run `scripts/Test-Optimization.ps1` to repeat the combined focused suite.
The broader full-suite findings remain in `OPTIMIZATION-2026-10-26.md`; these
focused checks do not imply that the entire repository test suite is green.

## Follow-up: lower frame workload

Move the native window with `SWP_NOSIZE` rather than resending its surface
dimensions each frame. After cross-edge foreground fade-out, temporarily remove
the live content from layout; arrange it once at the destination before fading
it back. The visibility change also pauses the music visualizer's rendering
subscription through its existing visibility handler.

Use rendering timestamps for progress, with a damped spring response instead of
the previous slow-start quintic curve. A 100ms watchdog handles release/hidden
windows when rendering stops; it does not drive normal pointer movement. Both
frame subscriptions and the watchdog stop when motion ends or the window closes.

Before/after probes on the isolated WPF test desktop:

| Work per landing | Previous | Optimized |
|---|---:|---:|
| Live content measure/arrange, top to left | 79 / 79 | 1 / 1 |
| Native bounds messages carrying size, top to left | 73 | 2 |
| Live content measure/arrange, left to top | 76 / 76 | 1 / 1 |
| Native bounds messages carrying size, left to top | 71 | 2 |

These count work, not physical display FPS, whole-app CPU or RAM. Frame counts
and managed allocation totals vary with JIT/runtime/background load. Raw probe
JSON and TRX evidence are under `artifacts/dock-smoothness/`; normal test runs
update the `after` records. Bounds/measure limits are checked in the regression
suite. Native overlay tests, hiding mid-drag/landing, and visible artwork on
same-edge moves are included in the expanded focused checks.

One combined run reported 7,616 bytes in the existing zero-allocation blur
probe; its isolated rerun passed. Its setup now warms both measured blur passes
instead of only the vertical pass, keeping the strict zero-allocation assertion.
This corrects the warm-up scope; the cause of that individual failure was not
proven and no production blur change is claimed.

The final expanded focused Release run passes **420 tests**, with no failures
or skips (80 seconds). It also covers stale callbacks from an interrupted
rendering dispatch: an old callback cannot stop a newer gesture's clock.
