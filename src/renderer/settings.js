'use strict';

// Control panel window. Every control writes through panel.update() and then
// repaints from whatever main actually stored, so a rejected or clamped value
// is visible here rather than silently diverging from the notch.

const statusEl = document.getElementById('status');
const bar = document.querySelector('.statusbar');
let statusTimer = null;
let painting = false;

function status(message, kind) {
  clearTimeout(statusTimer);
  statusEl.textContent = message;
  bar.classList.toggle('is-saved', kind === 'saved');
  bar.classList.toggle('is-error', kind === 'error');
  if (kind) {
    statusTimer = setTimeout(() => {
      statusEl.textContent = 'Changes save as you make them.';
      bar.classList.remove('is-saved', 'is-error');
    }, 2200);
  }
}

async function write(patch) {
  if (painting) return;
  try {
    const result = await window.panel.update(patch);
    paint(result);
    status(result.ok ? 'Saved' : 'Cannot save changes', result.ok ? 'saved' : 'error');
  } catch {
    status('Cannot save changes', 'error');
  }
}

for (const group of document.querySelectorAll('.segmented')) {
  group.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (button) write({ [group.dataset.preference]: button.dataset.value });
  });
  // Arrow keys move through a radio group the way a radio group should.
  group.addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
    const buttons = [...group.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const next = buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
    next.focus();
    write({ [group.dataset.preference]: next.dataset.value });
  });
}

for (const input of document.querySelectorAll('.switch')) {
  input.addEventListener('change', () => write({ [input.dataset.preference]: input.checked }));
}

for (const select of document.querySelectorAll('select')) {
  select.addEventListener('change', () => {
    const key = select.dataset.preference;
    write({ [key]: key === 'displayId' ? Number(select.value) : select.value });
  });
}

document.getElementById('reveal-data').addEventListener('click', () => window.panel.revealData());
document.getElementById('win-close').addEventListener('click', () => window.panel.close());
document.getElementById('win-minimize').addEventListener('click', () => window.panel.minimize());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.panel.close();
});

const SEGMENT_DEFAULT = { silhouette: 'notch', glass: 'high' };

const GLASS_DETAIL = {
  high: 'Layered translucency and a lit rim while the notch is open.',
  medium: 'A softer sheen. Less light, same shape.',
  off: 'A flat surface. Easiest to read, lightest to draw.',
};

function paint(state) {
  if (!state) return;
  painting = true;
  const preferences = state.preferences || {};

  for (const group of document.querySelectorAll('.segmented')) {
    const key = group.dataset.preference;
    const value = preferences[key] ?? SEGMENT_DEFAULT[key];
    for (const button of group.querySelectorAll('button')) {
      button.setAttribute('aria-checked', String(button.dataset.value === value));
      button.tabIndex = button.dataset.value === value ? 0 : -1;
    }
  }

  for (const input of document.querySelectorAll('.switch')) {
    input.checked = preferences[input.dataset.preference] !== false;
  }

  document.getElementById('glass-detail').textContent = GLASS_DETAIL[preferences.glass] || GLASS_DETAIL.high;

  const displays = state.displayState;
  if (displays) {
    const picker = document.querySelector('[data-preference="displayId"]');
    const list = displays.displays || [];
    picker.replaceChildren(...list.map((display, i) => {
      const option = document.createElement('option');
      option.value = display.id;
      option.textContent = (display.label || 'Display ' + (i + 1)) + (display.primary ? ' · Primary' : '');
      return option;
    }));
    // A chosen monitor that is currently unplugged stays listed, so the
    // selection reads as remembered rather than quietly reassigned.
    if (displays.missing) {
      const option = document.createElement('option');
      option.value = displays.preferredDisplayId;
      option.textContent = (displays.preferredLabel || 'Selected display') + ' · Disconnected';
      option.disabled = true;
      picker.append(option);
    }
    picker.value = String(displays.preferredDisplayId);

    document.querySelector('[data-preference="displayMode"]').value = displays.mode;
    document.getElementById('display-picker-row').hidden = displays.mode !== 'selected';

    const active = list.find((d) => d.id === displays.activeDisplayId);
    document.getElementById('display-active').textContent = active
      ? active.label + (active.primary ? ' · Primary' : '') : 'Your display';
    document.getElementById('display-status').textContent = displays.missing
      ? 'Temporarily using another display. Reconnect to restore.'
      : displays.mode === 'cursor'
        ? 'Follows your cursor while the notch is closed.'
        : 'Stays centered through rotation and scaling changes.';
    document.getElementById('display-count').textContent =
      list.length + (list.length === 1 ? ' display' : ' displays');
  }

  if (state.about) {
    document.getElementById('identity-sub').textContent = state.about.alias || 'A quieter corner of your desktop.';
    document.getElementById('about-line').textContent =
      'Version ' + state.about.version + ' · Electron ' + state.about.electron
      + ' · ' + (state.acrylic ? 'Windows acrylic' : 'Opaque window');
  }

  painting = false;
}

window.panel.onState(paint);

(async function boot() {
  paint(await window.panel.init());
}());
