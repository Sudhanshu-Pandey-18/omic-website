// Ink-bleed curtain: a blot of ink with a ragged, living edge spreads from the click point,
// covers the screen, and later drains away. Used by the router between pages.

function noise1(a, s) {
  return Math.sin(a * 3 + s) * 0.5 + Math.sin(a * 7 - s * 1.7) * 0.28 + Math.sin(a * 13 + s * 2.3) * 0.14 + Math.sin(a * 29 - s * 3.1) * 0.08;
}

let cv, ctx, W, H, dpr;
function ensure() {
  if (cv) return;
  cv = document.createElement('canvas');
  cv.className = 'bleed';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  ctx = cv.getContext('2d');
  const size = () => { dpr = Math.min(devicePixelRatio || 1, 1.5); W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr; };
  size(); addEventListener('resize', size);
}

const color = () => getComputedStyle(document.body).getPropertyValue('--bleed').trim() || '#17140f';
const maxR = () => Math.hypot(W, H);

function blot(x, y, r, seed, fill) {
  ctx.clearRect(0, 0, W, H);
  if (r <= 0) return;
  ctx.fillStyle = fill;
  const path = (ox, oy, rr, sd, wob) => {
    ctx.beginPath();
    for (let i = 0; i <= 140; i++) {
      const a = (i / 140) * Math.PI * 2, k = rr * (1 + wob * noise1(a, sd));
      const px = ox + Math.cos(a) * k, py = oy + Math.sin(a) * k;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  };
  path(x, y, r, seed, 0.16);
  for (let i = 0; i < 8; i++) {
    const a = seed * 3 + i * 0.85;
    path(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1, r * (0.05 + (i % 3) * 0.03), seed + i, 0.3);
  }
}

function animate(from, to, dur, x, y, fill) {
  return new Promise((resolve) => {
    const t0 = performance.now(), seed = Math.random() * 10;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = from < to ? p * p * (3 - 2 * p) : 1 - Math.pow(1 - p, 3);
      blot(x, y, from + (to - from) * e, seed + p * 1.5, fill);
      if (p < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

let last = { x: 0.5, y: 0.5, fill: '#17140f' };

/** cover the screen with ink spreading from (clientX, clientY) */
export async function cover(cx, cy) {
  ensure();
  cv.classList.add('is-on');
  last = { x: (cx ?? innerWidth / 2) * dpr, y: (cy ?? innerHeight / 2) * dpr, fill: color() };
  await animate(0, maxR(), 720, last.x, last.y, last.fill);
}

/** drain the ink away */
export async function reveal() {
  ensure();
  await animate(maxR(), 0, 900, W - last.x, H - last.y, last.fill);
  cv.classList.remove('is-on');
}
