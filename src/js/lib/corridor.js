// "The Warehouse" — a 3D walk through a dark gallery corridor. Each event poster hangs
// under its own spotlight; scrolling moves the camera, hovering lifts a frame, clicking opens it.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// film look: grain, vignette, a touch of chromatic aberration and gate weave
const FilmShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uAmount; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv + vec2(0.0, sin(uTime * 40.0) * 0.0006 * uAmount);
      vec2 c = uv - 0.5; float d = dot(c, c);
      vec2 off = c * d * 0.018 * uAmount;
      vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      col += (hash(uv * 900.0 + fract(uTime)) - 0.5) * 0.035 * uAmount;
      col *= 1.0 - smoothstep(0.18, 0.75, d) * 0.75;
      col *= 0.97 + 0.03 * sin(uTime * 60.0);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

const CREAM = 0xf4ede1;

function noiseTexture(w, h, base, spread, lines = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const img = x.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const n = base + (Math.random() - 0.5) * spread;
    img.data[i * 4] = n; img.data[i * 4 + 1] = n * 0.96; img.data[i * 4 + 2] = n * 0.9; img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  if (lines) { // concrete slab joints
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2;
    for (let y = 0; y < h; y += h / 4) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
    for (let xx = 0; xx < w; xx += w / 2) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, h); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 320;
  const x = c.getContext('2d');
  const r = 110, gap = 230, cx = 512 - gap * 1.5, cy = 160;
  ['O', 'M', 'I', 'C'].forEach((L, i) => {
    const px = cx + i * gap;
    x.shadowColor = i === 3 ? '#7f9bff' : '#f4ede1'; x.shadowBlur = 40;
    x.strokeStyle = i === 3 ? '#9fb3ff' : '#fff6e8'; x.lineWidth = 10;
    x.beginPath(); x.arc(px, cy, r, 0, Math.PI * 2); x.stroke();
    x.font = '400 120px Oswald, "Arial Narrow", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = x.strokeStyle; x.fillText(L, px, cy + 6);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// soft additive light cone — fake volumetric beam
function beam(color = 0xfff1d8, height = 6, radius = 2.2) {
  const geo = new THREE.ConeGeometry(radius, height, 48, 1, true);
  geo.translate(0, -height / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uHeight: { value: height }, uStrength: { value: 0.22 } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ vY = position.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uHeight; uniform float uStrength; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float t = clamp(-vY / uHeight, 0.0, 1.0); float edge = pow(abs(dot(vN, vV)), 1.6);
        float a = (1.0 - t) * edge * uStrength; gl_FragColor = vec4(uColor * a, a); }`,
  });
  return new THREE.Mesh(geo, mat);
}

export class Corridor {
  /**
   * @param {HTMLElement} host — sticky stage element
   * @param {{img:string, href:string, title:string, when:string, kicker:string, ratio:number}[]} items
   */
  constructor(host, items, { onHover } = {}) {
    this.host = host; this.items = items; this.onHover = onHover;
    this.progress = 0; this.mouse = new THREE.Vector2(0, 0); this.hovered = null;
    const mobile = innerWidth < 720;
    this.renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.className = 'corridor-canvas';
    host.appendChild(this.renderer.domElement);

    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0b09);
    scene.fog = new THREE.Fog(0x0d0b09, 10, 46);
    this.camera = new THREE.PerspectiveCamera(mobile ? 70 : 55, 1, 0.1, 120);

    const loader = new THREE.TextureLoader();
    const W = 7.2, H = 5.2, LEN = 14 * items.length + 24;
    this.len = LEN;

    // floor: dark, glossy, semi-transparent over a mirrored copy of the room (cheap reflections)
    const floorTex = noiseTexture(256, 256, 34, 18, true); floorTex.repeat.set(2, LEN / 6);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, LEN + 20), new THREE.MeshStandardMaterial({ map: floorTex, color: 0x6b6258, roughness: 0.32, metalness: 0.15, transparent: true, opacity: 0.86 }));
    floor.rotation.x = -Math.PI / 2; floor.position.z = -LEN / 2 + 6;
    scene.add(floor);
    const wallTex = noiseTexture(256, 256, 52, 26, true); wallTex.repeat.set(LEN / 8, 1);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: 0xc4b8a5, roughness: 0.92 });
    [-1, 1].forEach((s) => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(LEN + 20, H), wallMat);
      wall.position.set(s * W / 2, H / 2, -LEN / 2 + 6); wall.rotation.y = -s * Math.PI / 2; scene.add(wall);
    });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, LEN + 20), new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, -LEN / 2 + 6); scene.add(ceil);
    // steel beams
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x1d1a16, roughness: 0.6, metalness: 0.5 });
    for (let z = 4; z > -LEN; z -= 4.5) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(W, 0.25, 0.3), beamMat); b.position.set(0, H - 0.15, z); scene.add(b);
    }
    scene.add(new THREE.AmbientLight(0xffffff, 0.2));
    const hemi = new THREE.HemisphereLight(0x8193e6, 0x2a1a0c, 0.45); scene.add(hemi);
    // warm work-lights along the ceiling so the room reads as a space
    for (let z = -2; z > -LEN; z -= 11) { const pl = new THREE.PointLight(0xffc98a, 6, 9, 1.4); pl.position.set(0, H - 0.6, z); scene.add(pl); }

    // posters
    this.frames = [];
    items.forEach((it, i) => {
      const side = i % 2 ? 1 : -1;
      const z = -6 - i * 14;
      const ph = 2.3, pw = ph * it.ratio;
      const group = new THREE.Group();
      group.position.set(side * (W / 2 - 0.55), 2.15, z);
      group.rotation.y = -side * (Math.PI / 2 - 0.42);
      const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.32, ph + 0.32, 0.08), new THREE.MeshStandardMaterial({ color: 0x0b0a08, roughness: 0.4, metalness: 0.3 }));
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(pw + 0.16, ph + 0.16), new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.9 }));
      mat.position.z = 0.045;
      const tex = loader.load(it.img); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.05 }));
      pic.position.z = 0.05;
      group.add(frameMesh, mat, pic);
      group.userData = { item: it, pic, base: group.position.clone(), side, lift: 0 };
      scene.add(group);

      // the spotlight that paints it
      const spot = new THREE.SpotLight(0xffe7c4, 45, 10, 0.55, 0.65, 1.5);
      spot.position.set(side * (W / 2 - 1.9), H - 0.2, z);
      spot.target = group; scene.add(spot); scene.add(spot.target);
      const cone = beam(0xffe9c8, 3.6, 1.05);
      cone.position.copy(spot.position);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), group.position.clone().sub(spot.position).normalize());
      scene.add(cone);
      group.userData.spot = spot; group.userData.cone = cone;
      this.frames.push(group);

      // reflection ghost under the floor
      const ghost = pic.clone(); ghost.material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.18, color: 0x9a9a9a });
      ghost.scale.y = -1;
      const gGroup = new THREE.Group(); gGroup.position.set(group.position.x, -2.15, z); gGroup.rotation.y = group.rotation.y; gGroup.add(ghost);
      scene.add(gGroup);
    });

    // gallery vinyl lettering between the frames
    const vinyl = (lines, side, z, color = '#e9dfcf') => {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
      const x = c.getContext('2d');
      x.fillStyle = color; x.textAlign = 'left'; x.textBaseline = 'top';
      lines.forEach((l, k) => { x.font = k === 0 ? '400 120px Oswald, sans-serif' : '300 46px Outfit, sans-serif'; x.fillText(l, 20, k === 0 ? 40 : 190 + (k - 1) * 62); });
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.9 }));
      m.position.set(side * (W / 2 - 0.02), 2.3, z); m.rotation.y = -side * Math.PI / 2; scene.add(m);
    };
    const words = [
      ['WHERE ART', 'finds its home.', 'Culture · Cinema · Cafe'],
      ['50 SEATS', 'German sound technology.', 'Honest materials, open acoustics.'],
      ['AED 15,000', 'The OMIC Art Prize.', 'Theme: Shared Ground.'],
      ['12 ARTISTS', 'Nothing Unusual.', 'Curated by Narges Soleimanzadeh.'],
    ];
    words.slice(0, items.length).forEach((wd, i) => vinyl(wd, i % 2 ? -1 : 1, -12.5 - i * 14));

    // end wall: the OMIC sign in light
    const endZ = -6 - items.length * 14 - 4;
    const endWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: wallTex, color: 0x5d564d, roughness: 0.95 }));
    endWall.position.set(0, H / 2, endZ - 0.05); scene.add(endWall);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.44), new THREE.MeshBasicMaterial({ map: signTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sign.position.set(0, 2.6, endZ); scene.add(sign); this.sign = sign;
    const glow = new THREE.PointLight(0x7f9bff, 14, 9, 1.5); glow.position.set(0, 2.6, endZ + 1.2); scene.add(glow);
    this.endZ = endZ;

    // dust motes drifting in the beams
    const N = mobile ? 500 : 1400;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * W; pos[i * 3 + 1] = Math.random() * H; pos[i * 3 + 2] = 6 - Math.random() * (LEN + 10); seed[i] = Math.random();
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); dg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.dust = new THREE.Points(dg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPx: { value: this.renderer.getPixelRatio() } },
      vertexShader: `attribute float seed; uniform float uTime; uniform float uPx; varying float vA;
        void main(){ vec3 p = position; p.y += sin(uTime * 0.3 + seed * 30.0) * 0.25; p.x += cos(uTime * 0.2 + seed * 17.0) * 0.2;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (1.0 + seed * 2.5) * uPx * (8.0 / -mv.z); vA = 0.25 + 0.5 * seed; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vec3(1.0, 0.93, 0.8) * a, a); }`,
    }));
    scene.add(this.dust);

    // captions (HTML, projected onto each frame)
    this.captions = items.map((it) => {
      const el = document.createElement('a');
      el.className = 'corridor-cap'; el.href = it.href; el.dataset.cursor = 'Enter';
      el.innerHTML = `<span class="kicker">${it.kicker}</span><strong>${it.title}</strong><span class="when">${it.when}</span>`;
      host.appendChild(el); return el;
    });

    // post-processing: bloom on the lights, then film
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), mobile ? 0.3 : 0.38, 0.45, 0.97);
    this.composer.addPass(this.bloom);
    this.film = new ShaderPass(FilmShader);
    this.composer.addPass(this.film);
    this.composer.addPass(new OutputPass());

    this.ray = new THREE.Raycaster();
    this._bind();
    this.resize();
    this.t0 = performance.now();
    this.visible = true;
    this.io = new IntersectionObserver(([en]) => { this.visible = en.isIntersecting; if (this.visible) this._loop(); }, { rootMargin: '100px' });
    this.io.observe(host);
  }

  destroy() {
    cancelAnimationFrame(this.raf); this.raf = 0; this.visible = false;
    this.io.disconnect();
    window.removeEventListener('resize', this._resize);
    this.scene.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
    this.renderer.dispose(); this.renderer.forceContextLoss();
    this.renderer.domElement.remove(); this.captions.forEach((c) => c.remove());
  }

  _bind() {
    this._resize = () => this.resize();
    window.addEventListener('resize', this._resize);
    this.host.addEventListener('pointermove', (e) => {
      const r = this.host.getBoundingClientRect();
      this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    });
    this.host.addEventListener('pointerleave', () => { this.mouse.set(0, 0); this._setHover(null); });
    this.host.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      if (this.hovered) { const a = document.createElement('a'); a.href = this.hovered.userData.item.href; document.body.appendChild(a); a.click(); a.remove(); }
    });
  }

  _setHover(g) {
    if (g === this.hovered) return;
    this.hovered = g;
    this.host.style.cursor = g ? 'pointer' : '';
    this.host.dataset.cursor = g ? 'Enter' : '';
    this.onHover && this.onHover(g ? g.userData.item : null);
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.renderer.setSize(r.width, r.height, false);
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(r.width, r.height); }
    this.camera.aspect = r.width / r.height;
    this.camera.fov = r.width < 720 ? 72 : 55;
    this.camera.updateProjectionMatrix();
  }

  setProgress(p) { this.progress = p; if (!this.raf) this._loop(); }

  _loop() {
    if (this.raf) return;
    const tick = () => {
      this.raf = 0;
      if (!this.visible || document.hidden) return;
      this._frame();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  _frame() {
    const t = (performance.now() - this.t0) / 1000;
    const cam = this.camera;
    const zStart = 11, zEnd = this.endZ + 3.4;
    const tz = zStart + (zEnd - zStart) * this.progress;
    cam.position.z += (tz - cam.position.z) * 0.08;
    cam.position.x += (this.mouse.x * 0.45 - cam.position.x) * 0.05;
    cam.position.y += (1.7 + this.mouse.y * 0.2 + Math.sin(t * 1.6) * 0.015 - cam.position.y) * 0.05;
    const look = new THREE.Vector3(this.mouse.x * 1.4, 1.75 + this.mouse.y * 0.4, cam.position.z - 6);
    cam.lookAt(look);

    this.dust.material.uniforms.uTime.value = t;
    this.sign.material.opacity = 0.75 + Math.sin(t * 9) * 0.04 + (Math.random() < 0.02 ? -0.4 : 0); // neon flicker

    // hover
    this.ray.setFromCamera(this.mouse, cam);
    const hit = this.ray.intersectObjects(this.frames.map((f) => f.userData.pic), false)[0];
    this._setHover(hit && hit.distance < 14 ? this.frames.find((f) => f.userData.pic === hit.object) : null);

    const v = new THREE.Vector3();
    this.frames.forEach((g, i) => {
      const u = g.userData;
      const target = g === this.hovered ? 1 : 0;
      u.lift += (target - u.lift) * 0.1;
      g.position.x = u.base.x - u.side * u.lift * 0.35;
      g.rotation.z = Math.sin(t * 0.8 + i) * 0.004 + u.lift * 0.02 * u.side;
      u.spot.intensity = 45 + u.lift * 45;
      u.cone.material.uniforms.uStrength.value = 0.2 + u.lift * 0.25 + Math.sin(t * 2 + i) * 0.01;
      // caption follows its frame
      v.copy(g.position); v.y -= 1.55; v.project(cam);
      const cap = this.captions[i];
      const dist = Math.abs(cam.position.z - g.position.z);
      const vis = v.z < 1 && dist < 12 ? Math.max(0, 1 - Math.abs(dist - 6) / 6) : 0;
      cap.style.transform = `translate3d(${(v.x * 0.5 + 0.5) * this.w}px, ${(-v.y * 0.5 + 0.5) * this.h}px, 0) translate(-50%, 0)`;
      cap.style.opacity = vis.toFixed(3);
      cap.style.pointerEvents = vis > 0.4 ? 'auto' : 'none';
    });
    this.film.uniforms.uTime.value = t;
    this.composer.render();
  }
}
