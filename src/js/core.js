// OMIC — shared engine.
// bootOnce(): things that live for the whole visit (smooth scroll, header, footer, cursor, the WebGL
// world, sound, intro). initPage(main): everything that belongs to one page, wrapped in a gsap
// context so the router can tear it down and mount the next page without a reload.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import Lenis from 'lenis';
import { EVENTS, statusOf, STATUS_LABEL, VENUE, url, currentEvents } from './data.js';
import { InkField } from './ink.js';
import { brushCursor } from './lib/cursor.js';
import { filmLeader } from './lib/leader.js';
import { toggleSound, soundOn, sfx } from './lib/sound.js';
import { World, COLORS } from './world/world.js';

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);
export { gsap, ScrollTrigger };

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
export const isMobile = () => innerWidth < 720;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
};

export let lenis = null;
export let world = null;

/* ================================================================== smooth scroll */
function smooth() {
  if (reduced) return;
  // lerp: how quickly the page catches up with your fingers (higher = more direct)
  lenis = new Lenis({ lerp: 0.14, wheelMultiplier: 1, touchMultiplier: 1.4 });
  window.__lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  document.documentElement.classList.add('lenis');
}

/* ================================================================== header */
const NAV = [
  { href: url('/'), label: 'Home', key: 'home' },
  { href: url('/programme.html'), label: 'Programme', key: 'programme' },
  { href: url('/events/newton.html'), label: 'Cinema', key: 'cinema' },
  { href: url('/cafe.html'), label: 'Cafe', key: 'cafe' },
  { href: url('/visit.html'), label: 'Visit', key: 'visit' },
];

export function rollHTML(text) {
  const ch = (c) => (c === ' ' ? ' ' : c);
  return `<span class="roll" aria-hidden="true">${[...text].map((c, i) => `<span style="--i:${i}" data-c="${ch(c)}">${ch(c)}</span>`).join('')}</span><span class="sr-only">${text}</span>`;
}

function nowLine() {
  const now = new Date();
  const live = EVENTS.filter((e) => ['live', 'open'].includes(statusOf(e, now)));
  const next = EVENTS.filter((e) => statusOf(e, now) === 'upcoming').sort((a, b) => new Date(a.start) - new Date(b.start))[0];
  if (live[0]) return `${statusOf(live[0], now) === 'open' ? 'Open call' : 'On now'}: ${live[0].title}`;
  if (next) return `Next: ${next.title} · ${next.when}`;
  return 'New programme coming soon';
}

