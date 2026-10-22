// Inner pages: programme, event pages, cafe and visit.
import { $, $$, reduced, statusChip, world, track } from './core.js';
import { pour, orbit } from './world/layouts.js';
import { EVENTS } from './data.js';
import { InkFluid } from './lib/fluid.js';
import { trailerModal } from './trailer.js';
import { map } from './map.js';

export function mountPage() {
  statuses();
  filters();
  floatPoster();
  seats();
  cafeInk();
  map();
  trailerModal();
  worldLayouts();
}

function worldLayouts() {
  if (!world) return;
  const poster = $('.ev-poster .frame, .ev-poster .poster-3d');
  if (poster) world.layout($('.ev-hero'), orbit(poster, { size: 14, scale: 0.6, speed: 0.25 }));
  const ring = $('[data-lost-ring]');
  if (ring) world.layout($('[data-lost]'), orbit(ring, { size: 46, scale: 0.9, speed: 0.4, colors: ['#f4ede1', '#f4ede1', '#f4ede1', '#4a6fe8'] }));
  const founder = $('.founder-photo');
  if (founder) world.layout($('.founder'), orbit(founder, { size: 16, scale: 0.62 }));
}

function statuses() {
  $$('[data-ev]').forEach((el) => {
    const ev = EVENTS.find((e) => e.id === el.dataset.ev);
    const slot = $('[data-status]', el);
    if (ev && slot) slot.outerHTML = statusChip(ev);
  });
}

function filters() {
  const btns = $$('[data-filter]');
  if (!btns.length) return;
  const rows = $$('.prog-row');
  btns.forEach((b) => {
    const f = b.dataset.filter;
    $('.n', b).textContent = f === 'all' ? rows.length : rows.filter((r) => r.dataset.cat.split(' ').includes(f)).length;
  });
  const apply = (f) => {
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === f)));
    rows.forEach((r, i) => {
      const show = f === 'all' || r.dataset.cat.split(' ').includes(f);
      r.classList.toggle('is-hidden', !show);
      if (show && !reduced) r.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: i * 60, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    });
    const url = new URL(location.href);
    if (f === 'all') url.searchParams.delete('f'); else url.searchParams.set('f', f);
    history.replaceState(null, '', url);
  };
  btns.forEach((b) => b.addEventListener('click', () => apply(b.dataset.filter)));
  const start = new URLSearchParams(location.search).get('f');
  if (start && btns.some((b) => b.dataset.filter === start)) apply(start);
}

// a poster that follows the cursor while hovering programme rows / menu items
function floatPoster() {
  const fp = $('.float-poster');
  if (!fp || !window.matchMedia('(hover: hover)').matches) return;
  const img = $('img', fp);
  let x = 0, y = 0, cx = 0, cy = 0, on = false;
  const loop = () => { cx += (x - cx) * 0.18; cy += (y - cy) * 0.18; fp.style.left = `${cx}px`; fp.style.top = `${cy}px`; if (on || Math.abs(x - cx) > 0.5) requestAnimationFrame(loop); };
  $$('[data-poster], [data-img]').forEach((el) => {
    el.addEventListener('pointerenter', (e) => {
      img.src = el.dataset.poster || el.dataset.img;
      x = cx = e.clientX; y = cy = e.clientY; on = true; fp.classList.add('is-on'); loop();
    });
    el.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; });
    el.addEventListener('pointerleave', () => { on = false; fp.classList.remove('is-on'); });
  });
}

function seats() {
  $$('[data-seats]').forEach((el) => {
    const n = Number(el.dataset.seats) || 50;
    el.innerHTML = Array.from({ length: n }, (_, i) => `<i style="--i:${i}"></i>`).join('');
  });
}

function cafeInk() {
  const host = $('[data-latte]');
  if (!host) return;
  if (!InkFluid.supported()) { host.classList.add('static'); return; }
  try {
    const cup = track(new InkFluid(host, {
      cup: true, paper: '#3b2416', rim: '#f4ede1', palette: ['#f3e6cf', '#fff6e6', '#e9d3b0'], restore: 0.32,
      dyeRes: 512, simRes: 96, curl: 8, force: 3200, splatRadius: 0.003,
      memory(ctx, w, h) {
        const cx = w / 2, cy = h / 2, s = Math.min(w, h) * 0.3;
        ctx.fillStyle = '#c9925e'; ctx.beginPath(); ctx.arc(cx, cy, s * 1.35, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f6ead6';
        ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.75);
        ctx.bezierCurveTo(cx - s * 1.3, cy - s * 0.1, cx - s * 0.55, cy - s * 0.95, cx, cy - s * 0.38);
        ctx.bezierCurveTo(cx + s * 0.55, cy - s * 0.95, cx + s * 1.3, cy - s * 0.1, cx, cy + s * 0.75);
        ctx.fill();
        ctx.fillStyle = '#c9925e';
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(cx, cy - s * 0.15 + i * s * 0.2, s * (0.62 - i * 0.12), s * 0.05, 0, 0, Math.PI * 2); ctx.fill(); }
      },
    }));
    if (world) world.layout($('.cafe-hero'), pour(host, (i, c) => { cup.splash(0.5, 0.5, (Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.03, ['#fff6e6', '#e9d3b0', '#f3e6cf', '#c9925e'][i], 1.6, 1.4); document.dispatchEvent(new CustomEvent('omic:drop-hit')); }));
  } catch (err) { console.warn('[OMIC] latte fallback', err); host.classList.add('static'); }
}
