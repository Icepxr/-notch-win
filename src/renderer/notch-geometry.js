'use strict';

// Shared by Electron and the renderer: the native window leaves room for the
// shoulders and shadow, while the painted surface remains centred at the edge.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./notch-appearance'));
  else root.NotchGeometry = factory(root.NotchAppearance);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Appearance) {
  const gutter = 20;
  const shadow = 32;
  const sizes = {
    closed: { width: 184, height: 28 },
    peek: { width: 300, height: 46 },
    peekMedia: { width: 520, height: 164 },
    open: { width: 520, height: 390 },
    openAi: { width: 520, height: 510 },
    openMusic: { width: 520, height: 260 },
    openShelf: { width: 520, height: 350 },
    openTools: { width: 520, height: 260 },
    openTimerActive: { width: 520, height: 230 },
    openSystem: { width: 520, height: 180 },
    openSystemDetail: { width: 520, height: 290 },
    openGallery: { width: 520, height: 330 },
    peekNotice: { width: 360, height: 64 },
  };
  // The silhouette is a function of height, not a table of fixed numbers: the
  // same notch is 28px tall at rest and 390px open, and a corner that looks
  // right at one height is wrong at the other. Keeping the rule here - rather
  // than as evaluated constants in a stylesheet - is what stops the painted
  // shape, the hit region and the Settings preview drifting apart.
  const silhouette = { shoulderMax: 14, shoulderRatio: 0.19, radiusMax: 28, radiusRatio: 0.34 };

  /** The concave shoulder where the notch meets the screen edge. */
  function shoulderFor(height) {
    return Math.min(silhouette.shoulderMax, Math.max(0, height) * silhouette.shoulderRatio);
  }

  /** The bottom corner radius. A capsule is round-ended; a notch is not. */
  function radiusFor(height, shape) {
    const value = Math.max(0, height);
    return shape === 'capsule'
      ? Math.min(silhouette.radiusMax, value / 2)
      : Math.min(silhouette.radiusMax, value * silhouette.radiusRatio);
  }

  /** The same rule as a CSS border-radius: a capsule is round all the way. */
  function borderRadiusFor(height, shape) {
    const radius = radiusFor(height, shape);
    return shape === 'capsule' ? radius + 'px' : '0 0 ' + radius + 'px ' + radius + 'px';
  }

  function windowSize(size) {
    return { width: size.width + gutter * 2, height: size.height + shadow };
  }
  // Keep the Windows transparent backing surface stable throughout a morph.
  // Resizing that HWND at both ends can make DWM discard/recreate its surface.
  const hostSize = windowSize({ width: 532, height: 522 });
  function sizesFor(value) {
    const prefs = Appearance.normalize(value);
    return Object.fromEntries(Object.entries(sizes).map(([name, size]) => [name, { ...size,
      width: name === 'closed' ? prefs.closedWidth : name.startsWith('open') || name === 'peekMedia' ? prefs.expandedWidth : size.width }]));
  }
  function hostFor(value) {
    return windowSize({ width: Appearance.normalize(value).expandedWidth + 12, height: 522 });
  }
  function contains(region, x, y) {
    const localX = x - region.x;
    const localY = y - region.y;
    if (localX < 0 || localY < 0 || localX > region.width || localY > region.height) return false;
    const top = Math.max(0, Math.min(region.topRadius || 0, region.width / 2, region.height));
    if (top && localY < top) {
      const centreX = localX < top ? top : localX > region.width - top ? region.width - top : localX;
      if ((localX - centreX) ** 2 + (localY - top) ** 2 > top ** 2) return false;
    }
    const radius = Math.max(0, Math.min(region.radius || 0, region.width / 2, region.height));
    if (localY <= region.height - radius) return true;
    const centreX = localX < radius ? radius : localX > region.width - radius ? region.width - radius : localX;
    return (localX - centreX) ** 2 + (localY - (region.height - radius)) ** 2 <= radius ** 2;
  }
  return { sizes, sizesFor, gutter, shadow, windowSize, hostSize, hostFor, contains,
    silhouette, shoulderFor, radiusFor, borderRadiusFor };
}));