function buildHeader() {
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <a class="logo" href="${url('/')}" aria-label="OMIC Cultural Hub, home">
      <span class="c">O</span><span class="c">M</span><span class="c">I</span><span class="c">C</span>
      <span class="suffix" aria-hidden="true"><span>ulture</span><span>inema</span><span>afe</span><span>ulture</span></span>
    </a>
    <nav aria-label="Main"><ul class="nav-links">
      ${NAV.map((n) => `<li><a href="${n.href}" data-nav="${n.key}">${rollHTML(n.label)}</a></li>`).join('')}
    </ul></nav>
    <div class="header-right">
      <a class="now-pill" href="${url('/programme.html')}"><span class="pulse"></span><span>${nowLine()}</span></a>
      <button class="sound-btn" aria-pressed="false" aria-label="Toggle sound" data-cursor="Sound"><i></i><i></i><i></i><i></i></button>
      <button class="menu-btn" aria-expanded="false" aria-controls="menu-panel" aria-label="Open menu"><i></i></button>
    </div>`;
  document.body.prepend(header);

  const panel = document.createElement('div');
  panel.className = 'menu-panel';
  panel.id = 'menu-panel';
  panel.innerHTML = `<ul>${NAV.map((n, i) => `<li><a href="${n.href}"><span>${n.label}</span><small>0${i + 1}</small></a></li>`).join('')}</ul>
    <div class="menu-foot"><span>${VENUE.line1}, ${VENUE.line2}, Al Quoz, Dubai</span><span><a href="${VENUE.phoneHref}">${VENUE.phone}</a> · <a href="mailto:${VENUE.email}">${VENUE.email}</a></span></div>`;
  header.after(panel);

  const btn = $('.menu-btn', header);
  const setMenu = (open) => {
    document.documentElement.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    open ? lenis?.stop() : lenis?.start();
  };
  btn.addEventListener('click', () => setMenu(!document.documentElement.classList.contains('menu-open')));
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  const sb = $('.sound-btn', header);
  const syncSound = () => { sb.setAttribute('aria-pressed', String(soundOn())); sb.classList.toggle('is-on', soundOn()); };
  sb.addEventListener('click', () => { toggleSound(); syncSound(); });
  document.addEventListener('omic:sound', syncSound);

  let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    if (!document.documentElement.classList.contains('menu-open')) header.classList.toggle('is-hidden', y > lastY + 2 && y > 240);
    if (y < lastY - 2) header.classList.remove('is-hidden');
    lastY = y;
  }, { passive: true });

  const skip = document.createElement('a');
  skip.className = 'skip-link'; skip.href = '#main'; skip.textContent = 'Skip to content';
  document.body.prepend(skip);
}

export function markNav() {
  const page = document.body.dataset.page || '';
  $$('[data-nav]').forEach((a) => (a.dataset.nav === page ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
}

/* ================================================================== footer (persistent) */
function buildFooter() {
  const f = document.createElement('footer');
  f.className = 'site-footer';
  f.dataset.hour = 'night';
  f.innerHTML = `
    <div class="wrap footer-head">
      <span class="kicker no-dot">Culture · Cinema · Cafe</span>
      <h2 class="display footer-big">Step <span class="serif">inside</span>.</h2>
    </div>
    <div class="footer-stage" data-footer-stage data-cursor="Throw" data-no-trail aria-hidden="true"><span class="footer-hint">Grab the circles — throw them</span></div>
    <div class="wrap">
      <div class="footer-grid">
        <div>
          <h5>Hear it first</h5>
          <p style="margin:0;opacity:.8;max-width:38ch">Screenings, openings and open calls — straight to your inbox.</p>
          <form class="newsletter" data-demo-form novalidate>
            <label class="sr-only" for="nl-email">Email</label>
            <input id="nl-email" type="email" name="email" placeholder="you@email.com" required autocomplete="email">
            <button class="btn light" type="submit">Join</button>
          </form>
        </div>
        <div><h5>Explore</h5><ul>${NAV.map((n) => `<li><a href="${n.href}">${n.label}</a></li>`).join('')}</ul></div>
        <div><h5>Now</h5><ul>${currentEvents().map((e) => `<li><a href="${e.href}">${e.title}</a></li>`).join('')}<li><a href="${url('/programme.html')}">Full programme &amp; archive</a></li></ul></div>
        <div><h5>Find us</h5><address style="font-style:normal;opacity:.85">${VENUE.line1}<br>${VENUE.line2}<br>${VENUE.line3}</address>
          <ul class="contact-list">
            <li><a href="${VENUE.phoneHref}">${VENUE.phone}</a></li>
            <li><a href="${VENUE.whatsappHref}" target="_blank" rel="noopener">WhatsApp ${VENUE.whatsapp}</a></li>
            <li><a href="mailto:${VENUE.email}">${VENUE.email}</a></li>
          </ul>
          <p style="margin-top:12px"><a href="${VENUE.maps}" target="_blank" rel="noopener" class="u-link">Get directions ↗</a></p>
          <p class="dubai-clock" data-clock></p></div>
      </div>
      <div class="footer-base"><span>© 2026 OMIC Cultural Hub. All events subject to change.</span><span>Where art finds its home.</span></div>
    </div>`;
  ($('main') || document.body).after(f);
  splitReveal($('.footer-big', f));
  formsIn(f);
  clock($('[data-clock]', f));

  const stage = $('[data-footer-stage]', f);
  if (world) {
    // the drops fall into the footer and pile up — you can throw them
    world.layout(f, () => {
      const r = stage.getBoundingClientRect();
      const big = Math.min(r.width, 900) * (isMobile() ? 0.11 : 0.075);
      const xs = [0.18, 0.34, 0.5, 0.66, 0.26, 0.44, 0.58, 0.78, 0.12, 0.86];
      return {
        mode: 'gravity', floor: r.bottom - 6, left: r.left, right: r.right,
        drops: xs.map((x, i) => ({ x: r.left + r.width * x, spawnY: r.top - 80 - i * 70, r: i < 4 ? big : big * (0.45 + (i % 3) * 0.15), color: i < 4 ? COLORS.lavender : [COLORS.blue, COLORS.orange, COLORS.blue, COLORS.orange, COLORS.lavender, COLORS.green][i - 4], letter: i < 4 ? 1 : 0 })),
      };
    }, true);
  } else {
    let field;
    ScrollTrigger.create({
      trigger: stage, start: 'top 80%', once: true,
      onEnter: () => {
        field = new InkField(stage, {
          layout: 'pile', gravity: true, cursorBall: false, shadow: 0.0, k: 0.32,
          balls: [
            { letter: 'O', color: 3, r: 0.16 }, { letter: 'M', color: 3, r: 0.16 }, { letter: 'I', color: 3, r: 0.16 }, { letter: 'C', color: 1, r: 0.16 },
            { color: 1, r: 0.1 }, { color: 2, r: 0.12 }, { color: 1, r: 0.07 }, { color: 2, r: 0.06 }, { color: 3, r: 0.08 },
          ],
        });
        stage.addEventListener('click', (e) => { if (e.detail > 1) field.redrop(); });
      },
    });
  }
}

function clock(el) {
  if (!el) return;
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', hour12: true });
  const tick = () => { el.innerHTML = `<span class="pulse"></span> ${fmt.format(new Date())} in Al Quoz`; };
  tick(); setInterval(tick, 20000);
}

/* ================================================================== text */
export function splitReveal(el, { delay = 0 } = {}) {
  if (!el || el.dataset.splitDone) return;
  el.dataset.splitDone = '1';
  const split = SplitText.create(el, { type: 'lines,chars', mask: 'lines', linesClass: 'sl', charsClass: 'sc', aria: 'auto' });
  if (reduced) return;
  gsap.from(split.chars, { yPercent: 115, rotate: 6, duration: 1.15, ease: 'expo.out', stagger: { each: 0.022 }, delay, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
}

/* ================================================================== brush reveal (fallback when there is no WebGL world) */
let brushId = 0;
const BRUSH_PATH = 'M-10 12 C 20 4, 60 18, 110 8 M110 26 C 70 34, 30 20, -10 32 M-10 48 C 30 40, 70 56, 110 46 M110 64 C 70 72, 30 58, -10 70 M-10 86 C 30 78, 70 94, 110 86 M110 102 C 60 110, 30 96, -10 108';
function brushes(root) {
  $$('[data-brush]', root).forEach((el) => {
    const img = $('img', el);
    if (!img || el.dataset.brushDone) return;
    el.dataset.brushDone = '1';
    if (world) { world.addMedia(el); return; }
    const id = `brush-${brushId++}`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'brush-svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<defs><filter id="${id}-f"><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="${brushId}"/><feDisplacementMap in="SourceGraphic" scale="9"/></filter>
        <mask id="${id}-m" maskUnits="userSpaceOnUse" x="-20" y="-20" width="140" height="140"><g filter="url(#${id}-f)"><path d="${BRUSH_PATH}" fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round"/></g></mask></defs>
      <image href="${img.getAttribute('src')}" width="100" height="100" preserveAspectRatio="xMidYMid slice" mask="url(#${id}-m)"/>`;
    el.appendChild(svg);
    img.classList.add('brush-src');
    const path = $('path', svg);
    if (reduced) { el.classList.add('brushed'); return; }
    gsap.set(path, { drawSVG: '0%' });
    ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => gsap.to(path, { drawSVG: '100%', duration: 1.8, ease: 'power2.inOut', onComplete: () => el.classList.add('brushed') }) });
  });
}

