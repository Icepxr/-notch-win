'use strict';
// Each host owns its pending decode. Late artwork cannot overwrite a newer
// track or bring back an image after the player disappears.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MediaArtwork = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  class Presenter {
    constructor({ createImage = () => new Image(), ready = () => {} } = {}) {
      this.createImage = createImage;
      this.ready = ready;
      this.hosts = new WeakMap();
    }
    set(host, source) {
      source = source || null;
      const previous = this.hosts.get(host);
      if (previous?.source === source) return;
      if (previous?.image) { previous.image.onload = null; previous.image.onerror = null; }
      const request = { source, image: null };
      this.hosts.set(host, request);
      const img = host.querySelector('img');
      img.removeAttribute('src');
      host.classList.remove('has-art');
      this.ready(host, null);
      if (!source) return;
      const image = request.image = this.createImage();
      image.onload = () => {
        if (this.hosts.get(host) !== request) return;
        img.src = source;
        host.classList.add('has-art');
        this.ready(host, image);
        image.onload = image.onerror = null;
        request.image = null;
      };
      image.onerror = () => {
        if (this.hosts.get(host) !== request) return;
        this.ready(host, null);
        image.onload = image.onerror = null;
        request.image = null;
      };
      image.src = source;
    }
  }
  return { Presenter };
}));
