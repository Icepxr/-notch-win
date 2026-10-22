'use strict';
// SPDX-License-Identifier: GPL-3.0-or-later
// Read-only app-server handshake adapted from Vorssaint AgentCodexServer.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { windows } = require('./ai-usage');
function findCodex(env = process.env) {
  const candidates = [];
  for (const dir of (env.PATH || env.Path || '').split(path.delimiter)) candidates.push(path.join(dir, process.platform === 'win32' ? 'codex.exe' : 'codex'));
  const root = path.join(env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'OpenAI', 'Codex', 'bin');
  try { for (const e of fs.readdirSync(root)) candidates.push(path.join(root, e, 'codex.exe')); } catch {}
  candidates.push(path.join(os.homedir(), '.local', 'bin', process.platform === 'win32' ? 'codex.exe' : 'codex'));
  return candidates.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } }) || null;
}
function readLimits({ executable = findCodex(), spawnProcess = spawn, timeout = 18000, onChild = () => {} } = {}) {
  if (!executable) return Promise.resolve({ status: 'missing' });
  return new Promise((resolve) => {
    let child, timer, done = false, buffer = '';
    function finish(value) {
      if (done) return; done = true; clearTimeout(timer);
      if (child) { child.stdin.end(); child.kill(); }
      onChild(null); resolve(value);
    }
    const send = (id, method, params = {}) => { if (!done && !child.stdin.destroyed) child.stdin.write(JSON.stringify({ ...(id === null ? {} : { id }), method, params }) + '\n'); };
    try { child = spawnProcess(executable, ['-c', 'features.plugins=false', 'app-server'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], cwd: os.homedir() }); } catch { finish({ status: 'unavailable' }); return; }
    onChild(child);
    timer = setTimeout(() => finish({ status: 'unavailable' }), timeout);
    child.on('error', () => finish({ status: 'unavailable' }));
    child.on('exit', () => finish({ status: 'unavailable' }));
    child.stdin.on('error', () => finish({ status: 'unavailable' }));
    child.stderr.resume(); // Never log auth/account response bodies.
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (part) => {
      buffer += part;
      if (buffer.length > 2 * 1024 * 1024) { finish({ status: 'unavailable' }); return; }
      let pos;
      while ((pos = buffer.indexOf('\n')) >= 0 && !done) {
        const line = buffer.slice(0, pos); buffer = buffer.slice(pos + 1);
        let msg; try { msg = JSON.parse(line); } catch { continue; }
        if (msg.method) continue;
        if (msg.error) { finish({ status: 'unavailable' }); return; }
        if (msg.id === 1) { send(null, 'initialized'); send(2, 'account/read', { refreshToken: false }); }
        if (msg.id === 2) {
          if (!['chatgpt', 'chatgptAuthTokens', 'personalAccessToken'].includes(msg.result?.account?.type)) { finish({ status: 'signin' }); return; }
          send(3, 'account/rateLimits/read');
        }
        if (msg.id === 3) {
          const result = msg.result || {};
          const bucket = result.rateLimitsByLimitId?.codex || result.rateLimits;
          const limits = windows(bucket || {}, Date.now(), 'account');
          finish({ status: limits ? 'ready' : 'unavailable', limits,
            resets: Number.isInteger(result.rateLimitResetCredits?.availableCount) ? result.rateLimitResetCredits.availableCount : null });
        }
      }
    });
    send(1, 'initialize', { clientInfo: { name: 'islet', title: 'Islet', version: '0.1.0' } });
  });
}
module.exports = { findCodex, readLimits };
