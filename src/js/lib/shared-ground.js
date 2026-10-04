// "Shared Ground" — a generative painting for the OMIC Art Prize. Hundreds of brush strokes
// arrive from every edge (many people, many places) and settle into one common horizon.
// Scroll paints it; it is never the same twice.

function mulberry(a) { return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const PALETTE = ['#17140f', '#4a6fe8', '#dd7a3b', '#c6a8ea', '#3f8f5f', '#c9a77c', '#a8432b', '#f4ede1'];

export class SharedGround {
  constructor(host, { strokes = 420, seed = Math.floor(Math.random() * 1e6) } = {}) {
    this.host = host;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ground-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'A generative painting: hundreds of coloured brush strokes arriving from every direction and settling into one shared horizon.');
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.N = innerWidth < 720 ? Math.round(strokes * 0.55) : strokes;
    this.seed = seed;
    this.drawn = 0;
    this.target = 0;
    this.resize();
    this._r = () => this.resize();
    addEventListener('resize', this._r);
  }

  destroy() { removeEventListener('resize', this._r); this.canvas.remove(); }

  resize() {
    const r = this.host.getBoundingClientRect();
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = r.width; this.h = r.height;
    this.canvas.width = r.width * this.dpr; this.canvas.height = r.height * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._plan();
    this.drawn = 0;
    this.ctx.clearRect(0, 0, this.w, this.h);
    this._paintTo(this.target);
  }

  _plan() {
    // strata: every stroke crosses the whole canvas and settles into a layer of the ground
    const rnd = mulberry(this.seed);
    const { w, h } = this;
    this.strokes = Array.from({ length: this.N }, (_, i) => {
      const depth = Math.pow(rnd(), 0.7);                 // more strokes towards the bottom
      const base = h * (0.42 + depth * 0.6);
      const amp = h * (0.01 + rnd() * 0.05) * (1 - depth * 0.5);
      const f1 = (1 + rnd() * 2.5) * Math.PI * 2 / w, f2 = (3 + rnd() * 5) * Math.PI * 2 / w;
      const p1 = rnd() * 6.28, p2 = rnd() * 6.28;
      const fromLeft = rnd() < 0.5;
      const x0 = fromLeft ? -40 - rnd() * w * 0.3 : w * (0.1 + rnd() * 0.5);
      const len = w * (0.5 + rnd() * 0.9);
      const pts = [];
      const steps = 90;
      for (let s = 0; s <= steps; s++) {
        const x = fromLeft ? x0 + (s / steps) * len : x0 + (s / steps) * len;
        const y = base + Math.sin(x * f1 + p1) * amp + Math.sin(x * f2 + p2) * amp * 0.25;
        pts.push([x, y]);
      }
      const color = PALETTE[Math.floor(rnd() * PALETTE.length)];
      return { pts, color, width: 6 + rnd() * (i % 6 === 0 ? 46 : 18) * (0.6 + depth), alpha: 0.16 + rnd() * 0.34, bristles: 5 + Math.floor(rnd() * 5), jit: rnd() * 1000 };
    });
  }

  _stroke(s) {
    const ctx = this.ctx;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let b = 0; b < s.bristles; b++) {
      const off = ((b + 0.5) / s.bristles - 0.5) * s.width;
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = s.alpha * (0.5 + 0.5 * Math.sin(s.jit + b));
      ctx.lineWidth = Math.max(0.6, s.width * (0.35 + 0.2 * Math.cos(b + s.jit)));
      ctx.beginPath();
      s.pts.forEach(([x, y], k) => {
        const taper = Math.sin((k / s.pts.length) * Math.PI);
        const px = x, py = y + off * (0.35 + 0.65 * taper);
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _paintTo(p) {
    const n = Math.floor(this.N * p);
    while (this.drawn < n) this._stroke(this.strokes[this.drawn++]);
  }

  /** 0..1 — how much of the painting exists */
  setProgress(p) {
    this.target = Math.max(this.target, p);
    this._paintTo(this.target);
  }

  repaint() {
    this.seed = Math.floor(Math.random() * 1e6);
    this._plan(); this.drawn = 0; this.ctx.clearRect(0, 0, this.w, this.h);
    let k = 0;
    const tick = () => { k += 0.02; this._paintTo(Math.min(this.target, k)); if (k < this.target) requestAnimationFrame(tick); };
    tick();
  }
}
