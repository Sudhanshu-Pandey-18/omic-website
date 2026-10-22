// OMIC World — one persistent WebGL layer that lives above the page for the whole visit.
// It carries two things:
//   1. The four O·M·I·C drops: glossy, wobbling ink drops with real (simple) physics. Every
//      section gives them a "layout" — they lift off the hero's painted logo, perch on the
//      manifesto's key words, dive into the latte, settle on the Shared Ground horizon,
//      orbit the founder, and finally pile up in the footer where you can throw them.
//   2. Living images: every [data-brush] image is redrawn as a WebGL plane that dissolves in
//      like ink, ripples and splits colour under the cursor, and bends with scroll speed.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const LETTERS = ['O', 'M', 'I', 'C'];
export const COLORS = { ink: '#17140f', blue: '#4a6fe8', orange: '#dd7a3b', lavender: '#c6a8ea', green: '#3f8f5f', cream: '#f4ede1', rust: '#a8432b' };

/* ------------------------------------------------------------------ drop material: glossy + liquid wobble */
function dropMaterial(color) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1, specularIntensity: 0.6 });
  m.userData.uniforms = { uTime: { value: 0 }, uWobble: { value: 0.04 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWobble;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float w = sin(position.x * 3.1 + uTime * 2.3) * sin(position.y * 2.7 + uTime * 1.7) * sin(position.z * 2.9 + uTime * 2.0);
        transformed += normal * w * uWobble;`);
  };
  return m;
}

function letterTexture(L, dark) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = dark ? '#f4ede1' : '#17140f';
  x.font = '400 150px Oswald, "Arial Narrow", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(L, 128, 138);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const isDark = (hex) => { const c = new THREE.Color(hex); return c.r * 0.3 + c.g * 0.59 + c.b * 0.11 < 0.45; };

/* ------------------------------------------------------------------ living image shader */
const MEDIA_VERT = `
uniform float uVel; uniform vec2 uSize;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec3 p = position;
  p.y += sin(uv.x * 3.14159) * uVel * 0.08 * uSize.y / max(uSize.y, 1.0);
  p.x += sin(uv.y * 3.14159) * uVel * 0.02;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const MEDIA_FRAG = `
uniform sampler2D uTex; uniform vec2 uSize; uniform vec2 uImg; uniform float uRadius; uniform float uReveal;
uniform float uHover; uniform vec2 uMouse; uniform float uTime; uniform float uVel; uniform vec3 uInk; uniform float uGray;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=0.5; } return v; }
vec2 cover(vec2 uv){ float ra = uSize.x/uSize.y, ri = uImg.x/uImg.y; vec2 s = ra > ri ? vec2(1.0, ri/ra) : vec2(ra/ri, 1.0); return (uv - 0.5) * s + 0.5; }
float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main(){
  vec2 px = (vUv - 0.5) * uSize;
  float d = rbox(px, uSize * 0.5, uRadius);
  if (d > 0.5) discard;
  // ink-dissolve reveal
  float n = fbm(vUv * vec2(uSize.x/uSize.y, 1.0) * 4.0 + uTime * 0.05);
  float edge = uReveal * 1.25 - 0.12;
  float m = smoothstep(edge, edge - 0.08, n);
  if (m < 0.01) discard;
  float rim = smoothstep(edge - 0.08, edge - 0.02, n) * step(uReveal, 0.999);
  // hover ripple + chromatic split
  vec2 uv = vUv;
  vec2 dm = (uv - uMouse) * vec2(uSize.x/uSize.y, 1.0);
  float dist = length(dm);
  float ripple = sin(dist * 38.0 - uTime * 6.0) * exp(-dist * 6.0) * 0.012 * uHover;
  uv += normalize(dm + 1e-5) * ripple;
  uv = (uv - 0.5) * (1.0 - 0.06 * uHover) + 0.5;
  float split = (0.004 + abs(uVel) * 0.003) * (0.4 + uHover);
  vec2 cuv = cover(uv);
  vec3 col;
  col.r = texture2D(uTex, cover(uv + vec2(split, 0.0))).r;
  col.g = texture2D(uTex, cuv).g;
  col.b = texture2D(uTex, cover(uv - vec2(split, 0.0))).b;
  float g = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(g), uGray * (1.0 - uHover));
  col = mix(col, uInk, rim * 0.85);
  float aa = smoothstep(0.5, -0.5, d);
  gl_FragColor = vec4(col, m * aa);
  #include <colorspace_fragment>
}`;

class Media {
  constructor(world, el) {
    this.world = world; this.el = el; this.img = el.querySelector('img');
    this.hover = 0; this.hoverT = 0; this.reveal = 0; this.revealT = 0; this.mouse = new THREE.Vector2(0.5, 0.5);
    this.uniforms = {
      uTex: { value: null }, uSize: { value: new THREE.Vector2(1, 1) }, uImg: { value: new THREE.Vector2(1, 1) },
      uRadius: { value: 0 }, uReveal: { value: 0 }, uHover: { value: 0 }, uMouse: { value: this.mouse }, uTime: { value: 0 },
      uVel: { value: 0 }, uInk: { value: new THREE.Color(COLORS.ink) }, uGray: { value: el.closest('.person') ? 1 : 0 },
    };
    this.mesh = new THREE.Mesh(world.planeGeo, new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: MEDIA_VERT, fragmentShader: MEDIA_FRAG, transparent: true, depthTest: false }));
    this.mesh.visible = false;
    world.mediaScene.add(this.mesh);
    const load = () => {
      const tex = new THREE.Texture(this.img);
      tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
      this.uniforms.uTex.value = tex;
      this.uniforms.uImg.value.set(this.img.naturalWidth, this.img.naturalHeight);
      this.ready = true;
      el.classList.add('gl-on');
    };
    if (this.img.complete && this.img.naturalWidth) load(); else this.img.addEventListener('load', load, { once: true });
    this.img.loading = 'eager';
    el.addEventListener('pointerenter', () => { this.hoverT = 1; });
    el.addEventListener('pointerleave', () => { this.hoverT = 0; });
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); this.mouse.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height); });
  }

  update(dt, vel, t) {
    if (!this.ready) return;
    const r = this.el.getBoundingClientRect();
    const W = this.world.w, H = this.world.h;
    const vis = r.bottom > -50 && r.top < H + 50 && r.width > 2;
    this.mesh.visible = vis;
    if (!vis) return;
    if (r.top < H * 0.9) this.revealT = 1;
    this.reveal += (this.revealT - this.reveal) * Math.min(1, dt * 1.1);
    this.hover += (this.hoverT - this.hover) * Math.min(1, dt * 6);
    const u = this.uniforms;
    u.uReveal.value = this.reveal; u.uHover.value = this.hover; u.uTime.value = t; u.uVel.value = vel;
    u.uSize.value.set(r.width, r.height);
    if (this.br === undefined || (this._n = (this._n || 0) + 1) % 90 === 0) this.br = parseFloat(getComputedStyle(this.el).borderTopLeftRadius) || 0;
    u.uRadius.value = Math.min(this.br, Math.min(r.width, r.height) / 2);
    this.mesh.position.set(r.left + r.width / 2 - W / 2, H / 2 - (r.top + r.height / 2), 0);
    this.mesh.scale.set(r.width, r.height, 1);
  }

  destroy() { this.world.mediaScene.remove(this.mesh); this.mesh.material.dispose(); this.uniforms.uTex.value?.dispose(); this.el.classList.remove('gl-on'); }
}

