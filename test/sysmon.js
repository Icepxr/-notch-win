'use strict';

// Pure-logic tests for the system monitor. os and fs are stubbed so the
// numbers are deterministic rather than whatever this machine happens to do.

const assert = require('node:assert');

const {
  SystemMonitor, readCpu, cpuUsage, memoryUsage, diskUsage,
  formatBytes, formatUptime, pushHistory, HISTORY,
} = require('../src/sysmon');
const { sparkPoints, shortenCpu } = require('../src/renderer/panel-system');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/** Build an os.cpus()-shaped array where every core has the same times. */
function cpus(count, { user = 0, sys = 0, idle = 0 }) {
  return Array.from({ length: count }, () => ({
    model: ' Fake CPU @ 1.0GHz ',
    speed: 1000,
    times: { user, nice: 0, sys, idle, irq: 0 },
  }));
}

test('the first CPU reading reports zero, not a wild number', () => {
  const now = readCpu(cpus(4, { user: 100, idle: 900 }));
  const usage = cpuUsage(null, now);
  assert.strictEqual(usage.overall, 0);
  assert.deepStrictEqual(usage.cores, [0, 0, 0, 0]);
});

test('CPU usage is the non-idle share of the delta', () => {
  const prev = readCpu(cpus(2, { user: 0, idle: 0 }));
  // Each core gains 100 ticks, 25 of them idle -> 75% busy.
  const next = readCpu(cpus(2, { user: 75, idle: 25 }));
  const usage = cpuUsage(prev, next);
  assert.ok(Math.abs(usage.overall - 0.75) < 1e-9, 'overall is 75%');
  assert.ok(usage.cores.every((c) => Math.abs(c - 0.75) < 1e-9), 'each core is 75%');
});

test('a tick with no elapsed time reports zero instead of dividing by zero', () => {
  const same = readCpu(cpus(2, { user: 10, idle: 10 }));
  const usage = cpuUsage(same, same);
  assert.strictEqual(usage.overall, 0);
  assert.ok(usage.cores.every((c) => c === 0));
});

test('a core count that changes between samples does not throw', () => {
  const prev = readCpu(cpus(2, { user: 0, idle: 0 }));
  const next = readCpu(cpus(4, { user: 50, idle: 50 }));
  const usage = cpuUsage(prev, next);
  assert.strictEqual(usage.cores.length, 4);
  assert.ok(usage.cores.slice(2).every((c) => c === 0), 'cores with no history read zero');
});

test('memory usage', () => {
  const m = memoryUsage(1000, 250);
  assert.strictEqual(m.used, 750);
  assert.strictEqual(m.ratio, 0.75);

  // Free larger than total is nonsense; clamp rather than report negative use.
  const odd = memoryUsage(100, 500);
  assert.strictEqual(odd.used, 0);
  assert.strictEqual(odd.ratio, 0);

  assert.strictEqual(memoryUsage(0, 0).ratio, 0, 'no division by zero');
});

test('disk usage converts blocks to bytes and prefers bavail', () => {
  const d = diskUsage({ bsize: 4096, blocks: 1000, bfree: 500, bavail: 400 });
  assert.strictEqual(d.total, 4096000);
  assert.strictEqual(d.free, 4096 * 400, 'uses the space we may actually write');
  assert.strictEqual(d.used, 4096 * 600);

  // bavail missing: fall back to bfree.
  const fallback = diskUsage({ bsize: 1024, blocks: 10, bfree: 4 });
  assert.strictEqual(fallback.free, 4096);

  assert.strictEqual(diskUsage(null), null);
  assert.strictEqual(diskUsage({ bsize: 4096, blocks: 0 }), null, 'an empty volume is not reported');
});

test('byte formatting', () => {
  assert.strictEqual(formatBytes(512), '512 B');
  assert.strictEqual(formatBytes(1536), '1.5 KB');
  assert.strictEqual(formatBytes(1024 * 1024 * 150), '150 MB');
  assert.strictEqual(formatBytes(NaN), '');
});

test('uptime formatting', () => {
  assert.strictEqual(formatUptime(90), '1 min');
  assert.strictEqual(formatUptime(3700), '1h 1 min');
  assert.strictEqual(formatUptime(2 * 86400 + 3 * 3600), '2d 3h');
  assert.strictEqual(formatUptime(-5), '0 min', 'a negative uptime does not go strange');
});

test('history is a fixed-length ring', () => {
  let h = [];
  for (let i = 0; i < HISTORY + 15; i += 1) h = pushHistory(h, i);
  assert.strictEqual(h.length, HISTORY);
  assert.strictEqual(h[h.length - 1], HISTORY + 14, 'the newest sample is last');
});

