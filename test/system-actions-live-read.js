'use strict';
// Read-only Windows integration check. Never changes volume, brightness or keys.
const { spawn } = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert/strict');
const { normalize } = require('../src/system-actions');
if (process.platform !== 'win32') process.exit(0);
const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
  path.join(__dirname, '..', 'src', 'media', 'system-actions.ps1')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
let buffer = '', count = 0, complete = false;
const timeout = setTimeout(() => fail('Windows system-feedback bridge did not produce live samples'), 10000);
function fail(message) { console.error(message); clearTimeout(timeout); child.stdin.end(); child.kill(); process.exitCode = 1; }
child.on('error', () => fail('Cannot launch Windows system-feedback bridge'));
child.stderr.resume(); child.stdout.setEncoding('utf8');
child.stdout.on('data', chunk => {
  buffer += chunk; let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
    let data; try { data = normalize(JSON.parse(line)); } catch { continue; }
    if (!data || complete) continue;
    assert.equal(typeof data.capsLock, 'boolean');
    if (++count === 3) {
      complete = true; clearTimeout(timeout);
      // stdin stays open until this point, proving the helper can stream while
      // attached to the app, rather than only when started with an EOF pipe.
      child.stdin.end();
      console.log('Windows live bridge: streaming samples, audio=' + (data.volume !== null) + ', WMI brightness=' + (data.brightness !== null) + ', Caps Lock available');
    }
  }
});
child.on('close', () => { if (!complete && !process.exitCode) fail('Windows bridge closed before live samples'); });
