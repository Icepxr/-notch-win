'use strict';
// SPDX-License-Identifier: GPL-3.0-or-later
// Claude control-protocol account reading adapted from Vorssaint AgentClaudeServer.
// Authentication remains inside the installed CLI. Never send a user message.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
function findClaude(env = process.env, home = os.homedir()) {
  const name = process.platform === 'win32' ? 'claude.exe' : 'claude';
  const candidates = [path.join(home, '.local', 'bin', name), path.join(home, '.claude', 'local', name)];
  for (const dir of (env.PATH || env.Path || '').split(path.delimiter).filter(Boolean)) candidates.push(path.join(dir, name));
  if (process.platform === 'win32') candidates.push(path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'));
  return candidates.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } }) || null;
}
function signInCommand(executable, runtime = process.execPath) {
  const quote = value => "'" + value.replace(/'/g, "''") + "'";
  return path.extname(executable) === '.js'
    ? "$env:ELECTRON_RUN_AS_NODE='1'; & " + quote(runtime) + ' ' + quote(executable) + ' auth login'
    : '& ' + quote(executable) + ' auth login';
}
function profile(home, env) {
  const file = env.CLAUDE_CONFIG_DIR ? path.join(env.CLAUDE_CONFIG_DIR, '.claude.json') : path.join(home, '.claude.json');
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { organization: data.oauthAccount?.organizationUuid || null,
      fetchedAt: Number.isFinite(data.cachedUsageUtilization?.fetchedAtMs) ? data.cachedUsageUtilization.fetchedAtMs : null };
  } catch { return { organization: null, fetchedAt: null }; }
}
function accountWindows(result, observedAt = Date.now()) {
  if (result?.rate_limits_available !== true || !result.rate_limits) return null;
  const windows = [['five_hour', 300, null], ['seven_day', 10080, null],
    ['seven_day_opus', 10080, 'Opus'], ['seven_day_sonnet', 10080, 'Sonnet']].flatMap(([key, minutes, scope]) => {
    const item = result.rate_limits[key];
    if (!item || !Number.isFinite(item.utilization)) return [];
    const resetsAt = item.resets_at == null ? null : Date.parse(item.resets_at);
    if (resetsAt !== null && (!Number.isFinite(resetsAt) || resetsAt <= observedAt)) return [];
    return [{ id: key, used: Math.max(0, Math.min(100, item.utilization)), minutes, scope, resetsAt }];
  });
  return windows.length ? { windows, observedAt, source: 'account', plan: 'Claude' } : null;
}
function checkEnvironment(base, home) {
  const env = { ...base, DISABLE_AUTOUPDATER: '1' };
  delete env.CLAUDECODE;
  // --setting-sources '' disables user hooks/tools. Preserve explicit traffic
  // opt-outs and the user's network configuration, including corporate CAs.
  try {
    const dir = env.CLAUDE_CONFIG_DIR || path.join(home, '.claude');
    const settings = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'));
    for (const key of ['DISABLE_TELEMETRY', 'DISABLE_ERROR_REPORTING', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
      'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'NODE_EXTRA_CA_CERTS']) {
      if (['string', 'boolean', 'number'].includes(typeof settings.env?.[key])) env[key] = String(settings.env[key]);
    }
  } catch {}
  return env;
}
function readClaudeLimits({ executable = findClaude(), spawnProcess = spawn, timeout = 25000,
  onChild = () => {}, home = os.homedir(), env: baseEnv = process.env, readProfile = profile } = {}) {
  if (!executable) return Promise.resolve({ status: 'missing' });
  return new Promise((resolve) => {
    let child, timer, exitTimer, done = false, buffer = '', stage = 'initialize', reading = null;
    const env = checkEnvironment(baseEnv, home), started = Date.now(), before = readProfile(home, env);
    function finish(value) {
      if (done) return;
      done = true; clearTimeout(timer); clearTimeout(exitTimer);
      if (child) { child.stdin.end(); child.kill(); }
      onChild(null); resolve(value);
    }
    function finishReading() {
      if (!reading) { finish({ status: 'unavailable' }); return; }
      const after = readProfile(home, env);
      if (before.organization !== after.organization || after.fetchedAt && started - after.fetchedAt > 60000) {
        finish({ status: 'unavailable' }); return;
      }
      const limits = accountWindows(reading, Math.min(Date.now(), after.fetchedAt || started));
      finish({ status: limits ? 'ready' : 'unavailable', limits });
    }
    function send(id, request) {
      if (!done && !child.stdin.destroyed) child.stdin.write(JSON.stringify({ type: 'control_request', request_id: id, request }) + '\n');
    }
    const args = ['--print', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
      '--no-session-persistence', '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
      '--setting-sources', '', '--settings', '{"disableAllHooks":true}'];
    const isJs = path.extname(executable) === '.js';
    if (isJs) env.ELECTRON_RUN_AS_NODE = '1';
    try { child = spawnProcess(isJs ? process.execPath : executable, isJs ? [executable, ...args] : args,
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], cwd: home, env }); }
    catch { finish({ status: 'unavailable' }); return; }
    onChild(child);
    timer = setTimeout(() => finish({ status: 'unavailable' }), timeout);
    child.on('error', () => finish({ status: 'unavailable' }));
    child.on('close', () => reading ? finishReading() : finish({ status: 'unavailable' }));
    child.stdin.on('error', () => { if (!reading) finish({ status: 'unavailable' }); });
    child.stderr.resume();
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      if (buffer.length > 2 * 1024 * 1024) { finish({ status: 'unavailable' }); return; }
      let index;
      while (!done && (index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
        let message; try { message = JSON.parse(line); } catch { continue; }
        const response = message.type === 'control_response' && message.response;
        if (!response || response.request_id !== stage) continue;
        if (response.subtype !== 'success') {
          const error = String(response.error || '').toLowerCase();
          finish({ status: /unsupported|unknown/.test(error) ? 'outdated' : /auth|login|sign in/.test(error) ? 'signin' : 'unavailable' }); return;
        }
        if (stage === 'initialize') { stage = 'usage'; send('usage', { subtype: 'get_usage', skip_behaviors: true }); }
        else {
          reading = response.response || {};
          if (reading.rate_limits_available !== true) {
            // An account is present when the CLI profile carries an org; the
            // plan simply does not publish rate limits.
            finish({ status: before.organization ? 'no-limits' : 'signin' });
            return;
          }
          // EOF lets the CLI save its quota-cache timestamp before we verify it.
          child.stdin.end();
          exitTimer = setTimeout(() => { child.kill(); }, 2000);
        }
      }
    });
    send('initialize', { subtype: 'initialize' });
  });
}
module.exports = { findClaude, readClaudeLimits, accountWindows, signInCommand };
