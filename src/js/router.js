// Seamless navigation: pages swap under an ink curtain while the header, footer, cursor,
// sound and the WebGL world keep living. Falls back to normal links on any error.
import { cover, reveal } from './lib/transition.js';
import { lenis, teardownPage, markNav, reduced } from './core.js';
import { sfx } from './lib/sound.js';

let mountFn = null;
let busy = false;
const cache = new Map();

const isInternal = (url) => url.origin === location.origin && /(\.html|\/)$/.test(url.pathname) && !/\.(pdf|jpe?g|png|webp)$/i.test(url.pathname);

async function fetchPage(url) {
  if (cache.has(url)) return cache.get(url);
  const p = fetch(url, { headers: { 'X-OMIC': 'router' } }).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); });
  cache.set(url, p);
  return p;
}

async function go(href, { push = true, x, y } = {}) {
  if (busy) return;
  busy = true;
  const url = new URL(href, location.href);
  try {
    sfx('whoosh');
    const [html] = await Promise.all([fetchPage(url.href), cover(x, y)]);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nextMain = doc.querySelector('main');
    if (!nextMain) throw new Error('no main');
    teardownPage();
    document.title = doc.title;
    const desc = doc.querySelector('meta[name="description"]');
    if (desc) document.querySelector('meta[name="description"]')?.setAttribute('content', desc.content);
    document.body.dataset.page = doc.body.dataset.page || '';
    document.body.dataset.hour = doc.body.dataset.hour || nextMain.dataset.hour || 'dusk';
    document.querySelector('main').replaceWith(document.adoptNode(nextMain));
    // json-ld for the new page
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => s.remove());
    doc.querySelectorAll('script[type="application/ld+json"]').forEach((s) => document.head.appendChild(s.cloneNode(true)));
    if (push) history.pushState({}, '', url.href);
    if (url.hash) document.querySelector(url.hash)?.scrollIntoView(); else { lenis ? lenis.scrollTo(0, { immediate: true, force: true }) : scrollTo(0, 0); }
    markNav();
    await mountFn();
    await reveal();
  } catch (err) {
    console.warn('[OMIC router] falling back to full load', err);
    location.href = url.href;
  } finally {
    busy = false;
  }
}

export function startRouter(mount) {
  mountFn = mount;
  if (reduced) return;
  history.scrollRestoration = 'manual';
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === '_blank' || a.hasAttribute('download') || a.dataset.noRouter !== undefined) return;
    const url = new URL(a.href, location.href);
    if (!isInternal(url)) return;
    if (url.pathname === location.pathname && url.search === location.search) {
      if (url.hash) return; // in-page anchor
      e.preventDefault(); lenis?.scrollTo(0); return;
    }
    e.preventDefault();
    go(url.href, { x: e.clientX, y: e.clientY });
  });
  // warm the cache on hover
  document.addEventListener('pointerover', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (isInternal(url) && url.pathname !== location.pathname) fetchPage(url.href).catch(() => cache.delete(url.href));
  });
  addEventListener('popstate', () => go(location.href, { push: false }));
}
