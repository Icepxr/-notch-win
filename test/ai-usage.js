'use strict';
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { newState, parseLine, summarize, tokens, windows } = require('../src/ai-usage');
const { readLimits } = require('../src/ai-codex');
const now = Date.now();
function line(state, type, payload, at = now) { parseLine(JSON.stringify({ type, timestamp: new Date(at).toISOString(), payload }), state); }
const c = newState('codex', 'file');
line(c, 'session_meta', { id: 'thread', cwd: 'C:\\Work\\Demo' });
line(c, 'turn_context', { model: 'test-model' });
line(c, 'event_msg', { type: 'task_started' }, now - 90000);
const usage = { input_tokens: 100, cached_input_tokens: 40, output_tokens: 20, reasoning_output_tokens: 10 };
line(c, 'event_msg', { type: 'token_count', info: { total_token_usage: usage, last_token_usage: usage } });
line(c, 'event_msg', { type: 'token_count', info: { total_token_usage: usage, last_token_usage: usage } });
assert.equal(summarize([c], now).records.length, 1, 'repeated cumulative snapshots count once');
assert.deepEqual(tokens(usage), { input: 60, cached: 40, write: 0, output: 20, total: 120 }, 'cached and reasoning tokens are not double counted');
line(c, 'token_usage_record', { response_id: 'response', usage });
assert.equal(summarize([c], now).records.length, 1, 'modern usage records replace legacy cumulative fallback');
line(c, 'event_msg', { type: 'task_complete' });
assert.equal(summarize([c], now).sessions[0].status, 'idle');
assert.equal(summarize([c], now + 600001).sessions.length, 0, 'old logs cannot masquerade as live processes');
const duplicate = newState('codex', 'copy');
line(duplicate, 'token_usage_record', { response_id: 'response', usage });
assert.equal(summarize([c, duplicate], now).records.length, 1, 'copied response IDs deduplicate across logs');
const claude = newState('claude', 'file2');
const event = { type: 'assistant', timestamp: new Date(now).toISOString(), sessionId: 's', cwd: 'C:\\Work\\Demo',
  message: { id: 'm', model: 'test-claude', content: [{ type: 'text', text: 'PRIVATE_RESPONSE' }], stop_reason: 'end_turn', usage: { input_tokens: 10, cache_read_input_tokens: 30, cache_creation_input_tokens: 20, output_tokens: 5 } } };
parseLine(JSON.stringify(event), claude); parseLine(JSON.stringify(event), claude);
assert.equal(summarize([claude], now).records[0].total, 65);
assert.ok(!JSON.stringify(summarize([claude], now)).includes('PRIVATE_RESPONSE'), 'transcript content never reaches snapshots');
parseLine('{bad json', claude);
const quota = windows({ primary: { used_percent: 120, window_minutes: 300, resets_at: 123 } }, now);
assert.equal(quota.windows[0].used, 100);
assert.equal(quota.windows[0].resetsAt, 123000);
assert.equal(windows({ primary: { used_percent: null } }), null, 'unknown usage stays unknown');
assert.equal(windows({ limit_id: 'model-bucket', primary: { used_percent: 42 } }), null);

(async () => {
  const calls = [];
  const result = await readLimits({ executable: 'fixture.exe', spawnProcess: (_exe, _args, options) => {
    assert.equal(options.windowsHide, true);
    const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => {};
    let buf = '';
    child.stdin.on('data', (chunk) => {
      buf += chunk; let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); calls.push(msg.method);
        if (!msg.id) continue;
        const value = msg.id === 1 ? {} : msg.id === 2 ? { account: { type: 'chatgpt', email: 'PRIVATE_EMAIL' } } : { rateLimitsByLimitId: { codex: { primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 123 } } }, rateLimitResetCredits: { availableCount: 2 } };
        queueMicrotask(() => child.stdout.write(JSON.stringify({ id: msg.id, result: value }) + '\n'));
      }
    });
    return child;
  } });
  assert.equal(result.limits.windows[0].used, 25);
  assert.equal(result.resets, 2);
  assert.ok(!JSON.stringify(result).includes('PRIVATE_EMAIL'));
  assert.deepEqual(calls, ['initialize', 'initialized', 'account/read', 'account/rateLimits/read'], 'account reader cannot generate tokens or consume resets');
  assert.equal((await readLimits({ executable: null })).status, 'missing');
  console.log('AI usage: deduplication, privacy, lifecycle, quota windows and read-only protocol passed');
})().catch((e) => { console.error(e); process.exitCode = 1; });
