'use strict';

// Exercises sender.js against a mock LocalSend v2 receiver: checks the
// prepare-upload body, the per-file tokens, and that the bytes arrive intact.

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert');

const { sendFiles, TransferError } = require('../src/sender');
const { generate } = require('../src/identity');

const SELF = {
  alias: 'test-sender',
  version: '2.0',
  deviceModel: 'Windows',
  deviceType: 'desktop',
  fingerprint: 'test-fingerprint',
  port: 1,
  protocol: 'http',
  download: false,
};

function mockReceiver({ pin = null, rejectFileNamed = null } = {}) {
  const received = new Map(); // fileName -> Buffer
  const sessions = new Map();
  let prepareBody = null;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/api/localsend/v2/prepare-upload') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        if (pin && url.searchParams.get('pin') !== pin) {
          res.writeHead(401).end();
          return;
        }
        prepareBody = JSON.parse(body);
        const sessionId = crypto.randomUUID();
        const tokens = {};
        for (const [id, meta] of Object.entries(prepareBody.files)) {
          if (rejectFileNamed && meta.fileName === rejectFileNamed) continue;
          tokens[id] = crypto.randomUUID();
        }
        sessions.set(sessionId, { tokens, files: prepareBody.files });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ sessionId, files: tokens }));
      });
      return;
    }

    if (url.pathname === '/api/localsend/v2/upload') {
      const sessionId = url.searchParams.get('sessionId');
      const fileId = url.searchParams.get('fileId');
      const token = url.searchParams.get('token');
      const session = sessions.get(sessionId);

      if (!session || session.tokens[fileId] !== token) {
        res.writeHead(403).end();
        return;
      }

      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        received.set(session.files[fileId].fileName, Buffer.concat(chunks));
        res.writeHead(200).end();
      });
      return;
    }

    res.writeHead(404).end();
  });

  return {
    server,
    received,
    get prepareBody() { return prepareBody; },
    listen() {
      return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          resolve({
            alias: 'mock',
            address: '127.0.0.1',
            port: server.address().port,
            protocol: 'http',
            fingerprint: 'mock-fingerprint',
            deviceType: 'mobile',
          });
        });
      });
    },
    close() { return new Promise((r) => server.close(r)); },
  };
}

// Real LocalSend receivers speak TLS and *require* a client certificate.
// This mirrors that so a sender missing its certificate fails the test rather
// than only failing on the network.
async function mtlsReceiver() {
  const serverId = await generate();
  const received = new Map();
  const sessions = new Map();
  let sawClientCert = null;

  const server = https.createServer({
    cert: serverId.cert,
    key: serverId.key,
    requestCert: true,         // ask the sender for its certificate
    rejectUnauthorized: false, // accept a self-signed one, as LocalSend does
  }, (req, res) => {
    const peer = req.socket.getPeerCertificate();
    const hasCert = Boolean(peer && peer.raw && peer.raw.length);
    if (sawClientCert === null) sawClientCert = hasCert;

    // Node has no option for "require any certificate, trusted or not":
    // rejectUnauthorized:false lets a certificate-less client through. Real
    // receivers abort the handshake instead, so drop the socket by hand.
    if (!hasCert) {
      req.socket.destroy();
      return;
    }

    const url = new URL(req.url, 'https://localhost');

    if (url.pathname === '/api/localsend/v2/prepare-upload') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const parsed = JSON.parse(body);
        const sessionId = crypto.randomUUID();
        const tokens = {};
        for (const id of Object.keys(parsed.files)) tokens[id] = crypto.randomUUID();
        sessions.set(sessionId, { tokens, files: parsed.files });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ sessionId, files: tokens }));
      });
      return;
    }

    if (url.pathname === '/api/localsend/v2/upload') {
      const session = sessions.get(url.searchParams.get('sessionId'));
      const fileId = url.searchParams.get('fileId');
      if (!session || session.tokens[fileId] !== url.searchParams.get('token')) {
        res.writeHead(403).end();
        return;
      }
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        received.set(session.files[fileId].fileName, Buffer.concat(chunks));
        res.writeHead(200).end();
      });
      return;
    }

    res.writeHead(404).end();
  });

  return {
    received,
    get sawClientCert() { return sawClientCert; },
    listen() {
      return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve({
          alias: 'mtls-mock',
          address: '127.0.0.1',
          port: server.address().port,
          protocol: 'https',
          fingerprint: 'mtls-mock',
          deviceType: 'mobile',
        }));
      });
    },
    close() { return new Promise((r) => server.close(r)); },
  };
}

