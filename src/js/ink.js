// OMIC "Ink" engine — liquid, glossy ink spheres rendered in a single WebGL shader.
// The four circles of the OMIC logo become physical objects: they merge like
// metaballs, react to the cursor, burst on click and pour into each other on scroll.
// Zero dependencies. Falls back to Canvas 2D when WebGL is unavailable.

const MAX = 12;
const PALETTE = [
  [0.090, 0.078, 0.059], // 0 ink   #17140F
  [0.290, 0.435, 0.910], // 1 blue  #4A6FE8
  [0.867, 0.478, 0.231], // 2 orange #DD7A3B
  [0.776, 0.659, 0.918], // 3 lavender #C6A8EA
];

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform vec4  uBalls[${MAX}];   // x, y, r, colorIndex (device px, y down)
uniform int   uCount;
uniform float uK;              // smooth-union radius (px)
uniform float uTime;
uniform vec3  uPal[4];
uniform vec3  uEnvA;           // reflection tint (cool)
uniform vec3  uEnvB;           // reflection tint (warm)
uniform float uShadow;

float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

// signed distance to the blended blob + weighted radius + weighted colour
float field(vec2 p, out float R, out vec3 col){
  float d = 1e5; float ws = 0.0; float rs = 0.0; vec3 cs = vec3(0.0);
  for(int i = 0; i < ${MAX}; i++){
    if(i >= uCount) break;
    vec4 b = uBalls[i];
    float di = length(p - b.xy) - b.z;
    d = smin(d, di, uK);
    float w = exp(-max(di, -b.z) * 3.0 / b.z);
    ws += w; rs += w * b.z;
    int ci = int(b.w + 0.5);
    vec3 c = uPal[0];
    if(ci == 1) c = uPal[1]; else if(ci == 2) c = uPal[2]; else if(ci == 3) c = uPal[3];
    cs += w * c;
  }
  R = rs / max(ws, 1e-4);
  col = cs / max(ws, 1e-4);
  return d;
}

float heightAt(vec2 p){
  float R; vec3 c;
  float d = field(p, R, c);
  float t = clamp(-d, 0.0, R);
  return sqrt(max(t * (2.0*R - t), 0.0));
}

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float R; vec3 base;
  float d = field(p, R, base);

  // soft contact shadow, cast down-right
  float Rs; vec3 cs;
  float ds = field(p - vec2(R*0.18, R*0.42), Rs, cs);
  float sh = (1.0 - smoothstep(-Rs*0.35, Rs*0.75, ds)) * uShadow;

  if(d > 2.0){
    // premultiplied: shadow is a dark warm tone
    gl_FragColor = vec4(vec3(0.16, 0.12, 0.08) * sh, sh);
    return;
  }

  float e = 1.5;
  float hx = heightAt(p + vec2(e, 0.0)) - heightAt(p - vec2(e, 0.0));
  float hy = heightAt(p + vec2(0.0, e)) - heightAt(p - vec2(0.0, e));
  vec3 n = normalize(vec3(-hx / (2.0*e), -hy / (2.0*e), 1.0));

  vec3 L  = normalize(vec3(-0.55, -0.75, 0.85));
  vec3 L2 = normalize(vec3(0.8, 0.35, 0.5));
  vec3 V  = vec3(0.0, 0.0, 1.0);
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(n, normalize(L + V)), 0.0), 90.0);
  float spec2 = pow(max(dot(n, normalize(L2 + V)), 0.0), 24.0);
  float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.2);

  vec3 r = reflect(-V, n);
  float band = smoothstep(-0.7, 0.7, r.x + 0.25*sin(uTime*0.4 + r.y*3.0));
  vec3 env = mix(uEnvB, uEnvA, band);

  vec3 col = base * (0.42 + 0.58*diff);
  col += env * fres * 0.75;
  col += vec3(1.0, 0.97, 0.92) * spec * 1.1;
  col += mix(uEnvB, vec3(1.0), 0.4) * spec2 * 0.22;
  col += (hash(p + uTime) - 0.5) * 0.035; // film grain

  float a = smoothstep(1.5, -1.0, d);
  float outA = a + sh * (1.0 - a);
  vec3 outC = col * a + vec3(0.16, 0.12, 0.08) * sh * (1.0 - a);
  gl_FragColor = vec4(outC, outA);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(log);
  }
  return s;
}

