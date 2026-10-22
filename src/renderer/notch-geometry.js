'use strict';

// Shared by Electron and the renderer: the native window leaves room for the
// shoulders and shadow, while the painted surface remains centred at the edge.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NotchGeometry = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const gutter = 20;
  const shadow = 32;
  const sizes = {
    closed: { width: 184, height: 28 },
    peek: { width: 300, height: 46 },
    peekMedia: { width: 360, height: 50 },
    open: { width: 520, height: 390 },
    openAi: { width: 520, height: 510 },
  };
  function windowSize(size) {
    return { width: size.width + gutter * 2, height: size.height + shadow };
  }
  // Keep the Windows transparent backing surface stable throughout a morph.
  // Resizing that HWND at both ends can make DWM discard/recreate its surface.
  const hostSize = windowSize({ width: 532, height: 522 });
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
  return { sizes, gutter, shadow, windowSize, hostSize, contains };
}));