/* ================================================================== hand-drawn annotations */
const MARKS = {
  circle: { vb: '0 0 220 90', d: 'M118 8 C 60 2, 8 18, 10 46 C 12 76, 80 86, 140 80 C 196 74, 214 52, 206 30 C 196 8, 140 4, 96 12' },
  underline: { vb: '0 0 220 30', d: 'M4 18 C 40 10, 80 24, 120 14 S 190 10, 216 16' },
  scribble: { vb: '0 0 220 40', d: 'M4 26 C 30 10, 40 34, 64 18 S 100 8, 120 26 S 170 34, 214 12' },
  box: { vb: '0 0 220 90', d: 'M6 10 L 214 6 L 210 84 L 10 82 Z' },
};
function annotations(root) {
  $$('[data-annotate]', root).forEach((el) => {
    if (el.querySelector(':scope > .mark')) return;
    const m = MARKS[el.dataset.annotate] || MARKS.circle;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', `mark mark-${el.dataset.annotate}`); svg.setAttribute('viewBox', m.vb); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<path d="${m.d}" fill="none" stroke="currentColor" stroke-width="${el.dataset.annotate === 'circle' ? 3.2 : 4}" stroke-linecap="round"/>`;
    el.appendChild(svg);
    const p = $('path', svg);
    if (reduced || el.closest('[data-manifesto]')) return;
    gsap.set(p, { drawSVG: '0%' });
    ScrollTrigger.create({ trigger: el, start: el.dataset.annotateStart || 'top 70%', once: true, onEnter: () => gsap.to(p, { drawSVG: '100%', duration: 1.1, ease: 'power2.inOut', delay: parseFloat(el.dataset.delay || 0) }) });
  });
}

