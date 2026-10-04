import { $, $$, reduced, fine, isMobile, gsap, ScrollTrigger, world, track } from './core.js';
import { SplitText } from 'gsap/SplitText';
import { heroLift, perch, dive, pour, pile, orbit } from './world/layouts.js';
import { InkFluid } from './lib/fluid.js';
import { Corridor } from './lib/corridor.js';
import { SharedGround } from './lib/shared-ground.js';
import { InkField } from './ink.js';
import { EVENTS, MENU, statusOf } from './data.js';
import { trailerModal } from './trailer.js';
import { map } from './map.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

export function mountHome() {
  hero();
  ticker();
  manifesto();
  corridor();
  rooms();
  cinema();
  latte();
  ground();
  founder();
  menuRail();
  map();
  trailerModal();
}

function founder() {
  const photo = $('.founder-photo');
  if (world && photo) world.layout($('.founder'), orbit(photo, { size: 18, scale: 0.62 }));
}

/* ================================================================ 1 · living ink hero */
export function logoMemory(ctx, w, h) {
  const mobile = w < h;
  const r = mobile ? w * 0.105 : Math.min(w, h) * 0.13;
  const gap = r * 1.9, tot = gap * 3;
  const cx = w / 2, cy = h * (mobile ? 0.34 : 0.36);
  ['O', 'M', 'I', 'C'].forEach((L, i) => {
    const x = cx - tot / 2 + i * gap;
    ctx.fillStyle = i === 3 ? '#4a6fe8' : '#17140f';
    ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';
    ctx.font = `400 ${r * 1.08}px Oswald, "Arial Narrow", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(L, x, cy + r * 0.05); ctx.restore();
  });
}

function hero() {
  const host = $('[data-hero-paint]');
  const title = $('[data-hero-title]');
  if (!host) return;
  let fluid = null;
  if (InkFluid.supported()) {
    try {
      fluid = track(new InkFluid(host, { memory: logoMemory, palette: ['#4a6fe8', '#dd7a3b', '#c6a8ea', '#a8432b', '#3f8f5f'] }));
    } catch (err) { console.warn('[OMIC] fluid failed, using fallback', err); fluid = null; }
  }
  if (!fluid) {
    track(new InkField(host, { layout: 'logo', centerY: 0.36, balls: ['O', 'M', 'I', 'C'].map((letter) => ({ letter, r: isMobile() ? 0.118 : 0.1 })) }));
  }

  // entrance: title rises, the paper takes a few drops of colour
  if (!reduced) {
    gsap.from(title, { yPercent: 30, opacity: 0, duration: 1.6, ease: 'expo.out', delay: 0.2 });
    gsap.from('.hero-meta > *', { y: 30, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.12, delay: 0.5 });
    gsap.from('.spin-badge', { scale: 0, rotate: -120, duration: 1.4, ease: 'back.out(1.6)', delay: 0.8 });
    if (fluid) {
      const drops = [[0.24, 0.6, '#4a6fe8'], [0.76, 0.22, '#dd7a3b'], [0.5, 0.62, '#c6a8ea'], [0.86, 0.6, '#a8432b'], [0.14, 0.24, '#dd7a3b']];
      drops.forEach(([x, y, c], i) => setTimeout(() => fluid.splash(x, y, (Math.random() - 0.5) * 0.02, -0.012, c, 2.2, 2.2), 700 + i * 380));
    }
    // leaving the hero: the title lifts away, the painting sinks
    gsap.to(title, { yPercent: -40, opacity: 0.0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  }
  // kinetic type: the headline's letters lean away from the cursor like wet ink being pushed
  if (fine && !reduced) {
    const split = SplitText.create(title, { type: 'chars', charsClass: 'kc', aria: 'auto' });
    const chars = split.chars.map((c) => ({ el: c, y: gsap.quickTo(c, 'y', { duration: 0.6, ease: 'power3' }), r: gsap.quickTo(c, 'rotation', { duration: 0.8, ease: 'power3' }), s: gsap.quickTo(c, 'scaleY', { duration: 0.6, ease: 'power3' }) }));
    const hero = $('.hero');
    hero.addEventListener('pointermove', (e) => {
      chars.forEach((c) => {
        const b = c.el.getBoundingClientRect();
        const dx = b.left + b.width / 2 - e.clientX, dy = b.top + b.height / 2 - e.clientY;
        const d = Math.hypot(dx, dy), f = Math.max(0, 1 - d / 220);
        c.y(-f * 26 * Math.sign(dy || 1) * -1); c.r(f * 10 * Math.sign(dx)); c.s(1 + f * 0.18);
      });
    });
    hero.addEventListener('pointerleave', () => chars.forEach((c) => { c.y(0); c.r(0); c.s(1); }));
  }
  // the painted logo lifts off the paper as real 3D drops
  if (world && fluid) {
    world.layout($('.hero'), heroLift(host, (p) => {
      host.style.opacity = String(1 - Math.min(1, p * 4));
      fluid.paused = p > 0.3;
    }), { extend: 120 });
  }
}

/* ================================================================ marquee */
function ticker() {
  const track = $('[data-ticker]');
  if (!track) return;
  const items = EVENTS.map((e) => {
    const s = statusOf(e);
    const tag = e.full && s === 'upcoming' ? '<span class="tag full">House full</span>'
      : s === 'live' ? '<span class="tag live">On now</span>'
      : s === 'open' ? '<span class="tag open">Open call</span>'
      : s === 'completed' ? '<span class="tag">Archive</span>' : '<span class="tag">Upcoming</span>';
    return `<a class="ticker-item" href="${e.href}">${tag}<b>${e.title}</b><span class="when">${e.when}</span></a><span class="ticker-item" aria-hidden="true"><span class="ticker-star"></span></span>`;
  }).join('') + '<a class="ticker-item" href="/cafe.html"><span class="tag">OMICafe</span><b>Coffee, pastries &amp; all-day plates</b></a><span class="ticker-item" aria-hidden="true"><span class="ticker-star"></span></span>';
  track.innerHTML = `<div class="marquee-half">${items}</div><div class="marquee-half" aria-hidden="true">${items}</div>`;
  $$('[aria-hidden="true"] a', track).forEach((a) => a.setAttribute('tabindex', '-1'));
}

/* ================================================================ 2 · manifesto */
function manifesto() {
  const sec = $('[data-manifesto]');
  const text = $('[data-manifesto-text]');
  if (!sec || !text) return;
  const frag = document.createDocumentFragment();
  [...text.childNodes].forEach((n) => {
    if (n.nodeType === 3) {
      n.textContent.split(/\s+/).filter(Boolean).forEach((w) => {
        const s = document.createElement('span'); s.className = 'mw'; s.textContent = w; frag.appendChild(s); frag.appendChild(document.createTextNode(' '));
      });
    } else { n.classList.add('mw'); frag.appendChild(n); frag.appendChild(document.createTextNode(' ')); }
  });
  text.innerHTML = '';
  text.appendChild(frag);
  text.setAttribute('aria-label', 'A space where cinema, theatre, art, and culture come together.');
  const words = $$('.mw', text);
  const marks = $$('.mark path', text);
  if (reduced) { sec.classList.add('is-settled'); return; }
  gsap.set(marks, { drawSVG: '0%' });
  const tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: 1.2 } });
  words.forEach((w, i) => {
    tl.from(w, {
      x: () => `${(Math.random() - 0.5) * 120}vw`, y: () => `${(Math.random() - 0.5) * 100}vh`,
      rotate: () => (Math.random() - 0.5) * 140, scale: () => 0.3 + Math.random() * 2.2, opacity: 0, filter: 'blur(10px)',
      duration: 1, ease: 'power3.out',
    }, i * 0.06);
  });
  tl.to(marks, { drawSVG: '100%', duration: 0.4, stagger: 0.12, ease: 'none' }, '>-0.1');
  tl.add(() => {}, '+=0.3');
  ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom', onUpdate: (s) => sec.classList.toggle('is-settled', s.progress > 0.72) });
  if (world) world.layout(sec, perch($$('.key', text)));
}

/* ================================================================ 3 · the 3D warehouse */
function corridor() {
  const sec = $('[data-corridor]');
  const stage = $('[data-corridor-stage]');
  if (!sec || !stage) return;
  const items = EVENTS.map((e) => ({ img: e.poster, href: e.href, title: e.title, when: e.when, kicker: e.kicker, ratio: e.ratio.split('/').reduce((a, b) => Number(a) / Number(b)) }));
  let cor = null;
  try {
    const t = document.createElement('canvas');
    if (t.getContext('webgl2') || t.getContext('webgl')) cor = track(new Corridor(stage, items));
  } catch (err) { console.warn('[OMIC] corridor fallback', err); }
  if (world) world.layout(sec, dive());
  if (!cor) { sec.classList.add('no-webgl'); stage.innerHTML = items.map((i) => `<a class="fallback-frame" href="${i.href}"><img src="${i.img}" alt=""><strong>${i.title}</strong><span>${i.when}</span></a>`).join(''); return; }

  const room = $('[data-room]'), bar = $('[data-hud-bar]'), intro = $('[data-corridor-intro]'), end = $('[data-corridor-end]');
  $('[data-rooms]').textContent = String(items.length).padStart(2, '0');
  ScrollTrigger.create({
    trigger: sec, start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate: (s) => {
      const p = s.progress;
      cor.setProgress(p);
      room.textContent = String(Math.min(items.length, 1 + Math.floor(p * items.length * 1.05))).padStart(2, '0');
      bar.style.transform = `scaleX(${p})`;
      intro.style.opacity = String(clamp(1 - p * 9));
      sec.style.setProperty('--veil', String(clamp(1 - p * 8)));
      intro.style.transform = `translateY(${-p * 300}px)`;
      end.classList.toggle('is-on', p > 0.9);
    },
  });
  cor.setProgress(0);
}

/* ================================================================ 4 · rooms by torchlight */
function rooms() {
  const sec = $('[data-rooms-sec]');
  if (!sec) return;
  const roomsEls = $$('.room', sec);
  if (world) world.layout(sec, dive());
  if (!fine) { sec.classList.add('lit'); return; }
  sec.addEventListener('pointermove', (e) => {
    roomsEls.forEach((r) => {
      const b = r.getBoundingClientRect();
      r.style.setProperty('--mx', `${e.clientX - b.left}px`);
      r.style.setProperty('--my', `${e.clientY - b.top}px`);
    });
  });
  sec.addEventListener('pointerenter', () => sec.classList.add('torch-on'));
  sec.addEventListener('pointerleave', () => sec.classList.remove('torch-on'));
  if (!reduced) {
    roomsEls.forEach((r) => {
      gsap.from(r.querySelector('.room-word'), { xPercent: -12, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: r, start: 'top 85%', once: true } });
    });
  }
}

/* ================================================================ 5 · cinema: lights down, bars in */
function cinema() {
  const sec = $('[data-cinema]');
  if (!sec) return;
  // theatre: 5 curved rows, 50 seats
  if (world) world.layout(sec, dive());
  const svg = $('[data-theatre]');
  let seats = '';
  const rows = [8, 9, 10, 11, 12];
  rows.forEach((n, ri) => {
    const R = 70 + ri * 18;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.18 + 0.64 * (i / (n - 1)));
      const x = 200 - Math.cos(a) * R * 1.6, y = Math.sin(a) * R * 0.95 - 40 + ri * 4;
      seats += `<rect class="seat" x="${(x - 6).toFixed(1)}" y="${(y - 5).toFixed(1)}" width="12" height="10" rx="3"/>`;
    }
  });
  svg.innerHTML = `<rect class="screen-line" x="120" y="2" width="160" height="3" rx="1.5"/>${seats}`;
  const seatEls = $$('.seat', svg);
  if (reduced) { seatEls.forEach((s) => s.classList.add('taken')); return; }

  const tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: 1 } });
  tl.fromTo('[data-lb].top', { scaleY: 0 }, { scaleY: 1, ease: 'none', duration: 0.25 }, 0)
    .fromTo('[data-lb].bottom', { scaleY: 0 }, { scaleY: 1, ease: 'none', duration: 0.25 }, 0)
    .from('.cinema-screen', { scale: 0.7, rotateY: -25, opacity: 0.3, duration: 0.35, ease: 'power2.out' }, 0)
    .from('.projector-beam', { opacity: 0, duration: 0.2 }, 0.05)
    .from('.cinema-title', { letterSpacing: '0.6em', opacity: 0, duration: 0.3 }, 0.05)
    .to('[data-credits]', { yPercent: -62, ease: 'none', duration: 0.6 }, 0.25)
    .to(seatEls, { attr: { class: 'seat taken' }, stagger: 0.008, duration: 0.01 }, 0.35);
}

/* ================================================================ 6 · latte you can stir */
function latte() {
  const host = $('[data-latte]');
  if (!host) return;
  if (!InkFluid.supported()) { host.classList.add('static'); return; }
  try {
    const cup = track(new InkFluid(host, {
      cup: true, paper: '#3b2416', rim: '#f4ede1', palette: ['#f3e6cf', '#fff6e6', '#e9d3b0'], restore: 0.32,
      dyeRes: 512, simRes: 96, curl: 8, force: 3200, splatRadius: 0.003, idle: true,
      memory(ctx, w, h) { // a rosetta-ish heart in milk foam
        const cx = w / 2, cy = h / 2, s = Math.min(w, h) * 0.3;
        ctx.fillStyle = '#c9925e'; ctx.beginPath(); ctx.arc(cx, cy, s * 1.35, 0, Math.PI * 2); ctx.fill(); // crema
        ctx.fillStyle = '#f6ead6';
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.75);
        ctx.bezierCurveTo(cx - s * 1.3, cy - s * 0.1, cx - s * 0.55, cy - s * 0.95, cx, cy - s * 0.38);
        ctx.bezierCurveTo(cx + s * 0.55, cy - s * 0.95, cx + s * 1.3, cy - s * 0.1, cx, cy + s * 0.75);
        ctx.fill();
        ctx.fillStyle = '#c9925e';
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(cx, cy - s * 0.15 + i * s * 0.2, s * (0.62 - i * 0.12), s * 0.05, 0, 0, Math.PI * 2); ctx.fill(); }
      },
    }));
    // the four drops dive into the coffee; each one makes a splash
    if (world) world.layout($('.intermission'), pour(host, (i, c) => {
      cup.splash(0.5 + (Math.random() - 0.5) * 0.1, 0.5 + (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.03, ['#fff6e6', '#e9d3b0', '#f3e6cf', '#c9925e'][i], 1.6, 1.4);
      document.dispatchEvent(new CustomEvent('omic:drop-hit'));
    }));
  } catch (err) { console.warn('[OMIC] latte fallback', err); host.classList.add('static'); }
}

/* ================================================================ 7 · shared ground painting */
function ground() {
  const host = $('[data-ground]');
  if (!host) return;
  const art = track(new SharedGround(host, { strokes: 460 }));
  if (world) world.layout($('.ground'), pile($('.ground-art'), { from: 0.58, to: 0.98 }));
  if (reduced) { art.setProgress(1); return; }
  ScrollTrigger.create({ trigger: host.parentElement, start: 'top 80%', end: 'bottom 60%', onUpdate: (s) => art.setProgress(s.progress) });
  host.addEventListener('click', () => art.repaint());
  host.dataset.cursor = 'Repaint';
  gsap.from('.ground-title span', { yPercent: 100, opacity: 0, duration: 1.4, ease: 'expo.out', stagger: 0.15, scrollTrigger: { trigger: '.ground-title', start: 'top 85%', once: true } });
}

/* ================================================================ cafe rail */
function menuRail() {
  const rail = $('[data-menu-rail]');
  if (!rail) return;
  rail.innerHTML = MENU.map((m) => `
    <a class="menu-card" href="/cafe.html">
      <img src="${m.img}" alt="${m.name}" loading="lazy" width="720" height="1280">
      <span class="label">${m.name}${m.note ? `<small>${m.note}</small>` : ''}</span>
    </a>`).join('');
}