const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class InkField {
  /**
   * @param {HTMLElement} host  positioned element the canvas fills
   * @param {object} o
   *   balls: [{ letter?, color?: 0..3, r: relative radius (fraction of min(w,h)) }]
   *   layout: 'logo' | 'pile'
   *   cursorBall: adds a small ink drop that follows the pointer and merges into the balls
   *   gravity: balls fall and pile up (used for the footer finale)
   */
  constructor(host, o = {}) {
    this.host = host;
    this.o = Object.assign({ layout: 'logo', cursorBall: true, gravity: false, shadow: 0.22, k: 0.55 }, o);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ink-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(this.canvas);
    this.letterLayer = document.createElement('div');
    this.letterLayer.className = 'ink-letters';
    this.letterLayer.setAttribute('aria-hidden', 'true');
    host.appendChild(this.letterLayer);

    this.progress = 0;          // 0..1 scroll morph (pour together)
    this.pointer = { x: -9999, y: -9999, vx: 0, vy: 0, active: false };
    this.time = 0;
    this.visible = true;
    this.reduced = prefersReduced();

    this.balls = (o.balls || []).map((b, i) => ({
      i, letter: b.letter || '', color: b.color || 0, rel: b.r || 0.1,
      x: 0, y: 0, vx: 0, vy: 0, r: 0, tx: 0, ty: 0, seed: Math.random() * 100,
    }));
    this.balls.forEach((b) => {
      if (!b.letter) return;
      const el = document.createElement('span');
      el.className = 'ink-letter';
      el.textContent = b.letter;
      this.letterLayer.appendChild(el);
      b.el = el;
    });
    if (this.o.cursorBall) {
      this.drop = { x: -9999, y: -9999, r: 0, tr: 0 };
    }

    this._initGL();
    this._resize = this._resize.bind(this);
    this._tick = this._tick.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onLeave = () => { this.pointer.active = false; };
    this._onDown = (e) => { const p = this._local(e); this.burst(p.x, p.y); };

    window.addEventListener('resize', this._resize);
    host.addEventListener('pointermove', this._onMove);
    host.addEventListener('pointerleave', this._onLeave);
    host.addEventListener('pointerdown', this._onDown);
    this.io = new IntersectionObserver(([en]) => { this.visible = en.isIntersecting; if (this.visible) this._kick(); }, { rootMargin: '100px' });
    this.io.observe(host);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this._kick(); });

    this._resize(true);
    this._kick();
  }

  _initGL() {
    const gl = this.canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
    if (!gl) { this.ctx2d = this.canvas.getContext('2d'); return; }
    try {
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = {};
      ['uRes', 'uBalls', 'uCount', 'uK', 'uTime', 'uPal', 'uEnvA', 'uEnvB', 'uShadow'].forEach((n) => {
        this.u[n] = gl.getUniformLocation(prog, n);
      });
      gl.uniform3fv(this.u.uPal, new Float32Array(PALETTE.flat()));
      gl.uniform3f(this.u.uEnvA, 0.36, 0.52, 1.0);   // blue light
      gl.uniform3f(this.u.uEnvB, 1.0, 0.62, 0.36);   // warm orange light
      gl.uniform1f(this.u.uShadow, this.o.shadow);
      this.gl = gl;
      this.ballData = new Float32Array(MAX * 4);
    } catch (err) {
      console.warn('[OMIC ink] WebGL failed, using 2D fallback', err);
      this.gl = null;
      this.canvas.remove();
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'ink-canvas';
      this.host.prepend(this.canvas);
      this.ctx2d = this.canvas.getContext('2d');
    }
  }

  _local(e) {
    const r = this.host.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _onMove(e) {
    const p = this._local(e);
    const pt = this.pointer;
    pt.vx = p.x - (pt.active ? pt.x : p.x);
    pt.vy = p.y - (pt.active ? pt.y : p.y);
    pt.x = p.x; pt.y = p.y; pt.active = true;
    this._kick();
  }

  _layout() {
    const { w, h } = this;
    const m = Math.min(w, h);
    const mobile = w < 720;
    this.balls.forEach((b) => { b.r = b.rel * (mobile ? Math.max(w * 0.95, m) : m); });
    if (this.o.layout === 'logo') {
      const n = this.balls.length;
      const r = this.balls[0].r;
      const gap = r * 1.86;
      const total = gap * (n - 1);
      const cx = this.o.centerX != null ? this.o.centerX * w : w / 2;
      const cy = this.o.centerY != null ? this.o.centerY * h : h * 0.44;
      this.balls.forEach((b, i) => { b.hx = cx - total / 2 + i * gap; b.hy = cy; });
    } else {
      this.balls.forEach((b, i) => { b.hx = w * (0.2 + 0.6 * ((i * 0.618) % 1)); b.hy = h - b.r; });
    }
  }

  _resize(first) {
    const r = this.host.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    const maxDpr = this.w < 720 ? 1.25 : 1.5;
    this.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this._layout();
    if (first === true) {
      this.balls.forEach((b, i) => {
        if (this.o.gravity) { b.x = b.hx; b.y = -b.r * (2 + i * 1.4); }
        else if (this.reduced) { b.x = b.hx; b.y = b.hy; }
        else { // enter from below, staggered — like drops rising into place
          b.x = b.hx + (Math.random() - 0.5) * b.r; b.y = this.h + b.r * (1.5 + i * 0.9);
        }
      });
    }
    if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this._kick();
  }

  /** 0 = logo row; 1 = poured together into one drop */
  setProgress(p) { this.progress = Math.max(0, Math.min(1, p)); this._kick(); }

  burst(x, y, power = 1) {
    this.balls.forEach((b) => {
      const dx = b.x - x, dy = b.y - y;
      const d = Math.hypot(dx, dy) || 1;
      const f = (900 / (d + 120)) * power * (this.o.gravity ? 1.6 : 1);
      b.vx += (dx / d) * f; b.vy += (dy / d) * f - (this.o.gravity ? 8 * power : 0);
    });
    this._kick();
  }

  redrop() { // re-drop for gravity mode
    this.balls.forEach((b, i) => { b.y = -b.r * (2 + i * 1.3); b.x = b.hx; b.vy = 0; b.vx = (Math.random() - 0.5) * 6; });
    this._kick();
  }

  _kick() { if (!this.raf) this.raf = requestAnimationFrame(this._tick); }

  _step(dt) {
    const { w, h, balls, pointer: pt } = this;
    const p = this.progress;
    const t = this.time;
    const cx = w / 2, cy = h * 0.5;
    let energy = 0;

    for (const b of balls) {
      if (this.o.gravity) {
        b.vy += 0.9 * dt;
        b.vx += (b.hx - b.x) * 0.0006 * dt;
      } else {
        // target: home position (floating) blended toward a single central drop
        const fx = Math.sin(t * 0.0009 + b.seed) * b.r * 0.06;
        const fy = Math.cos(t * 0.0011 + b.seed * 1.3) * b.r * 0.08;
        b.tx = b.hx + fx + (cx - b.hx) * p;
        b.ty = b.hy + fy + (cy + h * 0.12 - b.hy) * p;
        b.vx += (b.tx - b.x) * 0.012 * dt;
        b.vy += (b.ty - b.y) * 0.012 * dt;
      }
      // cursor push
      if (pt.active) {
        const dx = b.x - pt.x, dy = b.y - pt.y;
        const d = Math.hypot(dx, dy);
        const reach = b.r * 1.35 + 40;
        if (d < reach && d > 0.01) {
          const f = (1 - d / reach) * 2.4 * dt;
          b.vx += (dx / d) * f + pt.vx * 0.04 * dt;
          b.vy += (dy / d) * f + pt.vy * 0.04 * dt;
        }
      }
    }
    // ball–ball soft collisions (they may overlap a little: that is where they melt together)
    const overlap = this.o.gravity ? 0.92 : 0.86 - p * 0.6;
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], c = balls[j];
        const dx = c.x - a.x, dy = c.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = (a.r + c.r) * overlap;
        if (d < min) {
          const push = (min - d) * 0.5;
          const nx = dx / d, ny = dy / d;
          a.x -= nx * push * 0.5; a.y -= ny * push * 0.5;
          c.x += nx * push * 0.5; c.y += ny * push * 0.5;
          const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (rv < 0) {
            const j2 = -rv * 0.6;
            a.vx -= nx * j2 * 0.5; a.vy -= ny * j2 * 0.5;
            c.vx += nx * j2 * 0.5; c.vy += ny * j2 * 0.5;
          }
        }
      }
    }
    const damp = this.o.gravity ? 0.985 : 0.86;
    for (const b of balls) {
      b.vx *= Math.pow(damp, dt); b.vy *= Math.pow(damp, dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (this.o.gravity) {
        if (b.y > h - b.r) { b.y = h - b.r; b.vy *= -0.45; b.vx *= 0.92; }
        if (b.x < b.r) { b.x = b.r; b.vx *= -0.5; }
        if (b.x > w - b.r) { b.x = w - b.r; b.vx *= -0.5; }
      }
      energy += Math.abs(b.vx) + Math.abs(b.vy);
    }
    pt.vx *= 0.8; pt.vy *= 0.8;

    if (this.drop) {
      const dr = this.drop;
      dr.tr = pt.active ? Math.max(14, Math.min(w, h) * 0.022) : 0;
      dr.r += (dr.tr - dr.r) * 0.18 * dt;
      if (pt.active) {
        if (dr.x < -9000) { dr.x = pt.x; dr.y = pt.y; }
        dr.x += (pt.x - dr.x) * 0.22 * dt; dr.y += (pt.y - dr.y) * 0.22 * dt;
      }
      energy += Math.abs(dr.tr - dr.r);
    }
    return energy;
  }

  _render() {
    const { balls, dpr } = this;
    if (this.gl) {
      const gl = this.gl;
      let n = 0;
      const data = this.ballData;
      for (const b of balls) {
        data.set([b.x * dpr, b.y * dpr, b.r * dpr * (1 - this.progress * 0.25), b.color], n * 4); n++;
      }
      if (this.drop && this.drop.r > 0.5) { data.set([this.drop.x * dpr, this.drop.y * dpr, this.drop.r * dpr, 0], n * 4); n++; }
      gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
      gl.uniform4fv(this.u.uBalls, data);
      gl.uniform1i(this.u.uCount, n);
      const avgR = balls.reduce((s, b) => s + b.r, 0) / Math.max(1, balls.length);
      gl.uniform1f(this.u.uK, avgR * dpr * (this.o.k + this.progress * 0.5));
      gl.uniform1f(this.u.uTime, this.time / 1000);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else if (this.ctx2d) {
      const c = this.ctx2d;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, this.w, this.h);
      for (const b of balls) {
        const g = c.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.05, b.x, b.y, b.r);
        const col = ['#3a342b', '#7d95f0', '#eb9a66', '#d9c3f2'][b.color];
        g.addColorStop(0, col); g.addColorStop(1, ['#17140f', '#2f4fc4', '#b85e24', '#9d7bc9'][b.color]);
        c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
      }
    }
    // letters ride on their balls
    for (const b of balls) {
      if (!b.el) continue;
      const s = b.r * 0.9 * (1 - this.progress * 0.25);
      b.el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0) translate(-50%, -52%)`;
      b.el.style.fontSize = `${s}px`;
      b.el.style.opacity = String(1 - this.progress * 1.4);
    }
  }

  _tick(now) {
    this.raf = 0;
    if (!this.visible || document.hidden) return;
    const last = this.last || now;
    const dt = Math.min(2.5, (now - last) / 16.667);
    this.last = now;
    this.time += now - last;
    const energy = this.reduced ? 0 : this._step(dt || 1);
    if (this.reduced) this.balls.forEach((b) => { b.x = b.hx + (this.w / 2 - b.hx) * this.progress; b.y = b.hy; });
    this._render();
    // keep animating while anything moves (or gently float forever in logo mode)
    if (!this.reduced && (energy > 0.02 || this.o.layout === 'logo')) this._kick();
    else this.last = 0;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._resize);
    this.io.disconnect();
    this.canvas.remove(); this.letterLayer.remove();
  }
}
