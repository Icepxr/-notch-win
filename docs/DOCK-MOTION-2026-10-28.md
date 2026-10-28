# Dock movement and shape transitions

The previous release changed orientation and size immediately on mouse-up,
then moved the already-changed shell into place over 180ms. This change keeps
the live screen centre, dimensions and corners through the orientation handoff.
Position and geometry then settle on one WPF rendering clock.

- Smooth, monotonic timing with zero endpoint velocity/acceleration. No bounce
  outside the screen edge. Travel duration scales from 220 to 420ms in DIPs.
- Foreground fades out over 90ms during pickup and back over 140ms on landing.
  The black shell remains visible. Screen-edge flares hide while floating;
  their underlying opacity and current theme remain intact.
- Actual pointer tracking stays direct. Orientation is committed at release,
  preserving the original grab point, capture-loss fallback and hysteresis.
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

The combined focused Release suite passes **406 tests**, with no failures or
skips (78 seconds). The final dedicated docking/music suite passes **37 tests**.
Run `scripts/Test-Optimization.ps1` to repeat the combined focused suite.
The broader full-suite findings remain in `OPTIMIZATION-2026-10-26.md`; these
focused checks do not imply that the entire repository test suite is green.
