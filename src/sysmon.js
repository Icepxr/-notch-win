'use strict';

// System monitor: CPU, memory, disk, uptime.
//
// Deliberately pure node — no PowerShell bridge, no native module, no spawn.
// os.cpus() and fs.statfs cover everything here, so sampling costs almost
// nothing and cannot fail the way an external process can.
//
// Network throughput is the one thing node cannot see; see README.

const os = require('node:os');
const fs = require('node:fs');
const { EventEmitter } = require('node:events');

const DEFAULT_INTERVAL = 2000;
const HISTORY = 40; // samples kept for the sparkline

/** Total and idle jiffies across all cores, plus the per-core split. */
function readCpu(cpus) {
  let total = 0;
  let idle = 0;
  const cores = [];

  for (const cpu of cpus) {
    const t = cpu.times;
    const coreTotal = t.user + t.nice + t.sys + t.idle + t.irq;
    total += coreTotal;
    idle += t.idle;
    cores.push({ total: coreTotal, idle: t.idle });
  }

  return { total, idle, cores };
}

/**
 * Busy fraction between two readings, 0..1.
 * The first reading has nothing to compare against, so it reports 0.
 */
function cpuUsage(prev, next) {
  if (!prev) return { overall: 0, cores: next.cores.map(() => 0) };

  const totalDelta = next.total - prev.total;
  const idleDelta = next.idle - prev.idle;
  const overall = totalDelta > 0 ? clamp(1 - idleDelta / totalDelta) : 0;

  const cores = next.cores.map((core, i) => {
    const prevCore = prev.cores[i];
    if (!prevCore) return 0;
    const ct = core.total - prevCore.total;
    const ci = core.idle - prevCore.idle;
    return ct > 0 ? clamp(1 - ci / ct) : 0;
  });

  return { overall, cores };
}

function clamp(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function memoryUsage(totalBytes, freeBytes) {
  const total = Number(totalBytes) || 0;
  const free = Math.min(Number(freeBytes) || 0, total);
  const used = total - free;
  return { total, free, used, ratio: total > 0 ? clamp(used / total) : 0 };
}

/** fs.statfs reports in blocks; turn that into bytes. */
function diskUsage(stat) {
  if (!stat || !Number.isFinite(stat.bsize)) return null;
  const blockSize = Number(stat.bsize);
  const total = Number(stat.blocks) * blockSize;
  // bavail is what a non-privileged process may actually use.
  const free = Number(stat.bavail != null ? stat.bavail : stat.bfree) * blockSize;
  if (!(total > 0)) return null;
  const used = Math.max(0, total - free);
  return { total, free, used, ratio: clamp(used / total) };
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return (value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)) + ' ' + units[i];
}

/** Human-readable uptime, deliberately coarse. */
function formatUptime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days) return days + 'd ' + hours + 'h';
  if (hours) return hours + 'h ' + mins + ' min';
  return mins + ' min';
}

/** Push onto a fixed-length ring used by the sparkline. */
function pushHistory(history, value, limit = HISTORY) {
  const next = history.concat(value);
  return next.length > limit ? next.slice(next.length - limit) : next;
}

class SystemMonitor extends EventEmitter {
  /**
   * @param {{interval?:number, disks?:string[], deps?:object}} opts
   *   deps lets tests substitute os/fs.
   */
  constructor({ interval = DEFAULT_INTERVAL, disks = null, deps = {} } = {}) {
    super();
    this.interval = interval;
    this.os = deps.os || os;
    this.fs = deps.fs || fs;
    // On Windows the system drive is the one worth watching by default.
    this.disks = disks || [process.env.SystemDrive ? process.env.SystemDrive + '\\' : '/'];
    this.timer = null;
    this.prevCpu = null;
    this.cpuHistory = [];
    this.memHistory = [];
    this.last = null;
  }

  start() {
    if (this.timer) return;
    // Prime the CPU counters so the first visible sample is already real.
    this.prevCpu = readCpu(this.os.cpus());
    this.timer = setInterval(() => this.sample(), this.interval);
    this.timer.unref?.();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  sample() {
    const cpus = this.os.cpus();
    const reading = readCpu(cpus);
    const cpu = cpuUsage(this.prevCpu, reading);
    this.prevCpu = reading;

    const memory = memoryUsage(this.os.totalmem(), this.os.freemem());

    this.cpuHistory = pushHistory(this.cpuHistory, cpu.overall);
    this.memHistory = pushHistory(this.memHistory, memory.ratio);

    const disks = [];
    for (const mount of this.disks) {
      let usage = null;
      try {
        usage = diskUsage(this.fs.statfsSync(mount));
      } catch {
        usage = null; // an unplugged drive should not kill the sample
      }
      if (usage) disks.push({ mount, ...usage });
    }

    this.last = {
      at: Date.now(),
      cpu: {
        overall: cpu.overall,
        cores: cpu.cores,
        model: cpus.length ? cpus[0].model.trim() : '',
        count: cpus.length,
        history: this.cpuHistory,
      },
      memory: { ...memory, history: this.memHistory },
      disks,
      uptime: this.os.uptime(),
      host: this.os.hostname(),
    };

    this.emit('sample', this.last);
    return this.last;
  }
}

module.exports = {
  SystemMonitor,
  readCpu,
  cpuUsage,
  memoryUsage,
  diskUsage,
  formatBytes,
  formatUptime,
  pushHistory,
  HISTORY,
};
