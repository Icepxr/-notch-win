'use strict';
const { EventEmitter } = require('node:events');
const Geometry = require('./renderer/notch-geometry');
const Appearance = require('./renderer/notch-appearance');
const MODES = ['selected', 'primary', 'cursor'];

// Electron screen bounds, window bounds and cursor positions are already DIP.
// Applying scaleFactor again would displace the notch on mixed-DPI monitors.
function selectDisplay(displays, primaryId, settings, point) {
  const primary = displays.find((d) => d.id === primaryId) || displays[0];
  if (settings.displayMode === 'primary') return primary;
  if (settings.displayMode === 'cursor' && point) {
    return displays.find((d) => point.x >= d.bounds.x && point.y >= d.bounds.y
      && point.x < d.bounds.x + d.bounds.width && point.y < d.bounds.y + d.bounds.height) || primary;
  }
  const byId = displays.find((d) => d.id === settings.displayId);
  if (byId) return byId;
  // Windows can assign a new ID after docking. Only use a name match when it
  // identifies one display; two identically named monitors stay unambiguous.
  const byName = settings.displayLabel ? displays.filter((d) => d.label === settings.displayLabel
    && !!d.internal === !!settings.displayInternal) : [];
  return byName.length === 1 ? byName[0] : primary;
}
function placement(display, silhouette = 'notch', preferences = {}, reserveWidth = 0) {
  const host = Geometry.hostFor(preferences);
  host.width = Math.max(host.width, reserveWidth);
  const userZoom = Appearance.normalize(preferences).notchScale / 100;
  const b = display.bounds, work = display.workArea || b;
  const y = Math.max(b.y, work.y) + (silhouette === 'capsule' ? 8 : 0);
  const bottom = Math.min(b.y + b.height, work.y + work.height);
  const zoomFactor = Math.min(userZoom, Math.max(.1, (b.width - 8) / host.width),
    Math.max(.1, (bottom - y - 8) / host.height));
  const width = Math.ceil(host.width * zoomFactor), height = Math.ceil(host.height * zoomFactor);
  return { bounds: { x: Math.round(b.x + (b.width - width) / 2), y, width, height }, zoomFactor };
}
function pointerInside(region, point, bounds, zoomFactor = 1) {
  return Geometry.contains(region, (point.x - bounds.x) / zoomFactor, (point.y - bounds.y) / zoomFactor);
}

/**
 * The same region with a margin around it, used for the test that decides the
 * pointer has *left*. Asking the same question for entering and leaving makes
 * a pointer resting on the boundary flip the answer every time it is polled;
 * a margin means it has to mean it.
 */
function growRegion(region, by) {
  if (!region || !Number.isFinite(by) || by <= 0) return region;
  return {
    ...region,
    x: region.x - by,
    y: region.y - by,
    width: region.width + by * 2,
    height: region.height + by * 2,
    radius: Math.max(0, (region.radius || 0) + by),
    topRadius: Math.max(0, (region.topRadius || 0) + by),
  };
}
class DisplayController extends EventEmitter {
  constructor({ screen, settings, canFollow = () => true, now = Date.now }) {
    super(); this.screen = screen; this.settings = settings; this.canFollow = canFollow; this.now = now;
    this.listeners = []; this.currentId = null; this.pending = null;
  }
  topology() { return { displays: this.screen.getAllDisplays(), primaryId: this.screen.getPrimaryDisplay().id }; }
  choose() {
    const { displays, primaryId } = this.topology(), settings = this.settings();
    // Metrics changes on another display must not move an open cursor-mode
    // panel. Removal of its own monitor always moves it back onto the desktop.
    if (settings.displayMode === 'cursor') {
      const current = displays.find((d) => d.id === this.currentId);
      if (current) return current;
    }
    return selectDisplay(displays, primaryId, settings, this.screen.getCursorScreenPoint());
  }
  initialPlacement() {
    const d = this.choose(); this.currentId = d.id;
    this.hostWidth = Geometry.hostFor(this.settings()).width;
    return placement(d, this.settings().silhouette, this.settings(), this.hostWidth);
  }
  attach(win) { this.win = win; this.apply(); }
  start() {
    for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) {
      const listener = () => {
        clearTimeout(this.settle);
        this.settle = setTimeout(() => { this.pending = null; this.apply(); }, 120);
      };
      this.screen.on(event, listener); this.listeners.push([event, listener]);
    }
  }
  stop() { clearTimeout(this.settle); for (const [name, listener] of this.listeners) this.screen.removeListener(name, listener); this.listeners = []; }
  apply(display = this.choose()) {
    if (!display || !this.win || this.win.isDestroyed()) return;
    // Keep enough backing surface for an outgoing wider shell as preferences
    // morph down. Transparent space remains click-through; the bound is 692px.
    this.hostWidth = Math.max(this.hostWidth || 0, Geometry.hostFor(this.settings()).width);
    const position = placement(display, this.settings().silhouette, this.settings(), this.hostWidth), old = this.win.getBounds();
    this.currentId = display.id;
    const moved = ['x', 'y', 'width', 'height'].some((key) => old[key] !== position.bounds[key]);
    if (moved) this.win.setBounds(position.bounds);
    if (Math.abs(this.win.webContents.getZoomFactor() - position.zoomFactor) > .001) this.win.webContents.setZoomFactor(position.zoomFactor);
    this.emit('change', this.snapshot());
    if (moved) this.emit('moved');
  }
  settingsChanged() {
    this.pending = null;
    const { displays, primaryId } = this.topology();
    this.apply(selectDisplay(displays, primaryId, this.settings(), this.screen.getCursorScreenPoint()));
  }
  tick() {
    if (this.settings().displayMode !== 'cursor' || !this.canFollow()) { this.pending = null; return; }
    const { displays, primaryId } = this.topology();
    const target = selectDisplay(displays, primaryId, this.settings(), this.screen.getCursorScreenPoint());
    if (!target || target.id === this.currentId) { this.pending = null; return; }
    if (this.pending?.id !== target.id) { this.pending = { id: target.id, at: this.now() }; return; }
    if (this.now() - this.pending.at < 400) return;
    this.pending = null; this.apply(target);
  }
  snapshot() {
    const { displays, primaryId } = this.topology(), settings = this.settings();
    const selected = selectDisplay(displays, primaryId, { ...settings, displayMode: 'selected' });
    const matched = displays.some((d) => d.id === settings.displayId)
      || (settings.displayLabel && displays.filter((d) => d.label === settings.displayLabel && !!d.internal === !!settings.displayInternal).length === 1);
    const missing = !!(settings.displayId !== undefined && !matched && (!settings.displayMode || settings.displayMode === 'selected'));
    return { mode: MODES.includes(settings.displayMode) ? settings.displayMode : 'selected', activeDisplayId: this.currentId,
      preferredDisplayId: missing ? settings.displayId : selected?.id, missing,
      preferredLabel: settings.displayLabel || '',
      displays: displays.map((d, i) => ({ id: d.id, label: d.label || 'Display ' + (i + 1),
        primary: d.id === primaryId, internal: !!d.internal, scaleFactor: d.scaleFactor || 1 })) };
  }
}
module.exports = { DisplayController, selectDisplay, placement, pointerInside, growRegion, MODES };