function tempFile(name, bytes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-test-'));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, bytes);
  return filePath;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('sends two files and the bytes arrive intact', async () => {
  const small = tempFile('note.txt', Buffer.from('สวัสดี notch\n'));
  // Big enough to span several chunks so the progress path is exercised.
  const big = tempFile('blob.bin', crypto.randomBytes(3 * 1024 * 1024));

  const mock = mockReceiver();
  const device = await mock.listen();

  const phases = [];
  const result = await sendFiles(device, SELF, [small, big], {
    onProgress: (p) => phases.push(p.phase),
  });
  await mock.close();

  assert.strictEqual(result.sent, 2, 'both files reported sent');
  assert.strictEqual(result.skipped, 0);

  assert.deepStrictEqual(
    mock.received.get('note.txt'),
    fs.readFileSync(small),
    'text file matches byte for byte',
  );
  assert.deepStrictEqual(
    mock.received.get('blob.bin'),
    fs.readFileSync(big),
    '3 MB file matches byte for byte',
  );

  assert.ok(phases.includes('waiting'), 'reported the waiting phase');
  assert.ok(phases.includes('sending'), 'reported progress while sending');
  assert.strictEqual(phases.at(-1), 'done', 'ended on the done phase');
});

test('prepare-upload body matches the v2 spec', async () => {
  const file = tempFile('spec.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const mock = mockReceiver();
  const device = await mock.listen();
  await sendFiles(device, SELF, [file]);
  await mock.close();

  const body = mock.prepareBody;
  assert.ok(body.info, 'carries an info object');
  assert.strictEqual(body.info.version, '2.0');
  assert.strictEqual(body.info.alias, 'test-sender');

  const entries = Object.entries(body.files);
  assert.strictEqual(entries.length, 1);
  const [id, meta] = entries[0];
  assert.strictEqual(meta.id, id, 'the map key equals the file id');
  assert.strictEqual(meta.fileName, 'spec.png');
  assert.strictEqual(meta.size, 4);
  assert.strictEqual(meta.fileType, 'image/png', 'mime type inferred from the extension');
  assert.strictEqual(meta.sha256, null);
  assert.strictEqual(meta.preview, null);
});

test('a missing PIN surfaces as a pin error, and the PIN then works', async () => {
  const file = tempFile('locked.txt', Buffer.from('x'));
  const mock = mockReceiver({ pin: '123456' });
  const device = await mock.listen();

  await assert.rejects(
    () => sendFiles(device, SELF, [file]),
    (err) => {
      assert.ok(err instanceof TransferError);
      assert.strictEqual(err.kind, 'pin');
      assert.strictEqual(err.status, 401);
      return true;
    },
    'rejects with kind "pin" when no PIN is supplied',
  );

  const result = await sendFiles(device, SELF, [file], { pin: '123456' });
  await mock.close();
  assert.strictEqual(result.sent, 1, 'succeeds once the PIN is given');
});

test('a file the receiver declines is counted as skipped, not failed', async () => {
  const keep = tempFile('keep.txt', Buffer.from('keep'));
  const drop = tempFile('drop.txt', Buffer.from('drop'));
  const mock = mockReceiver({ rejectFileNamed: 'drop.txt' });
  const device = await mock.listen();

  const result = await sendFiles(device, SELF, [keep, drop]);
  await mock.close();

  assert.strictEqual(result.sent, 1);
  assert.strictEqual(result.skipped, 1);
  assert.ok(mock.received.has('keep.txt'));
  assert.ok(!mock.received.has('drop.txt'), 'the declined file was never uploaded');
});

test('a directory is refused before anything is sent', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-dir-'));
  const mock = mockReceiver();
  const device = await mock.listen();

  await assert.rejects(
    () => sendFiles(device, SELF, [dir]),
    (err) => err.kind === 'directory',
  );
  await mock.close();
  assert.strictEqual(mock.prepareBody, null, 'never reached prepare-upload');
});

test('an unreachable device fails as a network error', async () => {
  const file = tempFile('nowhere.txt', Buffer.from('x'));
  const device = {
    alias: 'gone', address: '127.0.0.1', port: 1,
    protocol: 'http', fingerprint: 'gone', deviceType: 'mobile',
  };
  await assert.rejects(
    () => sendFiles(device, SELF, [file]),
    (err) => err.kind === 'network',
  );
});

test('sends over https when a client certificate is supplied', async () => {
  const file = tempFile('secure.txt', Buffer.from('over tls'));
  const identity = await generate();

  const mock = await mtlsReceiver();
  const device = await mock.listen();

  const result = await sendFiles(device, SELF, [file], { identity });
  await mock.close();

  assert.strictEqual(result.sent, 1);
  assert.strictEqual(mock.sawClientCert, true, 'the receiver saw our client certificate');
  assert.deepStrictEqual(mock.received.get('secure.txt'), fs.readFileSync(file));
});

test('an https receiver rejects a sender with no certificate', async () => {
  const file = tempFile('nocert.txt', Buffer.from('x'));
  const mock = await mtlsReceiver();
  const device = await mock.listen();

  // No identity passed: this is the bug that only showed up against a real
  // LocalSend client ("tlsv13 alert certificate required").
  await assert.rejects(
    () => sendFiles(device, SELF, [file]),
    (err) => {
      assert.ok(err instanceof TransferError);
      assert.strictEqual(err.kind, 'network');
      return true;
    },
    'fails rather than silently hanging',
  );
  await mock.close();
});

(async function run() {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log('  ok  ' + name);
    } catch (err) {
      failed += 1;
      console.log('FAIL  ' + name);
      console.log('      ' + (err.message || err).toString().split('\n').join('\n      '));
    }
  }
  console.log('');
  console.log(failed ? failed + ' of ' + tests.length + ' failed' : 'all ' + tests.length + ' passed');
  process.exit(failed ? 1 : 0);
})();