/* ------------------------------------------------------------------ the world */
export class World {
  static supported() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
  }

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'world';
    this.canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.canvas);
    this.mobile = innerWidth < 720;
    // a full-screen transparent layer: keep its pixel count modest (Retina laptops are 2x)
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: devicePixelRatio < 1.5, premultipliedAlpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.95;
    r.autoClear = false;

    // drops scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 1, 200);
    this.camera.position.z = 40;
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const key = new THREE.DirectionalLight(0xfff1dc, 2.2); key.position.set(-4, 6, 8); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7f9bff, 1.4); rim.position.set(6, -2, -4); this.scene.add(rim);

    // living images scene (orthographic, 1 unit = 1 css px)
    this.mediaScene = new THREE.Scene();
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
    this.planeGeo = new THREE.PlaneGeometry(1, 1, 24, 24);
    this.media = [];

    // the drops: 4 letters + 6 small companions that only appear in the footer
    this.sphere = new THREE.SphereGeometry(1, 64, 48);
    this.drops = [];
    const palette = [COLORS.ink, COLORS.ink, COLORS.ink, COLORS.blue, COLORS.lavender, COLORS.orange, COLORS.blue, COLORS.orange, COLORS.lavender, COLORS.green];
    for (let i = 0; i < 10; i++) {
      const mat = dropMaterial(palette[i]);
      const mesh = new THREE.Mesh(this.sphere, mat);
      mesh.renderOrder = 1;
      const d = { i, mesh, mat, x: innerWidth / 2, y: innerHeight * 0.4, z: 0, vx: 0, vy: 0, r: 0, tr: 0, color: new THREE.Color(palette[i]), tc: new THREE.Color(palette[i]), letterA: 0, tLetterA: 0, seed: Math.random() * 100, letter: LETTERS[i] };
      if (i < 4) {
        d.texDark = letterTexture(LETTERS[i], true); d.texLight = letterTexture(LETTERS[i], false);
        d.label = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), new THREE.MeshBasicMaterial({ map: d.texDark, transparent: true, depthWrite: false, opacity: 0 }));
        d.label.position.z = 1.02; d.label.renderOrder = 2;
        mesh.add(d.label);
      }
      this.scene.add(mesh);
      this.drops.push(d);
    }

    this.layouts = [];       // {el, fn} — per page
    this.fixedLayouts = [];  // {el, fn} — survive page changes (footer)
    this.pointer = { x: -9999, y: -9999, vx: 0, vy: 0, down: false };
    this.time = 0;
    this.vel = 0;
    this._bind();
    this.resize();
  }

  _bind() {
    addEventListener('resize', () => this.resize());
    addEventListener('pointermove', (e) => {
      const p = this.pointer;
      p.vx = e.clientX - (p.x < -9000 ? e.clientX : p.x); p.vy = e.clientY - (p.y < -9000 ? e.clientY : p.y);
      p.x = e.clientX; p.y = e.clientY;
    }, { passive: true });
    addEventListener('pointerdown', (e) => {
      // flick a drop if you click it
      for (const d of this.drops) {
        if (d.r < 4) continue;
        const dx = d.x - e.clientX, dy = d.y - e.clientY;
        if (dx * dx + dy * dy < d.r * d.r * 1.2) {
          d.vx += (dx / (Math.hypot(dx, dy) + 1)) * 26 + (Math.random() - 0.5) * 10;
          d.vy += -18 - Math.random() * 10;
          document.dispatchEvent(new CustomEvent('omic:drop-hit', { detail: { i: d.i } }));
        }
      }
    });
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      addEventListener('deviceorientation', (e) => { this.tilt = { x: clamp((e.gamma || 0) / 30, -1, 1), y: clamp(((e.beta || 0) - 40) / 30, -1, 1) }; });
    }
  }

  resize() {
    this.w = innerWidth; this.h = innerHeight;
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix();
    const visH = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    this.upp = visH / this.h; // world units per css px at z = 0
    Object.assign(this.ortho, { left: -this.w / 2, right: this.w / 2, top: this.h / 2, bottom: -this.h / 2 });
    this.ortho.updateProjectionMatrix();
  }

  /* -------------------------------------------- API used by pages */
  /** register a section: while it's under the middle of the screen, fn(rect, t) returns the drop layout */
  layout(el, fn, opts = {}) {
    if (opts === true) opts = { persistent: true };
    if (el) (opts.persistent ? this.fixedLayouts : this.layouts).push({ el, fn, extend: opts.extend || 0 });
    return this;
  }
  clearLayouts() { this.layouts = []; }
  addMedia(el) { if (el.__media) return; const m = new Media(this, el); el.__media = m; this.media.push(m); }
  clearMedia() { this.media.forEach((m) => { m.destroy(); m.el.__media = null; }); this.media = []; }

  /* -------------------------------------------- default layout: a small dock in the corner = scroll progress */
  _dock() {
    const max = document.documentElement.scrollHeight - innerHeight || 1;
    const p = clamp(scrollY / max);
    const x0 = this.mobile ? 22 : 34, y0 = this.h - (this.mobile ? 26 : 36);
    return {
      mode: 'spring',
      drops: [0, 1, 2, 3].map((i) => ({ x: x0 + i * 19, y: y0 - Math.sin(this.time * 2 + i) * 2, r: 8, color: p >= i / 4 ? COLORS.blue : '#8a8378', letter: 0 })),
    };
  }

  _activeLayout() {
    const mid = this.h * 0.5;
    for (const L of [...this.layouts, ...this.fixedLayouts]) {
      const r = L.el.getBoundingClientRect();
      if (r.top <= mid && r.bottom + L.extend >= mid) {
        const t = clamp((mid - r.top) / r.height);
        const out = L.fn(r, t, this);
        if (out) return out;
      }
    }
    return this._dock();
  }

  /* -------------------------------------------- simulation */
  _step(dt) {
    const L = this._activeLayout();
    const k = dt * 60;
    const targets = L.drops;
    const gravity = L.mode === 'gravity';
    const p = this.pointer;
    this.drops.forEach((d, i) => {
      const t = targets[i] || { r: 0, x: d.x, y: d.y };
      d.tr = t.r;
      if (t.color) d.tc.set(t.color);
      d.tLetterA = t.letter ?? 0;
      if (gravity) {
        d.vy += 0.9 * k;
        if (t.x !== undefined && d.r < 3) { d.x = t.x; d.y = t.spawnY ?? -60 - i * 50; d.vy = 0; } // spawn above
        d.vx += ((t.x ?? d.x) - d.x) * 0.0004 * k;
      } else {
        const stiff = t.stiff ?? 0.075;
        d.vx += ((t.x ?? d.x) - d.x) * stiff * k * 0.5;
        d.vy += ((t.y ?? d.y) - d.y) * stiff * k * 0.5;
      }
      if (this.tilt) { d.vx += this.tilt.x * 0.4 * k; d.vy += this.tilt.y * 0.4 * k; }
      // cursor pushes drops
      const dx = d.x - p.x, dy = d.y - p.y, dist = Math.hypot(dx, dy), reach = d.r + 60;
      if (d.r > 4 && dist < reach && dist > 0.1) {
        const f = (1 - dist / reach) * 1.8 * k;
        d.vx += (dx / dist) * f + p.vx * 0.05; d.vy += (dy / dist) * f + p.vy * 0.05;
      }
    });
    // collisions (drops are slightly soft)
    for (let a = 0; a < this.drops.length; a++) {
      for (let b = a + 1; b < this.drops.length; b++) {
        const A = this.drops[a], B = this.drops[b];
        if (A.r < 2 || B.r < 2) continue;
        const dx = B.x - A.x, dy = B.y - A.y, dist = Math.hypot(dx, dy) || 0.01, min = (A.r + B.r) * 0.96;
        if (dist < min) {
          const push = (min - dist) / 2, nx = dx / dist, ny = dy / dist;
          A.x -= nx * push; A.y -= ny * push; B.x += nx * push; B.y += ny * push;
          const rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
          if (rv < 0) { const j = -rv * 0.55; A.vx -= nx * j; A.vy -= ny * j; B.vx += nx * j; B.vy += ny * j; }
        }
      }
    }
    const damp = gravity ? 0.992 : 0.8;
    this.drops.forEach((d, i) => {
      d.vx *= Math.pow(damp, k); d.vy *= Math.pow(damp, k);
      d.x += d.vx * k; d.y += d.vy * k;
      if (gravity && L.floor !== undefined) {
        if (d.y > L.floor - d.r) { d.y = L.floor - d.r; d.vy *= -0.42; d.vx *= 0.9; if (Math.abs(d.vy) > 4) document.dispatchEvent(new CustomEvent('omic:drop-land', { detail: { i, v: Math.abs(d.vy) } })); }
        if (d.x < (L.left ?? 0) + d.r) { d.x = (L.left ?? 0) + d.r; d.vx *= -0.5; }
        if (d.x > (L.right ?? this.w) - d.r) { d.x = (L.right ?? this.w) - d.r; d.vx *= -0.5; }
      }
      d.r += (d.tr - d.r) * Math.min(1, 0.12 * k);
      d.color.lerp(d.tc, Math.min(1, 0.06 * k));
      d.letterA += (d.tLetterA - d.letterA) * Math.min(1, 0.1 * k);
    });
    p.vx *= 0.8; p.vy *= 0.8;
  }

  _sync() {
    const u = this.upp;
    this.drops.forEach((d) => {
      const vis = d.r > 0.6;
      d.mesh.visible = vis;
      if (!vis) return;
      d.mesh.position.set((d.x - this.w / 2) * u, (this.h / 2 - d.y) * u, d.z);
      const sp = Math.min(0.35, Math.hypot(d.vx, d.vy) * 0.012);
      const R = d.r * u;
      d.mesh.scale.set(R * (1 + sp), R * (1 - sp * 0.6), R);
      d.mesh.rotation.z = Math.atan2(-d.vy, d.vx);
      d.mat.color.copy(d.color);
      const lum = d.color.r * 0.3 + d.color.g * 0.59 + d.color.b * 0.11;
      d.mat.envMapIntensity = 0.25 + lum * 0.9;
      d.mat.userData.uniforms.uTime.value = this.time + d.seed;
      d.mat.userData.uniforms.uWobble.value = 0.03 + sp * 0.12;
      if (d.label) {
        d.label.material.opacity = d.letterA;
        d.label.rotation.z = -d.mesh.rotation.z;
        const dark = isDark('#' + d.color.getHexString());
        const want = dark ? d.texDark : d.texLight;
        if (d.label.material.map !== want) { d.label.material.map = want; d.label.material.needsUpdate = true; }
      }
    });
  }

  tick(dt, vel) {
    this.time += dt;
    this.vel += ((vel || 0) - this.vel) * 0.2;
    this._step(Math.min(dt, 1 / 30));
    this._sync();
    this.media.forEach((m) => m.update(dt, this.vel, this.time));
    const r = this.renderer;
    // nothing on screen? clear once and then skip drawing until something appears
    const busy = this.drops.some((d) => d.mesh.visible) || this.media.some((m) => m.mesh.visible);
    if (!busy) { if (this._drawn) { r.clear(); this._drawn = false; } return; }
    this._drawn = true;
    r.clear();
    if (this.media.length) r.render(this.mediaScene, this.ortho);
    r.clearDepth();
    r.render(this.scene, this.camera);
  }

  /** where the drops are right now (css px) — used by sections that react to them */
  dropsState() { return this.drops.map((d) => ({ x: d.x, y: d.y, r: d.r })); }
}
