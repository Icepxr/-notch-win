# Multiple displays and side music waveform — 28 October 2026

## Using multiple displays

Open Settings → Devices and enable **Show notch on every display**.
Turn it off to return to the saved Active Monitor selection. The preference
defaults to off for existing installations and is included in settings export,
import and reset. While enabled, the single-monitor picker is disabled.

The application keeps one real notch window on each connected display. Display
interface identities, rather than enumeration order, determine window reuse.
Connecting or disconnecting screens reconciles the window set after a short
debounce; reconnecting the preferred screen restores the primary window there.
Monitor bounds and DPI are resolved separately for each window.

Each window owns its expansion, transitions, timer and presentation state.
Appearance and docking-side preferences are global and synchronize between
windows; this version does not persist a separate docking side for each screen.
Settings opened from any notch use the single primary settings window.

Music detection, clipboard storage/controller and the existing system modules
are shared. Extra windows do not register tray icons, global hotkeys, clipboard
capture, update checks or live translation a second time. Closing a secondary
window detaches its UI without stopping the shared feeds. Closing the application
disposes all secondary windows before the primary services.

Local monitor bindings are excluded from preference merges, so changing an
option on another display cannot replace the user's saved Active Monitor.

## Side music waveform

Side badges use 24 thin, rounded radial bars with space around the artwork.
Opposite bars have equal energy. Overall energy and smoothed band detail are
blended to prevent isolated frequency peaks from making the badge lopsided.
Travel is restrained; the existing song-derived colour remains in use.

Radial rendering no longer enters the horizontal five-bar play/pause morph.
The top layout continues to use its existing linear waveform and feedback.

## Validation

The focused Release regression command passes **479 tests**, no failures/skips:

```powershell
./scripts/Test-Optimization.ps1 -DotNetExe ../dotnet-sdk/dotnet.exe -NoRestore
```

New coverage includes simulated two/three-display attachment, removal,
reordering and duplicate identities; production host enable/disable against the
test desktop's connected displays; independent WPF windows sharing media and
clipboard; settings merge/toggle behaviour; and radial pixel renders at
96/144/192 DPI with play/pause feedback. Physical cable removal/reconnection
and every mixed-DPI hardware combination are not manually verified.

The raw focused report is under `artifacts/optimization-tests/`. Standalone
waveform PNGs are generated in the local `.test-output` directory. Previous
unrelated full-suite findings remain tracked separately.
