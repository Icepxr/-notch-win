'use strict';
// Small keyed reconciler: polling must not replace focused controls/hovered bars.
window.AiDom = (() => {
  function key(node) { return node.nodeType === 1 ? node.getAttribute('data-ai-key') : null; }
  function compatible(a,b) { return a.nodeType === b.nodeType && (a.nodeType !== 1 || a.tagName === b.tagName); }
  function patch(node,next) {
    if (node.nodeType === 3) { if (node.nodeValue !== next.nodeValue) node.nodeValue=next.nodeValue; return; }
    if (node.nodeType !== 1) return;
    for (const attr of [...node.attributes]) {
      // Numeric styles are owned by the renderer, not by parsed HTML/CSP.
      if (attr.name !== 'style' && !next.hasAttribute(attr.name)) node.removeAttribute(attr.name);
    }
    for (const attr of [...next.attributes]) if (node.getAttribute(attr.name) !== attr.value) node.setAttribute(attr.name,attr.value);
    children(node,next);
  }
  function children(parent,nextParent) {
    const old = [...parent.childNodes], keyed = new Map(old.filter(node => key(node)).map(node => [key(node),node]));
    const kept = new Set(); let cursor=parent.firstChild;
    for (const next of [...nextParent.childNodes]) {
      const id=key(next);
      let node = id ? keyed.get(id) : cursor && !key(cursor) && compatible(cursor,next) ? cursor : null;
      if (node && !compatible(node,next)) node=null;
      if (!node) node=next.cloneNode(true); else patch(node,next);
      if (node !== cursor) parent.insertBefore(node,cursor);
      kept.add(node); cursor=node.nextSibling;
    }
    for (const node of old) if (!kept.has(node) && node.parentNode === parent) node.remove();
  }
  function render(parent,html) {
    const focused=parent.contains(document.activeElement)?document.activeElement:null;
    const template=document.createElement('template');template.innerHTML=html;children(parent,template.content);
    if(focused?.isConnected&&document.activeElement!==focused)focused.focus({preventScroll:true});
  }
  return { render };
})();
