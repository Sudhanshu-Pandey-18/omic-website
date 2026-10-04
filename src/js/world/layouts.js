// Layouts tell the four O·M·I·C drops where to be while a section is on screen.
// Each returns (rect, t, world) => { mode, drops: [{x, y, r, color, letter, stiff}] } in css px.
import { COLORS } from './world.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);
const FOUR = [COLORS.ink, COLORS.ink, COLORS.ink, COLORS.blue];

/** hero: the drops lift off the painted logo as you start to scroll */
export function heroLift(host, onProgress) {
  return (rect, t, world) => {
    const p = clamp(-rect.top / (rect.height * 0.75));
    onProgress && onProgress(p);
    const W = rect.width, H = rect.height;
    const mobile = W < H;
    const R = mobile ? W * 0.105 : Math.min(W, H) * 0.13;
    const gap = R * 1.9, cx = rect.left + W / 2;
    const cyPaper = rect.top + H * (mobile ? 0.34 : 0.36);   // where the painted logo is now
    const cyFloat = world.h * 0.38;                              // where the lifted drops float
    const e = ease(clamp(p * 1.6));
    const grow = ease(clamp(p * 6));
    return {
      mode: 'spring',
      drops: FOUR.map((c, i) => ({
        x: cx - gap * 1.5 * (1 - e * 0.25) + i * gap * (1 - e * 0.25) + Math.sin(world.time * 0.8 + i) * 6 * e,
        y: cyPaper + (cyFloat - cyPaper) * e + Math.cos(world.time + i * 1.7) * 8 * e,
        r: R * grow * (1 - 0.3 * e), color: c, letter: 1, stiff: 0.32 - e * 0.2,
      })),
    };
  };
}

/** manifesto: each drop perches on one of the key words (and follows them while they fly in) */
export function perch(spans) {
  const colors = [COLORS.blue, COLORS.ink, COLORS.orange, COLORS.lavender];
  return () => ({
    mode: 'spring',
    drops: spans.slice(0, 4).map((s, i) => {
      const b = s.getBoundingClientRect();
      const size = Math.max(16, Math.min(34, b.height * 0.32));
      return { x: b.right + size * 0.5, y: b.top + size * 0.3, r: size, color: colors[i], letter: 1, stiff: 0.12 };
    }),
  });
}

/** the drops dive into the distance (used before 3D/dark sections) */
export function dive() {
  return (rect, t, world) => ({
    mode: 'spring',
    drops: [0, 1, 2, 3].map((i) => ({ x: world.w / 2 + (i - 1.5) * 10, y: world.h * 0.52, r: 0, color: COLORS.cream, letter: 0, stiff: 0.05 })),
  });
}

/** the drops hover over a cup, then dive in one by one; each landing fires onPour(i) */
export function pour(cupEl, onPour) {
  const poured = [false, false, false, false];
  const colors = [COLORS.ink, COLORS.orange, COLORS.cream, COLORS.blue];
  return (rect, t, world) => {
    const c = cupEl.getBoundingClientRect();
    const cx = c.left + c.width / 2, cy = c.top + c.height / 2;
    if (t < 0.12) poured.fill(false);
    return {
      mode: 'spring',
      drops: [0, 1, 2, 3].map((i) => {
        const diving = t > 0.18 + i * 0.07;
        if (diving && !poured[i] && world.drops[i].r < 4 && Math.hypot(world.drops[i].x - cx, world.drops[i].y - cy) < c.width * 0.2) { poured[i] = true; onPour && onPour(i, colors[i]); }
        if (diving) return { x: cx, y: cy, r: 0, color: colors[i], letter: 0, stiff: 0.09 };
        const a = Math.PI * (1.15 + i * 0.23);
        return { x: cx + Math.cos(a) * c.width * 0.62, y: cy + Math.sin(a) * c.height * 0.62 - 10, r: 22, color: colors[i], letter: 1, stiff: 0.1 };
      }),
    };
  };
}

/** drops fall onto a floor inside an element and can be pushed around */
export function pile(areaEl, { from = 0.55, to = 0.98, colors = [COLORS.blue, COLORS.orange, COLORS.lavender, COLORS.green], size = 34 } = {}) {
  return () => {
    const a = areaEl.getBoundingClientRect();
    const left = a.left + a.width * from, right = a.left + a.width * to;
    return {
      mode: 'gravity', floor: a.bottom - 18, left, right,
      drops: colors.map((c, i) => ({ x: left + (right - left) * (0.15 + i * 0.22), spawnY: a.top - 60 - i * 90, r: size * (innerWidth < 720 ? 0.7 : 1), color: c, letter: 1 })),
    };
  };
}

/** drops orbit an element */
export function orbit(el, { size = 16, colors = [COLORS.ink, COLORS.blue, COLORS.orange, COLORS.lavender], speed = 0.35, scale = 0.6 } = {}) {
  return (rect, t, world) => {
    const b = el.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2, R = Math.max(b.width, b.height) * scale;
    return {
      mode: 'spring',
      drops: colors.map((c, i) => {
        const a = world.time * speed + i * Math.PI / 2;
        return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R * 0.9, r: size, color: c, letter: 1, stiff: 0.06 };
      }),
    };
  };
}