test('a sample pulls the pieces together', () => {
  let userTicks = 0;
  const fakeOs = {
    cpus: () => cpus(2, { user: userTicks, idle: userTicks }),
    totalmem: () => 16 * 1024 ** 3,
    freemem: () => 4 * 1024 ** 3,
    uptime: () => 7200,
    hostname: () => 'test-host',
  };
  const fakeFs = {
    statfsSync: () => ({ bsize: 4096, blocks: 1000, bfree: 300, bavail: 250 }),
  };

  const mon = new SystemMonitor({ disks: ['C:\\'], deps: { os: fakeOs, fs: fakeFs } });
  mon.prevCpu = readCpu(fakeOs.cpus());
  userTicks = 100;

  const sample = mon.sample();
  assert.strictEqual(sample.cpu.count, 2);
  assert.strictEqual(sample.cpu.model, 'Fake CPU @ 1.0GHz', 'the model is trimmed');
  assert.ok(Math.abs(sample.memory.ratio - 0.75) < 1e-9);
  assert.strictEqual(sample.disks.length, 1);
  assert.strictEqual(sample.disks[0].mount, 'C:\\');
  assert.strictEqual(sample.uptime, 7200);
  assert.strictEqual(sample.cpu.history.length, 1, 'history starts filling');
});

test('an unreadable drive is skipped, not fatal', () => {
  const fakeOs = {
    cpus: () => cpus(1, { user: 1, idle: 1 }),
    totalmem: () => 100,
    freemem: () => 50,
    uptime: () => 60,
    hostname: () => 'h',
  };
  const fakeFs = {
    statfsSync: (mount) => {
      if (mount === 'Z:\\') throw new Error('ENOENT');
      return { bsize: 1024, blocks: 10, bfree: 5, bavail: 5 };
    },
  };

  const mon = new SystemMonitor({ disks: ['C:\\', 'Z:\\'], deps: { os: fakeOs, fs: fakeFs } });
  const sample = mon.sample();
  assert.strictEqual(sample.disks.length, 1, 'only the readable drive is reported');
  assert.strictEqual(sample.disks[0].mount, 'C:\\');
});

test('sample emits for listeners', () => {
  const fakeOs = {
    cpus: () => cpus(1, { user: 1, idle: 1 }),
    totalmem: () => 10, freemem: () => 5, uptime: () => 1, hostname: () => 'h',
  };
  const mon = new SystemMonitor({ disks: [], deps: { os: fakeOs, fs: { statfsSync: () => null } } });

  let got = null;
  mon.on('sample', (s) => { got = s; });
  mon.sample();
  assert.ok(got && typeof got.at === 'number');
});

test('sparkline points are right-aligned so a short history grows inward', () => {
  assert.strictEqual(sparkPoints([]), '', 'nothing to draw yet');

  const xOf = (s) => s.split(' ').map((p) => Number(p.split(',')[0]));
  const yOf = (s) => s.split(' ').map((p) => Number(p.split(',')[1]));

  // A full history spans the whole width.
  const full = sparkPoints(new Array(40).fill(0.5), 120, 26, 40);
  const fx = xOf(full);
  assert.ok(Math.abs(fx[0]) < 0.05, 'starts at the left edge');
  assert.ok(Math.abs(fx[fx.length - 1] - 120) < 0.05, 'ends at the right edge');

  // A short history hugs the right edge instead of stretching.
  const short = sparkPoints([0.1, 0.2, 0.3], 120, 26, 40);
  const sx = xOf(short);
  assert.ok(sx[0] > 100, 'the oldest of three samples sits near the right');
  assert.ok(Math.abs(sx[sx.length - 1] - 120) < 0.05, 'the newest is at the edge');

  // y is inverted and clamped: 1 is the top, 0 the bottom, and out-of-range
  // values do not escape the box.
  const clamped = sparkPoints([0, 1, -5, 9], 120, 26, 4);
  const cy = yOf(clamped);
  assert.strictEqual(cy[0], 26, '0 sits on the bottom');
  assert.strictEqual(cy[1], 0, '1 reaches the top');
  assert.ok(cy.every((y) => y >= 0 && y <= 26), 'nothing escapes the box');
});

test('CPU model names are shortened for the caption', () => {
  assert.strictEqual(shortenCpu('13th Gen Intel(R) Core(TM) i7-13700HX'), 'Core i7-13700HX');
  assert.strictEqual(shortenCpu('AMD Ryzen 9 5900X 12-Core Processor'), 'Ryzen 9 5900X 12-Core Processor');
  assert.strictEqual(shortenCpu('Intel(R) Xeon(R) CPU E5-2680 @ 2.70GHz'), 'Xeon CPU E5-2680');
  assert.strictEqual(shortenCpu(''), '');
  assert.strictEqual(shortenCpu(undefined), '');
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
