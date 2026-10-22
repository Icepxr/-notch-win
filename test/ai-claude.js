'use strict';
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { accountWindows, readClaudeLimits, signInCommand } = require('../src/ai-claude');
const { AiDashboard } = require('../src/ai-dashboard');
const now = Date.now(), future = new Date(now + 3600000).toISOString();
assert.equal(signInCommand("C:\\O'Brien\\claude.exe"), "& 'C:\\O''Brien\\claude.exe' auth login", 'terminal paths are quoted as PowerShell literals');
const reading = { rate_limits_available: true, rate_limits: { five_hour: { utilization: 25, resets_at: future },
  seven_day: { utilization: 40, resets_at: future }, seven_day_opus: { utilization: 80, resets_at: future } } };
assert.equal(accountWindows(reading, now).windows.length, 3);
assert.equal(accountWindows(reading, now).windows[2].scope, 'Opus');
assert.equal(accountWindows({ rate_limits_available: false }), null);
assert.equal(accountWindows({ rate_limits_available: true, rate_limits: { five_hour: { utilization: null } } }), null);
assert.equal(accountWindows({ rate_limits_available: true, rate_limits: { five_hour: { utilization: 80, resets_at: new Date(now - 1).toISOString() } } }), null);
const noProfile = () => ({ organization: 'same', fetchedAt: now });
function stub(answer = reading, failure = null) {
  const calls = [];
  const spawnProcess = (_exe, args, options) => {
    assert.equal(options.windowsHide, true);
    assert.ok(args.includes('--no-session-persistence') && args.includes('--strict-mcp-config'));
    assert.ok(args.includes('{"disableAllHooks":true}'));
    assert.equal(options.env.CLAUDECODE, undefined);
    const child = new EventEmitter();
    child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => {};
    child.stdin.on('finish', () => queueMicrotask(() => child.emit('close', 0)));
    let buffer = '';
    child.stdin.on('data', chunk => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const request = JSON.parse(buffer.slice(0, index)); buffer = buffer.slice(index + 1);
        calls.push(request);
        const response = { subtype: failure ? 'error' : 'success', request_id: request.request_id,
          ...(failure ? { error: failure } : { response: request.request_id === 'usage' ? answer : {} }) };
        queueMicrotask(() => child.stdout.write(JSON.stringify({ type: 'control_response', response }) + '\n'));
      }
    });
    return child;
  };
  return { spawnProcess, calls };
}
(async () => {
  const fixture = stub();
  const result = await readClaudeLimits({ executable: 'fixture.exe', ...fixture, readProfile: noProfile, env: { CLAUDECODE: 'nested' } });
  assert.equal(result.status, 'ready'); assert.equal(result.limits.windows[0].used, 25);
  assert.deepEqual(fixture.calls.map(x => x.request), [{ subtype: 'initialize' }, { subtype: 'get_usage', skip_behaviors: true }], 'only account-control requests, no model turn');
  assert.equal((await readClaudeLimits({ executable: null })).status, 'missing');
  assert.equal((await readClaudeLimits({ executable: 'fixture.exe', ...stub({}, 'Unsupported control request subtype'), readProfile: noProfile })).status, 'outdated');
  assert.equal((await readClaudeLimits({ executable: 'fixture.exe', ...stub({ rate_limits_available: false }), readProfile: noProfile })).status, 'signin');
  assert.equal((await readClaudeLimits({ executable: 'fixture.exe', ...stub(), readProfile: () => ({ organization: 'same', fetchedAt: now - 3600000 }) })).status, 'unavailable', 'old cached readings cannot masquerade as live quota');
  let version = 0;
  assert.equal((await readClaudeLimits({ executable: 'fixture.exe', ...stub(), readProfile: () => ({ organization: String(++version), fetchedAt: now }) })).status, 'unavailable', 'switching accounts cannot mix quota');
  const dashboard = new AiDashboard({ readClaudeLimits: async () => result });
  await dashboard.refreshClaudeAccount();
  assert.equal(dashboard.snapshot().claudeAccountStatus, 'ready');
  assert.equal(dashboard.snapshot().limits.claude.windows[0].used, 25);
  assert.ok(dashboard.snapshot().providers.includes('claude'));
  dashboard.setClaude([{ sessionId: 'live', status: 'busy', pid: 123 }]);
  assert.equal(dashboard.snapshot().sessions[0].inferred, false);
  dashboard.stop();
  console.log('Claude: read-only protocol, CLI errors, quota windows, stale/account guards and dashboard integration passed');
})().catch(e => { console.error(e); process.exitCode = 1; });
