'use strict';

// Discovery parses packets from anyone on the network, so these tests are
// mostly about what a hostile or broken peer can make us do. The rule is that
// a bad packet costs us the packet, never the process.

const assert = require('node:assert');
const { Discovery, PROTOCOL_PORT } = require('../src/discovery');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const SELF = {
  alias: 'Test', fingerprint: 'self-fp', port: 53318,
  protocol: 'https', deviceModel: 'Windows', deviceType: 'desktop',
};

function discovery() {
  const d = new Discovery({ ...SELF });
  d.on('log', () => {}); // a listenerless 'error' would be the only throwing path
  return d;
}

/** Deliver a packet the way the socket would. */
function packet(d, body, address = '10.0.0.5') {
  d._onMessage(Buffer.from(JSON.stringify(body), 'utf8'), { address });
}

/** The coalesced device list, once it lands. */
function devices(d) {
  return new Promise((resolve) => {
    d.once('devices', resolve);
    setTimeout(() => resolve(null), 1500);
  });
}

test('a packet whose alias is not a string cannot crash the sort', async () => {
  const d = discovery();
  // This is the shape that killed the app: the comparator called
  // alias.localeCompare on a number, inside the dgram listener, where
  // nothing catches it.
  for (const alias of [1, {}, [], true, null]) {
    packet(d, { fingerprint: 'peer-' + String(alias), alias });
  }
  const list = await devices(d);
  assert.ok(Array.isArray(list), 'a list still arrives');
  assert.ok(list.every((entry) => typeof entry.alias === 'string'),
    'every alias that reaches a consumer is a string');
  d.stop();
});

test('malformed packets are dropped rather than thrown', () => {
  const d = discovery();
  // None of these may throw: the socket listener has no caller to catch it.
  assert.doesNotThrow(() => d._onMessage(Buffer.from('not json'), { address: '10.0.0.5' }));
  assert.doesNotThrow(() => d._onMessage(Buffer.from('null'), { address: '10.0.0.5' }));
  assert.doesNotThrow(() => d._onMessage(Buffer.from('[1,2,3]'), { address: '10.0.0.5' }));
  assert.doesNotThrow(() => d._onMessage(Buffer.from('{}'), { address: '10.0.0.5' }));
  assert.doesNotThrow(() => packet(d, { fingerprint: 42 }));
  assert.strictEqual(d.devices.size, 0, 'none of them became a device');
  d.stop();
});

test('our own announcement is ignored', () => {
  const d = discovery();
  packet(d, { fingerprint: SELF.fingerprint, alias: 'Me' });
  assert.strictEqual(d.devices.size, 0);
  d.stop();
});

test('the device table is capped, so a flood cannot grow it without end', () => {
  const d = discovery();
  for (let i = 0; i < 500; i += 1) packet(d, { fingerprint: 'peer-' + i, alias: 'Peer ' + i });
  assert.ok(d.devices.size <= 64, 'size ' + d.devices.size + ' stays within the cap');
  d.stop();
});

test('a long alias is truncated and control characters are dropped', () => {
  const d = discovery();
  packet(d, { fingerprint: 'peer', alias: 'A'.repeat(5000) });
  assert.strictEqual(d.devices.get('peer').alias.length, 64);

  packet(d, { fingerprint: 'peer2', alias: 'iPad\n[identity] fingerprint leaked' });
  assert.strictEqual(d.devices.get('peer2').alias, 'iPad[identity] fingerprint leaked',
    'an alias cannot forge a newline into the log or the list');
  d.stop();
});

test('an absent alias falls back to the address it came from', () => {
  const d = discovery();
  packet(d, { fingerprint: 'peer' }, '192.168.1.40');
  assert.strictEqual(d.devices.get('peer').alias, '192.168.1.40');
  d.stop();
});

test('a nonsense port becomes the protocol port instead of being sent to', () => {
  const d = discovery();
  for (const [fp, port] of [['a', 0], ['b', -1], ['c', 70000], ['d', 'eighty'], ['e', 1.5], ['f', NaN]]) {
    packet(d, { fingerprint: fp, port });
    assert.strictEqual(d.devices.get(fp).port, PROTOCOL_PORT, JSON.stringify(port) + ' is not a port');
  }
  packet(d, { fingerprint: 'ok', port: 8080 });
  assert.strictEqual(d.devices.get('ok').port, 8080, 'a real port survives');
  d.stop();
});