/* ================================================================== velocity marquees */
function marquees(root) {
  $$('[data-marquee]', root).forEach((el) => {
    const track = $('.marquee-track', el);
    if (!track || reduced) return;
    const tl = gsap.to(track, { xPercent: -50, ease: 'none', duration: parseFloat(el.dataset.speed || 40), repeat: -1 });
    ScrollTrigger.create({
      trigger: el, start: 'top bottom', end: 'bottom top',
      onUpdate: (self) => {
        const v = self.getVelocity();
        gsap.to(tl, { timeScale: self.direction * (1 + Math.min(4, Math.abs(v) / 600)), duration: 0.3, overwrite: true });
        gsap.to(tl, { timeScale: self.direction, duration: 1.2, delay: 0.3 });
      },
    });
  });
}

/* ================================================================== rails */
function rails(root) {
  $$('.rail', root).forEach((rail) => {
    let down = false, sx = 0, sl = 0, moved = 0, v = 0, lastX = 0, raf;
    rail.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; moved = 0; sx = e.clientX; lastX = e.clientX; sl = rail.scrollLeft; cancelAnimationFrame(raf); });
    rail.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx));
      if (moved > 4) rail.classList.add('is-dragging');
      rail.scrollLeft = sl - dx; v = e.clientX - lastX; lastX = e.clientX;
    });
    const up = () => {
      if (!down) return; down = false; rail.classList.remove('is-dragging');
      const glide = () => { if (Math.abs(v) < 0.4) return; rail.scrollLeft -= v; v *= 0.94; raf = requestAnimationFrame(glide); };
      glide();
    };
    rail.addEventListener('pointerup', up); rail.addEventListener('pointerleave', up);
    rail.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    rail.setAttribute('data-lenis-prevent-horizontal', '');
  });
}

/* ================================================================== tilt + magnetic */
function tilt(root) {
  if (!fine || reduced) return;
  $$('[data-tilt]', root).forEach((el) => {
    const card = el.querySelector('.card') || el;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      gsap.to(card, { rotateY: px * 16, rotateX: -py * 16, duration: 0.6, ease: 'power3.out' });
      card.style.setProperty('--gx', `${(px + 0.5) * 100}%`); card.style.setProperty('--gy', `${(py + 0.5) * 100}%`);
    });
    el.addEventListener('pointerleave', () => gsap.to(card, { rotateY: 0, rotateX: 0, duration: 1, ease: 'elastic.out(1,0.5)' }));
  });
}
function magnetic(root) {
  if (!fine || reduced) return;
  $$('[data-magnetic]', root).forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.3, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.5, ease: 'power3.out' });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1,0.4)' }));
  });
}

