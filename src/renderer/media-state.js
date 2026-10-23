'use strict';

// Playback metadata grace adapted from Vorssaint NotchMusicSupport.swift,
// Copyright (C) 2026 Vorssaint, GPL-3.0-or-later. See THIRD_PARTY_NOTICES.md.

// Turns the media bridge's JSON lines into the state the notch paints.
//
// Pure on purpose: the main process keeps a copy so a freshly loaded renderer
// starts with art instead of a blank row, the renderer reduces the same
// messages as they stream in, and test/media-state.js can exercise all of it
// without a window or a PowerShell process. Loaded both with require() and as
// a plain <script> in the renderer, hence the wrapper - and it lives in this
// folder so the page can load it as a same-directory script under the CSP.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MediaState = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // A paused player keeps its session registered for as long as the app lives,
  // so a browser tab paused yesterday would otherwise own the notch forever.
  const PAUSED_GRACE_MS = 5 * 60 * 1000;

  const EMPTY = Object.freeze({
    active: false,
    playing: false,
    title: '',
    artist: '',
    album: '',
    app: '',
    appLabel: '',
    thumb: null,
    position: 0,
    duration: 0,
    anchorAt: 0,
    pausedSince: 0,
    canNext: false,
    canPrev: false,
    canToggle: false,
    canSeek: false,
    sources: [],
    selectedSource: '',
    metadataAt: 0,
    awaiting: false,
    missingSince: 0,
    awaitingUntil: 0,
  });

  // Source app ids the SMTC reports are either an executable or a packaged
  // app's AUMID; neither reads well in a 12px label.
  const APP_NAMES = {
    MSEdge: 'Edge',
    Chrome: 'Chrome',
    'msedge.exe': 'Edge',
    'chrome.exe': 'Chrome',
    'firefox.exe': 'Firefox',
    'brave.exe': 'Brave',
    'vivaldi.exe': 'Vivaldi',
    'opera.exe': 'Opera',
    'Spotify.exe': 'Spotify',
    'vlc.exe': 'VLC',
    'wmplayer.exe': 'Windows Media Player',
    'Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic': 'Media Player',
    'Microsoft.ZuneVideo_8wekyb3d8bbwe!Microsoft.ZuneVideo': 'Media Player',
    'SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify': 'Spotify',
  };

  function appLabel(app) {
    const id = typeof app === 'string' ? app.trim() : '';
    if (!id) return '';
    if (APP_NAMES[id]) return APP_NAMES[id];

    let name = id;
    const bang = name.indexOf('!');
    if (bang >= 0) {
      name = name.slice(bang + 1); // AUMID: keep the application id
    } else {
      const underscore = name.indexOf('_');
      if (underscore > 0) name = name.slice(0, underscore); // package family name
    }
    name = name.replace(/\.exe$/i, '');
    const dot = name.lastIndexOf('.');
    if (dot >= 0 && dot < name.length - 1) name = name.slice(dot + 1); // Vendor.App
    return name;
  }

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function seconds(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
  }

  /** One JSON line from the bridge, or null for anything unparseable. */
  function parseBridgeLine(line) {
    if (typeof line !== 'string') return null;
    const trimmed = line.trim();
    if (!trimmed || trimmed[0] !== '{') return null;
    let value;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return null;
    }
    if (!value || typeof value !== 'object' || typeof value.type !== 'string') return null;
    return value;
  }

  /**
   * Fold a bridge message into the previous state. Messages that are not a
   * state report (hello, command, error) leave the state alone.
   */
  function nextState(prev, message, receivedAt) {
    const base = prev || EMPTY;
    const now = Number.isFinite(receivedAt) ? receivedAt : Date.now();

    if (!message || message.type !== 'state') return base;
    const sources = Array.isArray(message.sources) ? [...new Set(message.sources.filter((id) => typeof id === 'string' && id.length <= 512))] : [];
    const selectedSource = text(message.selectedSource);
    const empty = () => sources.length || selectedSource ? { ...EMPTY, sources, selectedSource } : EMPTY;
    const missingSince = base.missingSince || now;
    if (!message.session) {
      // Browser sessions can briefly unregister between tracks. Hold only the
      // same source, for a bounded window, with transport controls disabled.
      const browser = /chrome|msedge|firefox|brave|vivaldi|opera|youtube|soundcloud/i.test(base.app);
      if (browser && base.active && (!selectedSource || selectedSource === base.app) && now - missingSince < 2000) {
        return { ...base, sources, selectedSource, awaiting: true, missingSince, awaitingUntil: missingSince + 2000,
          canToggle: false, canNext: false, canPrev: false, canSeek: false };
      }
      return empty();
    }

    const title = text(message.title);
    const artist = text(message.artist);
    const app = text(message.app);
    // A session with no metadata at all has nothing worth a row.
    if (!title && !artist) {
      // Adapted from Vorssaint's 1.5s playback gap grace. Brief metadata gaps
      // between songs keep the old artwork rather than flashing the idle UI.
      if (base.active && app === base.app && now - base.metadataAt <= 1500) {
        const playing = message.status === 'Playing';
        return { ...base, sources, selectedSource, awaiting: true, missingSince, awaitingUntil: base.metadataAt + 1500, playing,
          position: positionAt(base, now), anchorAt: now,
          pausedSince: playing ? 0 : base.pausedSince || now,
          canToggle: false, canNext: false, canPrev: false, canSeek: false };
      }
      return empty();
    }
    const playing = message.status === 'Playing';
    const sameTrack = title === base.title && artist === base.artist && app === base.app;

    // The bridge only sends thumb when the track changed: an absent key means
    // "unchanged", an explicit null means "this track has no art".
    let thumb = sameTrack ? base.thumb : null;
    if (Object.prototype.hasOwnProperty.call(message, 'thumb')) {
      thumb = typeof message.thumb === 'string' && message.thumb ? message.thumb : null;
    }

    const canNext = message.canNext === true;
    const canPrev = message.canPrev === true;

    return {
      active: true,
      playing,
      title,
      artist,
      album: text(message.album),
      app,
      appLabel: appLabel(app),
      thumb,
      position: seconds(message.position),
      duration: seconds(message.duration),
      // WinRT reports the position as of LastUpdatedTime, not as of now.
      anchorAt: seconds(message.lastUpdated) || now,
      pausedSince: playing ? 0 : ((sameTrack && base.pausedSince) || now),
      canNext,
      canPrev,
      canToggle: message.canPlay === true || message.canPause === true,
      canSeek: message.canSeek === true && seconds(message.duration) > 0,
      sources,
      selectedSource,
      metadataAt: now,
      awaiting: false,
      missingSince: 0,
      awaitingUntil: 0,
    };
  }

  /** Whether the notch should still be showing this state. */
  function isActive(state, now) {
    if (!state || !state.active) return false;
    if (state.awaitingUntil && (Number.isFinite(now) ? now : Date.now()) >= state.awaitingUntil) return false;
    if (state.playing) return true;
    if (!state.pausedSince) return true;
    return (Number.isFinite(now) ? now : Date.now()) - state.pausedSince < PAUSED_GRACE_MS;
  }

  /** Position in seconds, carried forward from its anchor while playing. */
  function positionAt(state, now) {
    if (!state || !state.active) return 0;
    let position = state.position;
    if (state.playing && state.anchorAt) {
      position += Math.max(0, (Number.isFinite(now) ? now : Date.now()) - state.anchorAt) / 1000;
    }
    if (state.duration > 0) position = Math.min(position, state.duration);
    return Math.max(0, position);
  }

  function formatClock(value) {
    const total = Math.floor(Number.isFinite(value) && value > 0 ? value : 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return hours ? hours + ':' + pad(minutes) + ':' + pad(secs) : minutes + ':' + pad(secs);
  }

  return {
    EMPTY,
    PAUSED_GRACE_MS,
    appLabel,
    parseBridgeLine,
    nextState,
    isActive,
    positionAt,
    formatClock,
  };
}));
