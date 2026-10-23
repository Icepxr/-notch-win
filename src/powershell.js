'use strict';

// Where PowerShell actually is.
//
// Spawning the bare name 'powershell.exe' asks Windows to search, and
// CreateProcessW searches the current working directory before System32. An
// app launched from a downloads folder that happens to contain a file called
// powershell.exe would run that instead - with -ExecutionPolicy Bypass, on
// every bridge start and every restart after one. A trimmed PATH has the
// opposite failure: nothing is found and the bridges never come up.
//
// So the path is resolved once, from the system root the OS tells us, and
// everything that needs PowerShell asks here.

const fs = require('node:fs');
const path = require('node:path');

const SYSTEM_ROOT = process.env.SystemRoot || process.env.windir || 'C:\\Windows';

/** The full path, or the bare name if this machine keeps it somewhere else. */
function resolvePowerShell() {
  const candidates = [
    path.join(SYSTEM_ROOT, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    // 32-bit Node on 64-bit Windows is redirected away from System32.
    path.join(SYSTEM_ROOT, 'Sysnative', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {}
  }
  // Nothing found where Windows keeps it. Fall back to the name so the
  // failure is PowerShell's to report, not a crash here.
  return 'powershell.exe';
}

const POWERSHELL = resolvePowerShell();

module.exports = { POWERSHELL, resolvePowerShell, SYSTEM_ROOT };