/* ================================================================== numbers */
let timers = [];
export function countdown(el, target) {
  const t = new Date(target).getTime();
  const parts = { d: $('[data-d]', el), h: $('[data-h]', el), m: $('[data-m]', el), s: $('[data-s]', el) };
  const set = (node, v) => {
    if (!node) return;
    const s = String(v).padStart(2, '0');
    if (node.textContent !== s) { node.textContent = s; if (!reduced && node.dataset.flip !== undefined) gsap.fromTo(node, { rotateX: -80, opacity: 0.2 }, { rotateX: 0, opacity: 1, duration: 0.6, ease: 'back.out(2)' }); }
  };
  const tick = () => {
    let diff = Math.max(0, t - Date.now());
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5); diff -= h * 36e5;
    const m = Math.floor(diff / 6e4); diff -= m * 6e4;
    set(parts.d, d); set(parts.h, h); set(parts.m, m); set(parts.s, Math.floor(diff / 1e3));
  };
  tick(); timers.push(setInterval(tick, 1000));
}
function countUps(root) {
  $$('[data-count]', root).forEach((el) => {
    const to = Number(el.dataset.count), o = { v: 0 };
    const fmt = (v) => Math.round(v).toLocaleString('en-US');
    if (reduced) { el.textContent = fmt(to); return; }
    el.textContent = '0';
    gsap.to(o, { v: to, duration: 2.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true }, onUpdate: () => { el.textContent = fmt(o.v); } });
  });
}

/* ================================================================== forms (demo mode) */
// Set FORM_ENDPOINT to OMIC's Google Apps Script URL (or any endpoint) to go live.
export const FORM_ENDPOINT = '';
function formsIn(root) {
  $$('form[data-demo-form]', root).forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let ok = true;
      $$('[required]', form).forEach((inp) => {
        const field = inp.closest('.field');
        const bad = inp.type === 'checkbox' ? !inp.checked : inp.type === 'file' ? !inp.files.length : !inp.value.trim() || (inp.type === 'email' && !/^\S+@\S+\.\S+$/.test(inp.value)) || (inp.pattern && !new RegExp(`^(?:${inp.pattern})$`).test(inp.value.trim()));
        if (field) field.classList.toggle('is-error', bad);
        if (bad) ok = false;
      });
      const words = $('[data-words]', form);
      if (words && words.value.trim().split(/\s+/).filter(Boolean).length > 150) { ok = false; words.closest('.field').classList.add('is-error'); }
      if (!ok) { ($('.is-error input, .is-error textarea, .is-error select', form) || $('[required]', form))?.focus(); if (!reduced) gsap.fromTo(form, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1,0.3)' }); sfx('error'); return; }
      $('button[type=submit]', form)?.setAttribute('disabled', '');
      if (FORM_ENDPOINT) { try { await fetch(FORM_ENDPOINT, { method: 'POST', body: new FormData(form), mode: 'no-cors' }); } catch { /* network */ } }
      else await new Promise((r) => setTimeout(r, 700));
      const done = form.dataset.done || 'You’re on the list.';
      form.innerHTML = form.classList.contains('newsletter') ? `<p style="margin:14px 0 0">${done}</p>` : `<div class="form-done"><div class="big">Thank you</div><p>${done}</p></div>`;
      sfx('success');
      if (!reduced) gsap.from(form.firstElementChild, { y: 20, opacity: 0, duration: 0.8, ease: 'expo.out' });
    });
  });
  $$('[data-words]', root).forEach((ta) => {
    const out = ta.closest('.field').querySelector('[data-words-out]');
    const upd = () => { const n = ta.value.trim().split(/\s+/).filter(Boolean).length; out.textContent = `${n}/150 words`; out.style.color = n > 150 ? 'var(--red)' : ''; };
    ta.addEventListener('input', upd); upd();
  });
  $$('.dropzone', root).forEach((dz) => {
    const input = $('input[type=file]', dz), name = $('[data-file-name]', dz);
    ['dragenter', 'dragover'].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.remove('is-over'); }));
    dz.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) { input.files = e.dataTransfer.files; name.textContent = e.dataTransfer.files[0].name; } });
    input.addEventListener('change', () => { if (input.files[0]) name.textContent = input.files[0].name; });
  });
}

export function statusChip(ev) {
  const s = statusOf(ev);
  if (ev.full && s === 'upcoming') return '<span class="status full">House full</span>';
  return `<span class="status ${s}">${STATUS_LABEL[s]}</span>`;
}