test('device type comes from a known set, and protocol defaults to https', () => {
  const d = discovery();
  packet(d, { fingerprint: 'a', deviceType: 'mobile', protocol: 'http' });
  assert.strictEqual(d.devices.get('a').deviceType, 'mobile');
  assert.strictEqual(d.devices.get('a').protocol, 'http');

  packet(d, { fingerprint: 'b', deviceType: '<script>', protocol: 'gopher' });
  assert.strictEqual(d.devices.get('b').deviceType, 'desktop', 'an unknown type is not passed on');
  assert.strictEqual(d.devices.get('b').protocol, 'https');
  d.stop();
});

test('an IPv4-mapped IPv6 address is recorded in its plain form', () => {
  const d = discovery();
  packet(d, { fingerprint: 'peer' }, '::ffff:192.168.1.7');
  assert.strictEqual(d.devices.get('peer').address, '192.168.1.7');
  d.stop();
});

test('a burst of packets produces one device list, not one each', async () => {
  const d = discovery();
  let emits = 0;
  d.on('devices', () => { emits += 1; });
  for (let i = 0; i < 40; i += 1) packet(d, { fingerprint: 'peer-' + i, alias: 'Peer' });
  assert.strictEqual(emits, 0, 'nothing is emitted synchronously');
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.strictEqual(emits, 1, '40 packets, one render');
  d.stop();
});

test('we answer an announcement, but not every one of them', () => {
  const d = discovery();
  const sent = [];
  d.socket = { send: (buf, _o, _l, port, address) => sent.push({ port, address }) };

  for (let i = 0; i < 20; i += 1) packet(d, { fingerprint: 'peer', announce: true }, '10.0.0.9');
  assert.strictEqual(sent.length, 1, 'a flood from one address gets one reply');
  assert.strictEqual(sent[0].address, '10.0.0.9');

  packet(d, { fingerprint: 'other', announce: true }, '10.0.0.10');
  assert.strictEqual(sent.length, 2, 'a different address still gets its reply');
  d.stop();
});

test('a reply never carries anything but our own published info', () => {
  const d = discovery();
  let payload = null;
  d.socket = { send: (buf) => { payload = JSON.parse(buf.toString('utf8')); } };
  packet(d, { fingerprint: 'peer', announce: true });

  assert.deepStrictEqual(Object.keys(payload).sort(),
    ['alias', 'announce', 'deviceModel', 'deviceType', 'download', 'fingerprint', 'port', 'protocol', 'version'].sort());
  assert.strictEqual(payload.announce, false, 'our reply does not provoke another reply');
  d.stop();
});

test('a device that goes quiet is pruned, and so is its reply record', () => {
  const d = discovery();
  packet(d, { fingerprint: 'peer', announce: true }, '10.0.0.5');
  d.socket = { send: () => {} };
  assert.strictEqual(d.devices.size, 1);

  // Age everything past the time-to-live.
  for (const device of d.devices.values()) device.lastSeen = Date.now() - 60000;
  for (const address of d.lastReply.keys()) d.lastReply.set(address, Date.now() - 60000);
  d._prune();

  assert.strictEqual(d.devices.size, 0, 'the device is gone');
  assert.strictEqual(d.lastReply.size, 0, 'and the ledger does not keep growing');
  d.stop();
});

test('a peer re-announcing itself unchanged does not rebuild the list', async () => {
  const d = discovery();
  let emits = 0;
  d.on('devices', () => { emits += 1; });

  packet(d, { fingerprint: 'peer', alias: 'iPad' });
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.strictEqual(emits, 1, 'the first sighting is news');

  // What a peer actually does every few seconds.
  for (let i = 0; i < 5; i += 1) packet(d, { fingerprint: 'peer', alias: 'iPad' });
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.strictEqual(emits, 1, 'repeating itself is not');

  packet(d, { fingerprint: 'peer', alias: 'iPad Pro' });
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.strictEqual(emits, 2, 'a renamed peer is news again');
  d.stop();
});

test('stop clears the pending device list so nothing fires after shutdown', async () => {
  const d = discovery();
  let emits = 0;
  d.on('devices', () => { emits += 1; });
  packet(d, { fingerprint: 'peer' });
  d.stop();
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.strictEqual(emits, 0);
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
