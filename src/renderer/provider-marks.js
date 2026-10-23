'use strict';

// Original provider SVGs, bundled locally. Provenance and trademarks:
// assets/providers/README.md and THIRD_PARTY_NOTICES.md.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ProviderMarks = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const marks = {
    codex: { label: 'Codex', src: 'assets/providers/openai.svg' },
    claude: { label: 'Claude', src: 'assets/providers/claude.svg' },
  };
  function markFor(provider) { return Object.hasOwn(marks, provider) ? marks[provider] : marks.claude; }
  function markHtml(provider) {
    const id = Object.hasOwn(marks, provider) ? provider : 'claude';
    return '<img class="provider-logo" data-provider="' + id + '" src="' + marks[id].src + '" alt="" aria-hidden="true" draggable="false">';
  }
  function markElement(provider, document) {
    const id = Object.hasOwn(marks, provider) ? provider : 'claude';
    const image = document.createElement('img');
    image.className = 'provider-logo';
    image.dataset.provider = id;
    image.src = marks[id].src;
    image.alt = '';
    image.draggable = false;
    image.setAttribute('aria-hidden', 'true');
    return image;
  }
  return { marks, markFor, markHtml, markElement };
}));
