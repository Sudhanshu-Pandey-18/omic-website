// Film-leader intro: the classic projectionist's countdown (3 · 2 · 1) with a sweeping hand,
// gate flicker, dust and scratches — then the projector light opens onto the site.
import { ambient, pop } from './sound.js';

export function filmLeader(el, { onDone, ready } = {}) {
  let isReady = !ready;
  ready && ready.then(() => { isReady = true; });
  const canvas = el.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const btns = el.querySelectorAll('[data-enter]');
  let w, h, dpr, raf, start = performance.now(), finished = false, last = -1, withSound = false, rolling = false;
  const COUNT = 3, PER = 1000;

  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.width = innerWidth * dpr; h = canvas.height = innerHeight * dpr;
  };
  size(); addEventListener('resize', size);

  const scratches = Array.from({ length: 6 }, () => ({ x: Math.random(), life: Math.random() * 30 }));

  const draw = (now) => {
    let t = rolling ? Math.max(0, (now - start) / PER) : 0;
    if (!isReady && t > COUNT - 0.02) t = COUNT - 1 + ((t % 1) * 0.999); // hold on "1" until the site is ready
    const n = Math.max(1, COUNT - Math.floor(t));
    const frac = t % 1;
    if (n !== last) { last = n; if (withSound && t < COUNT) pop(880, 0.06); }
    const flick = 0.86 + Math.random() * 0.14;
    const jx = (Math.random() - 0.5) * 3 * dpr, jy = (Math.random() - 0.5) * 3 * dpr; // gate weave
    ctx.setTransform(1, 0, 0, 1, jx, jy);
    // warm sepia field
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, `rgba(${Math.round(232 * flick)},${Math.round(220 * flick)},${Math.round(198 * flick)},1)`);
    g.addColorStop(0.6, `rgba(${Math.round(170 * flick)},${Math.round(158 * flick)},${Math.round(138 * flick)},1)`);
    g.addColorStop(1, 'rgba(20,16,12,1)');
    ctx.fillStyle = g; ctx.fillRect(-20, -20, w + 40, h + 40);

    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.36;
    // sweeping hand (the darker wedge grows clockwise)
    ctx.fillStyle = 'rgba(40,32,24,0.42)';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, Math.hypot(w, h), -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.closePath(); ctx.fill();
    // crosshair + rings
    ctx.strokeStyle = 'rgba(30,24,18,0.85)'; ctx.lineWidth = 3 * dpr;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    ctx.lineWidth = 6 * dpr; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3 * dpr; ctx.beginPath(); ctx.arc(cx, cy, R * 0.82, 0, Math.PI * 2); ctx.stroke();
    // the OMIC circles sit on the ring like registration marks
    ['O', 'M', 'I', 'C'].forEach((L, i) => {
      const a = -3 * Math.PI / 4 + i * Math.PI / 2;
      const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R, r = R * 0.12;
      ctx.fillStyle = i === 3 ? '#4a6fe8' : '#17140f';
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4ede1'; ctx.font = `400 ${r * 1.05}px Oswald, "Arial Narrow", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(L, px, py + r * 0.05);
    });
    // number
    ctx.fillStyle = '#17140f';
    ctx.font = `300 ${R * 1.25}px Oswald, "Arial Narrow", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(n), cx, cy + R * 0.06);
    // dust + scratches
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(20,16,12,${Math.random() * 0.5})`;
      ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 2.4 * dpr, 0, 7); ctx.fill();
    }
    scratches.forEach((s) => {
      s.life -= 1; if (s.life < 0) { s.x = Math.random(); s.life = 10 + Math.random() * 40; }
      ctx.strokeStyle = `rgba(250,244,230,${0.25 + Math.random() * 0.3})`; ctx.lineWidth = dpr;
      ctx.beginPath(); ctx.moveTo(s.x * w, 0); ctx.lineTo(s.x * w + (Math.random() - 0.5) * 6, h); ctx.stroke();
    });
    // vignette
    const v = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.3, cx, cy, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = v; ctx.fillRect(-20, -20, w + 40, h + 40);

    if (t >= COUNT && !finished && isReady) { finish(); return; }
    raf = requestAnimationFrame(draw);
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    if (withSound) pop(1000, 0.18);
    el.classList.add('is-done');
    setTimeout(() => { cancelAnimationFrame(raf); removeEventListener('resize', size); el.remove(); }, 1300);
    onDone && onDone();
  };

  const roll = () => { if (rolling) return; rolling = true; el.classList.add('is-rolling'); start = performance.now(); };
  btns.forEach((b) => b.addEventListener('click', () => {
    withSound = b.dataset.enter === 'sound';
    if (withSound) ambient();
    roll();
  }));
  raf = requestAnimationFrame(draw);
  // the leader holds on "3" until the visitor chooses; it rolls by itself after a moment
  setTimeout(roll, 4200);
  el.querySelector('[data-skip]')?.addEventListener('click', finish);
}
