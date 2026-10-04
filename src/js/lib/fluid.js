// OMIC Living Ink — a real-time fluid simulation (stable fluids on the GPU) rendered as
// watercolour on paper. Visitors paint with the cursor; a gentle "memory" force pulls the
// pigment back toward a target image (the OMIC logo, a latte heart…), so the artwork heals
// itself whenever people stop touching it.
//
// WebGL2 only. Call InkFluid.supported() first and fall back to something lighter otherwise.

const VERT = `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
uniform vec2 texelSize;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0); vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y); vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 fragColor;
`;

const FRAG = {
  clear: `${HEAD}uniform sampler2D uTexture; uniform float value;
    void main(){ fragColor = value * texture(uTexture, vUv); }`,

  splat: `${HEAD}uniform sampler2D uTarget; uniform float aspectRatio; uniform vec4 color; uniform vec2 point; uniform float radius;
    void main(){
      vec2 p = vUv - point; p.x *= aspectRatio;
      float s = exp(-dot(p, p) / radius);
      vec4 base = texture(uTarget, vUv);
      fragColor = base + color * s;
    }`,

  advection: `${HEAD}uniform sampler2D uVelocity; uniform sampler2D uSource; uniform sampler2D uMemory;
    uniform vec2 texelSize; uniform float dt; uniform float dissipation; uniform float restore; uniform float useMemory;
    void main(){
      vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;
      vec4 result = texture(uSource, coord) / (1.0 + dissipation * dt);
      if (useMemory > 0.5) {
        vec4 m = texture(uMemory, vUv);
        result = mix(result, m, clamp(restore * dt, 0.0, 1.0));
      }
      fragColor = result;
    }`,

  divergence: `${HEAD}uniform sampler2D uVelocity;
    void main(){
      float L = texture(uVelocity, vL).x; float R = texture(uVelocity, vR).x;
      float T = texture(uVelocity, vT).y; float B = texture(uVelocity, vB).y;
      vec2 C = texture(uVelocity, vUv).xy;
      if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x;
      if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
      fragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
    }`,

  curl: `${HEAD}uniform sampler2D uVelocity;
    void main(){
      float L = texture(uVelocity, vL).y; float R = texture(uVelocity, vR).y;
      float T = texture(uVelocity, vT).x; float B = texture(uVelocity, vB).x;
      fragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
    }`,

  vorticity: `${HEAD}uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;
    void main(){
      float L = texture(uCurl, vL).x; float R = texture(uCurl, vR).x;
      float T = texture(uCurl, vT).x; float B = texture(uCurl, vB).x; float C = texture(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= length(force) + 0.0001; force *= curl * C; force.y *= -1.0;
      vec2 v = texture(uVelocity, vUv).xy + force * dt;
      fragColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
    }`,

  pressure: `${HEAD}uniform sampler2D uPressure; uniform sampler2D uDivergence;
    void main(){
      float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x;
      float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;
      float div = texture(uDivergence, vUv).x;
      fragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
    }`,

  gradient: `${HEAD}uniform sampler2D uPressure; uniform sampler2D uVelocity;
    void main(){
      float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x;
      float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;
      vec2 v = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
      fragColor = vec4(v, 0.0, 1.0);
    }`,

  // watercolour on paper: edge darkening, pigment granulation, paper fibres, optional coffee cup
  display: `${HEAD}uniform sampler2D uDye; uniform vec2 dyeTexel; uniform vec3 paper; uniform float time;
    uniform float aspect; uniform float cup; uniform vec3 rim;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
    void main(){
      vec4 d = texture(uDye, vUv);
      float a = clamp(d.a, 0.0, 1.6);
      vec3 pig = d.rgb / max(d.a, 0.0001);
      float aL = texture(uDye, vUv - vec2(dyeTexel.x * 2.0, 0.0)).a, aR = texture(uDye, vUv + vec2(dyeTexel.x * 2.0, 0.0)).a;
      float aT = texture(uDye, vUv + vec2(0.0, dyeTexel.y * 2.0)).a, aB = texture(uDye, vUv - vec2(0.0, dyeTexel.y * 2.0)).a;
      float edge = clamp(length(vec2(aR - aL, aT - aB)) * 3.5, 0.0, 1.0);
      vec2 q = vUv * vec2(aspect, 1.0);
      float fib = fbm(q * vec2(220.0, 60.0)) * 0.6 + fbm(q * 90.0) * 0.4;
      float gran = noise(q * 520.0);
      vec3 base = paper * (0.955 + 0.06 * fib);
      float cov = smoothstep(0.015, 0.75, a * (0.86 + 0.28 * gran));
      vec3 ink = pig * (1.0 - 0.38 * edge) * (0.92 + 0.12 * fib);
      vec3 col = mix(base, ink, cov);
      col += (hash(vUv * 900.0 + time) - 0.5) * 0.025;
      float alpha = 1.0;
      if (cup > 0.5) {
        vec2 c = (vUv - 0.5) * vec2(aspect, 1.0);
        float r = length(c);
        float R = 0.46;
        float lip = smoothstep(R, R - 0.004, r);
        float ring = smoothstep(R + 0.035, R + 0.03, r) - smoothstep(R + 0.002, R, r);
        float shade = smoothstep(R * 0.55, R, r) * 0.35;
        col = col * (1.0 - shade);
        col = mix(col, rim * (0.85 + 0.25 * (1.0 - c.y * 2.0)), ring);
        alpha = max(lip, ring);
      }
      fragColor = vec4(col * alpha, alpha);
    }`,
};

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export class InkFluid {
  static supported() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2');
      return !!(gl && gl.getExtension('EXT_color_buffer_float'));
    } catch { return false; }
  }

  /**
   * @param {HTMLElement} host
   * @param {object} o
   *   palette: hex colours the cursor paints with (cycled)
   *   paper: hex background colour
   *   memory: (ctx, w, h) => void — draws the image the ink remembers (white = empty)
   *   restore: how fast the ink returns to memory (per second)
   *   cup: render inside a coffee cup
   */
  constructor(host, o = {}) {
    this.host = host;
    this.o = Object.assign({
      palette: ['#17140f', '#4a6fe8', '#dd7a3b', '#c6a8ea'], paper: '#f4ede1', rim: '#f4ede1',
      simRes: 128, dyeRes: 1024, curl: 22, pressureIters: 22, velDiss: 0.9, dyeDiss: 0.35,
      restore: 0.55, splatRadius: 0.0022, force: 5200, cup: false, memory: null, idle: true,
    }, o);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fluid-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(this.canvas);
    const gl = this.canvas.getContext('webgl2', { alpha: true, depth: false, stencil: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false });
    this.gl = gl;
    gl.getExtension('EXT_color_buffer_float');
    this.linear = !!gl.getExtension('OES_texture_float_linear');
    this.colorIndex = 0;
    this.pointers = new Map();
    this.splats = [];
    this.visible = true;
    this.paused = false;
    this.lastInteract = performance.now();
    this._build();
    this._bind();
    this.resize();
    this.raf = requestAnimationFrame((t) => this._loop(t));
  }

  /* ---------------------------------------------------------------- setup */
  _program(fragSrc) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fragSrc));
    gl.bindAttribLocation(p, 0, 'aPosition');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    return { p, u };
  }

  _build() {
    const gl = this.gl;
    this.prog = Object.fromEntries(Object.entries(FRAG).map(([k, src]) => [k, this._program(src)]));
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
  }

  _fbo(w, h, internal, format, type, filter) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      tex, fbo, w, h, tx: 1 / w, ty: 1 / h,
      attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; },
    };
  }

  _double(w, h, internal, format, type, filter) {
    let a = this._fbo(w, h, internal, format, type, filter), b = this._fbo(w, h, internal, format, type, filter);
    return { w, h, tx: 1 / w, ty: 1 / h, get read() { return a; }, get write() { return b; }, swap() { const t = a; a = b; b = t; } };
  }

  _res(r) {
    const ar = this.canvas.width / this.canvas.height;
    const min = Math.round(r), max = Math.round(r * (ar < 1 ? 1 / ar : ar));
    return ar > 1 ? { w: max, h: min } : { w: min, h: max };
  }

  _allocate() {
    const gl = this.gl;
    const HF = gl.HALF_FLOAT;
    const filt = this.linear ? gl.LINEAR : gl.NEAREST;
    const mobile = this.canvas.width < 900;
    const sim = this._res(this.o.simRes);
    const dye = this._res(mobile ? Math.min(this.o.dyeRes, 640) : this.o.dyeRes);
    this.dye = this._double(dye.w, dye.h, gl.RGBA16F, gl.RGBA, HF, filt);
    this.velocity = this._double(sim.w, sim.h, gl.RG16F, gl.RG, HF, filt);
    this.divergence = this._fbo(sim.w, sim.h, gl.R16F, gl.RED, HF, gl.NEAREST);
    this.curlT = this._fbo(sim.w, sim.h, gl.R16F, gl.RED, HF, gl.NEAREST);
    this.pressure = this._double(sim.w, sim.h, gl.R16F, gl.RED, HF, gl.NEAREST);
    this.memory = this._fbo(dye.w, dye.h, gl.RGBA16F, gl.RGBA, HF, filt);
    this._paintMemory(true);
  }

  /** Draw the remembered image on a 2D canvas, upload as premultiplied pigment */
  _paintMemory(seedDye) {
    const gl = this.gl;
    const { w, h } = this.dye;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    if (this.o.memory) this.o.memory(ctx, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    // pigment = rgb * alpha, density = alpha. Flip Y for GL.
    const data = new Float32Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = ((h - 1 - y) * w + x) * 4, di = (y * w + x) * 4;
        const al = px[si + 3] / 255;
        data[di] = (px[si] / 255) * al; data[di + 1] = (px[si + 1] / 255) * al; data[di + 2] = (px[si + 2] / 255) * al; data[di + 3] = al;
      }
    }
    const up = (fbo) => {
      gl.bindTexture(gl.TEXTURE_2D, fbo.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, data);
    };
    up(this.memory);
    if (seedDye) { up(this.dye.read); }
  }

  setMemory(fn) { this.o.memory = fn; this._paintMemory(false); }

  resize() {
    const r = this.host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, r.width < 720 ? 1.5 : 1.25);
    const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (w === this.canvas.width && h === this.canvas.height && this.dye) return;
    this.canvas.width = w; this.canvas.height = h;
    this.rect = r;
    this._allocate();
  }

  /* ---------------------------------------------------------------- input */
  _bind() {
    const local = (e) => {
      const r = this.host.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
    };
    this._move = (e) => {
      const p = local(e);
      const prev = this.pointers.get(e.pointerId);
      if (prev) {
        const dx = p.x - prev.x, dy = p.y - prev.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.0004) {
          const m = Math.hypot(dx, dy), k = m > 0.025 ? 0.025 / m : 1;
          this.splats.push({ x: p.x, y: p.y, dx: dx * k, dy: dy * k, color: prev.color, amt: (e.pointerType === 'touch' ? 0.8 : 0.55) * Math.min(1, m * 60 + 0.3), radius: 0.8 });
        }
      }
      this.pointers.set(e.pointerId, { x: p.x, y: p.y, color: prev ? prev.color : this._nextColor() });
      this.lastInteract = performance.now();
    };
    this._down = (e) => {
      const p = local(e);
      const color = this._nextColor();
      this.pointers.set(e.pointerId, { x: p.x, y: p.y, color });
      this.splats.push({ x: p.x, y: p.y, dx: (Math.random() - 0.5) * 0.02, dy: (Math.random() - 0.5) * 0.02, color, amt: 2.4, radius: 2.4 });
    };
    this._leave = (e) => { this.pointers.delete(e.pointerId); };
    this.host.addEventListener('pointermove', this._move, { passive: true });
    this.host.addEventListener('pointerdown', this._down, { passive: true });
    this.host.addEventListener('pointerleave', this._leave);
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.io = new IntersectionObserver(([en]) => { this.visible = en.isIntersecting; }, { rootMargin: '80px' });
    this.io.observe(this.host);
  }

  _nextColor() {
    const pal = this.o.palette;
    const c = hexToRgb(pal[this.colorIndex++ % pal.length]);
    return c;
  }

  /** Programmatic splash, x/y in 0..1 from the top-left */
  splash(x, y, dx = 0, dy = 0, hex, amt = 1.6, radius = 1.6) {
    this.splats.push({ x, y: 1 - y, dx, dy: -dy, color: hex ? hexToRgb(hex) : this._nextColor(), amt, radius });
  }

  /* ---------------------------------------------------------------- simulation */
  _blit(target) {
    const gl = this.gl;
    if (target) { gl.viewport(0, 0, target.w, target.h); gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); }
    else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  _use(name) { const pr = this.prog[name]; this.gl.useProgram(pr.p); return pr.u; }

  _splat(s) {
    const gl = this.gl;
    const ar = this.canvas.width / this.canvas.height;
    const rad = (this.o.splatRadius * (s.radius || 1)) * (ar > 1 ? ar : 1) * 0.6;
    let u = this._use('splat');
    gl.uniform2f(u.texelSize, this.velocity.tx, this.velocity.ty);
    gl.uniform1i(u.uTarget, this.velocity.read.attach(0));
    gl.uniform1f(u.aspectRatio, ar);
    gl.uniform2f(u.point, s.x, s.y);
    gl.uniform4f(u.color, s.dx * this.o.force, s.dy * this.o.force, 0, 0);
    gl.uniform1f(u.radius, rad);
    this._blit(this.velocity.write); this.velocity.swap();

    u = this._use('splat');
    gl.uniform2f(u.texelSize, this.dye.tx, this.dye.ty);
    gl.uniform1i(u.uTarget, this.dye.read.attach(0));
    gl.uniform1f(u.aspectRatio, ar);
    gl.uniform2f(u.point, s.x, s.y);
    const a = 0.55 * (s.amt || 1);
    gl.uniform4f(u.color, s.color[0] * a, s.color[1] * a, s.color[2] * a, a);
    gl.uniform1f(u.radius, rad * 0.9);
    this._blit(this.dye.write); this.dye.swap();
  }

  _step(dt) {
    const gl = this.gl;
    gl.disable(gl.BLEND);
    const v = this.velocity;
    let u = this._use('curl');
    gl.uniform2f(u.texelSize, v.tx, v.ty); gl.uniform1i(u.uVelocity, v.read.attach(0));
    this._blit(this.curlT);

    u = this._use('vorticity');
    gl.uniform2f(u.texelSize, v.tx, v.ty); gl.uniform1i(u.uVelocity, v.read.attach(0)); gl.uniform1i(u.uCurl, this.curlT.attach(1));
    gl.uniform1f(u.curl, this.o.curl); gl.uniform1f(u.dt, dt);
    this._blit(v.write); v.swap();

    u = this._use('divergence');
    gl.uniform2f(u.texelSize, v.tx, v.ty); gl.uniform1i(u.uVelocity, v.read.attach(0));
    this._blit(this.divergence);

    u = this._use('clear');
    gl.uniform1i(u.uTexture, this.pressure.read.attach(0)); gl.uniform1f(u.value, 0.8);
    this._blit(this.pressure.write); this.pressure.swap();

    u = this._use('pressure');
    gl.uniform2f(u.texelSize, v.tx, v.ty); gl.uniform1i(u.uDivergence, this.divergence.attach(0));
    for (let i = 0; i < this.o.pressureIters; i++) {
      gl.uniform1i(u.uPressure, this.pressure.read.attach(1));
      this._blit(this.pressure.write); this.pressure.swap();
    }

    u = this._use('gradient');
    gl.uniform2f(u.texelSize, v.tx, v.ty); gl.uniform1i(u.uPressure, this.pressure.read.attach(0)); gl.uniform1i(u.uVelocity, v.read.attach(1));
    this._blit(v.write); v.swap();

    u = this._use('advection');
    gl.uniform2f(u.texelSize, v.tx, v.ty);
    const vid = v.read.attach(0);
    gl.uniform1i(u.uVelocity, vid); gl.uniform1i(u.uSource, vid); gl.uniform1i(u.uMemory, vid);
    gl.uniform1f(u.dt, dt); gl.uniform1f(u.dissipation, this.o.velDiss); gl.uniform1f(u.useMemory, 0);
    this._blit(v.write); v.swap();

    gl.uniform1i(u.uVelocity, v.read.attach(0)); gl.uniform1i(u.uSource, this.dye.read.attach(1)); gl.uniform1i(u.uMemory, this.memory.attach(2));
    gl.uniform1f(u.dissipation, this.o.dyeDiss); gl.uniform1f(u.restore, this.o.restore); gl.uniform1f(u.useMemory, this.o.memory ? 1 : 0);
    this._blit(this.dye.write); this.dye.swap();
  }

  _render() {
    const gl = this.gl;
    const u = this._use('display');
    gl.uniform2f(u.texelSize, 1 / this.canvas.width, 1 / this.canvas.height);
    gl.uniform2f(u.dyeTexel, this.dye.tx, this.dye.ty);
    gl.uniform1i(u.uDye, this.dye.read.attach(0));
    gl.uniform3fv(u.paper, hexToRgb(this.o.paper));
    gl.uniform3fv(u.rim, hexToRgb(this.o.rim));
    gl.uniform1f(u.time, (performance.now() / 1000) % 100);
    gl.uniform1f(u.aspect, this.canvas.width / this.canvas.height);
    gl.uniform1f(u.cup, this.o.cup ? 1 : 0);
    gl.clearColor(0, 0, 0, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clear(gl.COLOR_BUFFER_BIT);
    this._blit(null);
  }

  _idle(now) {
    // when nobody is painting, the ink keeps breathing: soft currents drift past the memory
    if (!this.o.idle || now - this.lastInteract < 2600) return;
    if (!this._nextIdle || now > this._nextIdle) {
      this._nextIdle = now + 1600 + Math.random() * 1800;
      const ang = Math.random() * Math.PI * 2;
      const x = 0.25 + Math.random() * 0.5, y = 0.3 + Math.random() * 0.4;
      this.splats.push({ x, y, dx: Math.cos(ang) * 0.006, dy: Math.sin(ang) * 0.006, color: this._nextColor(), amt: 0.35, radius: 1.4 });
    }
  }

  _loop(now) {
    this.raf = requestAnimationFrame((t) => this._loop(t));
    if (!this.visible || document.hidden || this.paused) { this.last = now; return; }
    const dt = Math.min(0.033, (now - (this.last || now)) / 1000) || 0.016;
    this.last = now;
    this._idle(now);
    while (this.splats.length) this._splat(this.splats.shift());
    this._step(dt);
    this._render();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._onResize);
    this.io.disconnect();
    this.host.removeEventListener('pointermove', this._move);
    this.host.removeEventListener('pointerdown', this._down);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.remove();
  }
}
