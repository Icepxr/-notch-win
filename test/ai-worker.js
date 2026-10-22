'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Worker } = require('node:worker_threads');
const dir = fs.mkdtempSync(path.join(__dirname, '..', '.tmp', 'ai-worker-test-'));
const file = path.join(dir, 'session.jsonl');
const at = new Date().toISOString();
const text = JSON.stringify({ type: 'assistant', timestamp: at, sessionId: 's', cwd: 'C:\\งาน\\ตัวอย่าง', message: { id: 'm1', model: 'test', content: 'PRIVATE', usage: { input_tokens: 10, output_tokens: 5 }, stop_reason: 'end_turn' } });
let worker;
const timer = setTimeout(() => { console.error('AI worker timed out'); worker?.terminate(); process.exitCode = 1; }, 10000);
function scan() { return new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); worker.postMessage('scan'); }); }
(async () => {
  try {
    // Leave half a multibyte Thai character at the end of the first append.
    const bytes = Buffer.from(text + '\n'); const boundary = bytes.indexOf(Buffer.from('งาน')) + 1;
    fs.writeFileSync(file, bytes.subarray(0, boundary));
    worker = new Worker(path.join(__dirname, '..', 'src', 'ai-worker.js'), { workerData: { roots: { claude: [dir] } } });
    assert.equal((await scan()).records.length, 0, 'partial JSON lines wait for completion');
    fs.appendFileSync(file, bytes.subarray(boundary));
    let result = await scan();
    assert.equal(result.records[0].project, 'ตัวอย่าง', 'UTF-8 survives chunk boundaries');
    assert.equal(result.records[0].total, 15);
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
    assert.equal((await scan()).records.length, 1, 'unchanged files do not accumulate counters');
    fs.writeFileSync(file, text.replace('m1', 'm2').replace('"input_tokens":10', '"input_tokens":2') + '\n');
    result = await scan(); assert.equal(result.records.length, 1, 'truncation replaces old scan state');
    console.log('AI worker: incremental reads, partial UTF-8, privacy and truncation passed');
  } finally {
    clearTimeout(timer); await worker?.terminate(); fs.unlinkSync(file); fs.rmdirSync(dir);
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
