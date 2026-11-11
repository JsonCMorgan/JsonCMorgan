/**
 * Minimal DOM patcher: updates `el` to match `html` in place so running CSS
 * animations (progress stripes, pulses) don't restart on every frame.
 */
export function morph(el: Element, html: string) {
  const tpl = document.createElement(el.namespaceURI === 'http://www.w3.org/2000/svg' ? 'div' : el.tagName);
  tpl.innerHTML = html;
  patchChildren(el, tpl);
}

function patchChildren(cur: Node, next: Node) {
  const a = Array.from(cur.childNodes);
  const b = Array.from(next.childNodes);
  for (let i = 0; i < b.length; i++) {
    const n = b[i];
    const o = a[i];
    if (!o) {
      cur.appendChild(n.cloneNode(true));
    } else if (!sameKind(o, n)) {
      cur.replaceChild(n.cloneNode(true), o);
    } else if (o.nodeType === Node.TEXT_NODE || o.nodeType === Node.COMMENT_NODE) {
      if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
    } else {
      patchAttrs(o as Element, n as Element);
      patchChildren(o, n);
    }
  }
  for (let i = a.length - 1; i >= b.length; i--) cur.removeChild(a[i]);
}

function sameKind(a: Node, b: Node) {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== Node.ELEMENT_NODE) return true;
  const ea = a as Element;
  const eb = b as Element;
  return ea.tagName === eb.tagName && (ea.getAttribute('data-key') ?? '') === (eb.getAttribute('data-key') ?? '');
}

function patchAttrs(o: Element, n: Element) {
  for (const { name, value } of Array.from(n.attributes)) if (o.getAttribute(name) !== value) o.setAttribute(name, value);
  for (const { name } of Array.from(o.attributes)) if (!n.hasAttribute(name)) o.removeAttribute(name);
}
