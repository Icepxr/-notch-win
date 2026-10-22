'use strict';

// SystemPanel panel. Loaded both with require() (so the pure helpers can be
// tested without a window) and as a plain <script> in the renderer, hence
// the wrapper - and it lives in this folder so the page can load it as a
// same-directory script under the CSP.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SystemPanel = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SPARK_W = 120;
  const SPARK_H = 26;

  let els = null;

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

  function pct(ratio) {
    return Math.round((Number(ratio) || 0) * 100) + '%';
  }

  /**
   * Points for a sparkline across `history` (values 0..1), newest on the right.
   * A short history is drawn right-aligned so the line grows in from the edge
   * instead of stretching.
   */
  function sparkPoints(history, width = SPARK_W, height = SPARK_H, capacity = 40) {
    const values = Array.isArray(history) ? history : [];
    if (!values.length) return '';
    const step = width / Math.max(1, capacity - 1);
    const offset = width - (values.length - 1) * step;
    return values
      .map((v, i) => {
        const x = offset + i * step;
        const y = height - Math.min(1, Math.max(0, v)) * height;
        return x.toFixed(1) + ',' + y.toFixed(1);
      })
      .join(' ');
  }

  function svgEl(name, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  function makeSpark() {
    const svg = svgEl('svg', {
      class: 'spark',
      viewBox: '0 0 ' + SPARK_W + ' ' + SPARK_H,
      preserveAspectRatio: 'none',
    });
    const line = svgEl('polyline', { class: 'spark-line', points: '' });
    svg.append(line);
    return { svg, line };
  }

  /** A labelled meter: title, big value, bar, and a caption underneath. */
  function makeMeter(title) {
    const card = document.createElement('div');
    card.className = 'card meter';

    const head = document.createElement('div');
    head.className = 'meter-head';

    const name = document.createElement('span');
    name.className = 'meter-title';
    name.textContent = title;

    const value = document.createElement('span');
    value.className = 'meter-value';
    value.textContent = '—';

    head.append(name, value);

    const spark = makeSpark();

    const bar = document.createElement('div');
    bar.className = 'meter-bar';
    const fill = document.createElement('div');
    fill.className = 'meter-fill';
    bar.append(fill);

    const caption = document.createElement('div');
    caption.className = 'meter-caption';

    card.append(head, spark.svg, bar, caption);
    return { card, value, fill, caption, spark };
  }

  function paintMeter(meter, ratio, valueText, captionText, history) {
    meter.value.textContent = valueText;
    meter.fill.style.width = pct(ratio);
    meter.caption.textContent = captionText;
    meter.spark.line.setAttribute('points', sparkPoints(history));
    // Colour follows pressure rather than being decorative.
    const level = ratio >= 0.9 ? 'is-high' : ratio >= 0.7 ? 'is-warm' : '';
    meter.card.classList.remove('is-high', 'is-warm');
    if (level) meter.card.classList.add(level);
  }

  function mount(root) {
    root.replaceChildren();

    const head = document.createElement('div');
    head.className = 'section-head';
    const label = document.createElement('span');
    label.className = 'section-label';
    label.textContent = 'System';
    const meta = document.createElement('span');
    meta.className = 'section-meta';
    head.append(label, meta);

    const grid = document.createElement('div');
    grid.className = 'meter-grid';

    const cpu = makeMeter('CPU');
    const memory = makeMeter('Memory');
    grid.append(cpu.card, memory.card);

    const disksHead = document.createElement('div');
    disksHead.className = 'section-head';
    const disksLabel = document.createElement('span');
    disksLabel.className = 'section-label';
    disksLabel.textContent = 'Storage';
    disksHead.append(disksLabel);

    const disks = document.createElement('div');
    disks.className = 'card disk-list';

    root.append(head, grid, disksHead, disks);
    els = { meta, cpu, memory, disks };
  }

  function update(sample) {
    if (!els) return;
    if (!sample) {
      els.meta.textContent = 'Reading sensors…';
      return;
    }

    els.meta.textContent = sample.host + ' · Up ' + formatUptime(sample.uptime);

    paintMeter(
      els.cpu,
      sample.cpu.overall,
      pct(sample.cpu.overall),
      sample.cpu.count + ' cores · ' + shortenCpu(sample.cpu.model),
      sample.cpu.history,
    );

    paintMeter(
      els.memory,
      sample.memory.ratio,
      pct(sample.memory.ratio),
      formatBytes(sample.memory.used) + ' / ' + formatBytes(sample.memory.total),
      sample.memory.history,
    );

    els.disks.replaceChildren();
    if (!sample.disks.length) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'Storage data unavailable';
      els.disks.append(hint);
      return;
    }

    for (const disk of sample.disks) {
      const row = document.createElement('div');
      row.className = 'disk-row';
      if (disk.ratio >= 0.9) row.classList.add('is-high');

      const name = document.createElement('span');
      name.className = 'disk-name';
      name.textContent = disk.mount;

      const bar = document.createElement('div');
      bar.className = 'meter-bar';
      const fill = document.createElement('div');
      fill.className = 'meter-fill';
      fill.style.width = pct(disk.ratio);
      bar.append(fill);

      const text = document.createElement('span');
      text.className = 'disk-text';
      text.textContent = formatBytes(disk.free) + ' free';

      row.append(name, bar, text);
      els.disks.append(row);
    }
  }

  /** "13th Gen Intel(R) Core(TM) i7-13700HX" -> "Core i7-13700HX" */
  function shortenCpu(model) {
    if (!model) return '';
    return String(model)
      .replace(/\((R|TM)\)/g, '')
      .replace(/\d+th Gen\s*/i, '')
      .replace(/Intel\s*|AMD\s*/i, '')
      .replace(/\s+@.*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function formatUptime(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const mins = Math.floor((s % 3600) / 60);
    if (days) return days + 'd ' + hours + 'h';
    if (hours) return hours + 'h ' + mins + ' min';
    return mins + ' min';
  }

  return { mount, update, sparkPoints, shortenCpu, formatUptime };
}));
