// Brush cursor: a small ink dot with a label ring, trailing a fading watercolour stroke.
// The trail takes the colour of the current "hour" of the page.

export function brushCursor() {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!fine || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  const trail = document.createElement('canvas');
  trail.className = 'brush-trail';
  trail.setAttribute('aria-hidden', 'true');
  document.body.appendChild(trail);
  const ctx = trail.getContext('2d');

  const c = document.createElement('div');
  c.className = 'cursor is-hidden';
  c.innerHTML = '<div class="cursor-dot"></div><div class="cursor-ring"><span></span></div>';
  document.body.appendChild(c);
  document.body.classList.add('has-cursor');
  const label = c.querySelector('.cursor-ring span');

  let dpr = 1, W = 0, H = 0;
  const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); W = trail.width = innerWidth * dpr; H = trail.height = innerHeight * dpr; };
  size(); addEventListener('resize', size);

  const pts = [];
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y, moved = false, muted = false;
  addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY; moved = true; c.classList.remove('is-hidden');
    if (!muted) pts.push({ x, y, t: performance.now() });
  }, { passive: true });
  document.addEventListener('pointerleave', () => c.classList.add('is-hidden'));

  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('[data-cursor], a, button, input, select, textarea, label, summary');
    const l = t && t.dataset.cursor;
    c.classList.toggle('has-label', !!l);
    c.classList.toggle('is-link', !!t && !l);
    if (l) label.textContent = l;
    // no trail over canvases that already paint (fluid, corridor)
    muted = !!e.target.closest('[data-no-trail]');
    c.classList.toggle('is-paint', !!e.target.closest('[data-paint]'));
  });

  const color = () => getComputedStyle(document.body).getPropertyValue('--trail').trim() || 'rgba(23,20,15,.5)';

  const loop = () => {
    cx += (x - cx) * 0.25; cy += (y - cy) * 0.25;
    c.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    // fade the previous frame
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.09)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    const now = performance.now();
    while (pts.length && now - pts[0].t > 260) pts.shift();
    if (pts.length > 2 && moved) {
      ctx.strokeStyle = color(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const sp = Math.hypot(b.x - a.x, b.y - a.y);
        ctx.lineWidth = Math.max(1, 9 - sp * 0.18) * dpr * (i / pts.length);
        ctx.beginPath(); ctx.moveTo(a.x * dpr, a.y * dpr); ctx.lineTo(b.x * dpr, b.y * dpr); ctx.stroke();
      }
      pts.splice(0, pts.length - 2);
    }
    requestAnimationFrame(loop);
  };
  loop();
  return c;
}
