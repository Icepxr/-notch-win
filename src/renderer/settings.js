'use strict';

// Control panel window. Every control writes through panel.update() and then
// repaints from whatever main actually stored, so a rejected or clamped value
// is visible here rather than silently diverging from the notch.

const statusEl = document.getElementById('status');
const bar = document.querySelector('.statusbar');
let statusTimer = null;
let painting = false;
let currentPreferences = {};
let appearanceDraft = {};
let appearanceTimer = null;
let appearanceRevision = 0;

// Preview on every input frame; persist after a short pause or on release.
// Draft values win over older broadcasts while a slider is being moved.
function editAppearance(patch, commit = false) {
  appearanceRevision++;
  Object.assign(appearanceDraft, patch);
  paintAppearance({ ...currentPreferences, ...appearanceDraft });
  clearTimeout(appearanceTimer);
  if (commit) flushAppearance();
  else appearanceTimer = setTimeout(flushAppearance, 180);
}

async function flushAppearance() {
  clearTimeout(appearanceTimer);
  const revision = appearanceRevision;
  const patch = { ...appearanceDraft };
  if (!Object.keys(patch).length) return;
  try {
    const result = await window.panel.update(patch);
    if (revision === appearanceRevision) appearanceDraft = {};
    paint(result);
    status(result.ok ? 'Appearance saved' : 'Cannot save appearance', result.ok ? 'saved' : 'error');
  } catch {
    if (revision === appearanceRevision) appearanceDraft = {};
    paintAppearance({ ...currentPreferences, ...appearanceDraft });
    status('Cannot save appearance', 'error');
  }
}

for (const input of document.querySelectorAll('[data-appearance]')) {
  const patch = () => ({ [input.dataset.appearance]: input.type === 'range' ? Number(input.value) : input.value });
  input.addEventListener('input', () => editAppearance(patch()));
  input.addEventListener('change', () => editAppearance(patch(), true));
}
for (const [index, preset] of NotchAppearance.presets.entries()) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.preset = index;
  button.setAttribute('aria-pressed', 'false');
  const dot = document.createElement('i');
  dot.style.background = preset.accentColor;
  const label = document.createElement('span');
  label.textContent = preset.name;
  button.append(dot, label);
  button.addEventListener('click', () => editAppearance({ surfaceTint: preset.surfaceTint, accentColor: preset.accentColor }, true));
  document.getElementById('color-presets').append(button);
}
document.getElementById('reset-appearance').addEventListener('click', () => editAppearance({ ...NotchAppearance.defaults }, true));
for (const button of document.querySelectorAll('[data-preview]')) {
  button.addEventListener('click', () => {
    document.getElementById('appearance-preview').dataset.expanded = String(button.dataset.preview === 'expanded');
    for (const choice of document.querySelectorAll('[data-preview]')) choice.setAttribute('aria-pressed', String(choice === button));
  });
}

function paintAppearance(value) {
  const prefs = NotchAppearance.normalize(value), colors = NotchAppearance.colors(prefs);
  const preview = document.getElementById('appearance-preview');
  for (const [key, color] of Object.entries(colors)) preview.style.setProperty('--preview-' + key, color);
  preview.style.setProperty('--preview-rest-width', prefs.closedWidth * .64 * prefs.notchScale / 100 + 'px');
  preview.style.setProperty('--preview-open-width', prefs.expandedWidth * .64 * prefs.notchScale / 100 + 'px');
  preview.style.setProperty('--preview-scale', prefs.notchScale / 100);
  preview.dataset.silhouette = value.silhouette || 'notch';
  document.getElementById('preview-caption').textContent = prefs.closedWidth + ' px rest · ' + prefs.expandedWidth + ' px expanded · ' + prefs.notchScale + '% size';
  for (const input of document.querySelectorAll('[data-appearance]')) {
    input.value = prefs[input.dataset.appearance];
    const label = document.getElementById(input.id + '-value');
    if (input.type === 'range') {
      label.textContent = prefs[input.dataset.appearance] + (input.dataset.appearance === 'notchScale' ? '%' : ' px');
      input.setAttribute('aria-valuetext', label.textContent);
      input.style.setProperty('--range-fill', (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100 + '%');
    } else label.textContent = input.value.toUpperCase();
  }
  for (const button of document.querySelectorAll('[data-preset]')) {
    const preset = NotchAppearance.presets[Number(button.dataset.preset)];
    button.setAttribute('aria-pressed', String(preset.surfaceTint === prefs.surfaceTint && preset.accentColor === prefs.accentColor));
  }
}

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
async function closePanel() { await flushAppearance(); window.panel.close(); }
document.getElementById('win-close').addEventListener('click', closePanel);
document.getElementById('win-minimize').addEventListener('click', () => window.panel.minimize());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closePanel();
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
  currentPreferences = preferences;
  paintAppearance({ ...preferences, ...appearanceDraft });

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