/* ================================================================== hours */
function hours(root) {
  const sections = $$('[data-hour]', root);
  if (!sections.length) return;
  document.body.dataset.hour = sections[0].dataset.hour;
  [...sections, $('.site-footer')].filter(Boolean).forEach((s) => {
    ScrollTrigger.create({ trigger: s, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => { if (self.isActive) { document.body.dataset.hour = s.dataset.hour; document.dispatchEvent(new CustomEvent('omic:hour', { detail: s.dataset.hour })); } } });
  });
}

/* ================================================================== page lifecycle */
let pageCtx = null;
let disposables = [];
export const track = (obj) => { if (obj) disposables.push(obj); return obj; };

/** mount the generic behaviour of a page; page-specific modules run inside the same context */
export function initPage(main, pageMount) {
  pageCtx = gsap.context(() => {
    hours(main);
    $$('[data-split]', main).forEach((el) => splitReveal(el));
    $$('[data-reveal]', main).forEach((el) => {
      if (reduced) return;
      const kind = el.dataset.reveal;
      const from = kind === 'scale' ? { scale: 0.9, opacity: 0 } : { y: 50, opacity: 0 };
      gsap.from(el, { ...from, duration: 1.3, ease: 'expo.out', delay: parseFloat(el.style.getPropertyValue('--d')) || 0, scrollTrigger: { trigger: el.parentElement || el, start: 'top 88%', once: true } });
    });
    brushes(main);
    annotations(main);
    marquees(main);
    rails(main);
    tilt(main);
    magnetic(main);
    countUps(main);
    formsIn(main);
    $$('[data-countdown]', main).forEach((el) => countdown(el, el.dataset.countdown));
    pageMount && pageMount(main);
  }, main);
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

export function teardownPage() {
  pageCtx?.revert();
  pageCtx = null;
  timers.forEach(clearInterval); timers = [];
  disposables.forEach((d) => { try { d.destroy?.(); } catch (err) { console.warn(err); } });
  disposables = [];
  world?.clearLayouts();
  world?.clearMedia();
}

/* ================================================================== boot (once per visit) */
export async function bootOnce() {
  document.documentElement.classList.add('js');
  smooth();
  if (!reduced && World.supported()) {
    try { world = new World(); window.__world = world; } catch (err) { console.warn('[OMIC] world unavailable', err); world = null; }
  }
  buildHeader();
  markNav();
  buildFooter();
  const grain = document.createElement('div'); grain.className = 'grain'; grain.setAttribute('aria-hidden', 'true');
  document.body.appendChild(grain);
  brushCursor();
  if (world) gsap.ticker.add((time, delta) => world.tick(delta / 1000, lenis ? lenis.velocity : 0));
  // ui sounds
  document.addEventListener('pointerover', (e) => { if (e.target.closest('a, button, [data-cursor]') && !e.target.closest('a, button, [data-cursor]').contains(e.relatedTarget)) sfx('hover'); });
  document.addEventListener('omic:drop-hit', () => sfx('pop'));
  document.addEventListener('omic:drop-land', (e) => { if (e.detail.v > 7) sfx('tap', e.detail.v); });
  // keep trigger positions honest when images or fonts change the page height
  let lastH = document.documentElement.scrollHeight, t;
  new ResizeObserver(() => {
    const h = document.documentElement.scrollHeight;
    if (Math.abs(h - lastH) < 2) return;
    lastH = h; clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 150);
  }).observe(document.body);
  addEventListener('load', () => ScrollTrigger.refresh());
  await document.fonts.ready.catch(() => {});
  await intro();
}

function intro() {
  const el = $('.leader');
  if (!el) return Promise.resolve();
  if (store.get('omic-entered') || reduced) { el.remove(); return Promise.resolve(); }
  lenis?.stop();
  return new Promise((resolve) => {
    const imgs = $$('main img').slice(0, 8).map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()));
    const ready = Promise.race([Promise.all([...imgs, document.fonts.ready]), new Promise((r) => setTimeout(r, 6000))]);
    filmLeader(el, { ready, onDone: () => { store.set('omic-entered', '1'); lenis?.start(); document.dispatchEvent(new Event('omic:sound')); resolve(); } });
  });
}
