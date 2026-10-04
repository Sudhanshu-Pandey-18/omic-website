// OMIC sound — an original, generative score and UI foley, synthesised live with WebAudio.
// Nothing plays until the visitor opts in. The score follows the "hour" of the page:
// warm open chords at dusk, softer and lower at night, brighter at dawn.
let ctx, master, music, fx, verb, on = false, started = false, hour = 'dusk', chordTimer;

function impulse(seconds = 3.2, decay = 2.6) {
  const len = ctx.sampleRate * seconds, buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return buf;
}

function ensure() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  verb = ctx.createConvolver(); verb.buffer = impulse();
  const verbGain = ctx.createGain(); verbGain.gain.value = 0.55; verb.connect(verbGain).connect(master);
  music = ctx.createGain(); music.gain.value = 0.5;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; music.lp = lp;
  music.connect(lp); lp.connect(master); lp.connect(verb);
  fx = ctx.createGain(); fx.gain.value = 0.5; fx.connect(master); fx.connect(verb);
}

export const soundOn = () => on;

// chord progression (Hz roots + intervals) — Dmaj9 · Bm11 · Gmaj7#11 · A6sus
const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
const PROG = [[50, 57, 62, 66, 69, 76], [47, 54, 61, 62, 66, 73], [43, 50, 59, 62, 66, 73], [45, 52, 59, 61, 64, 71]];
let step = 0;

function playChord() {
  if (!on) return;
  const now = ctx.currentTime, dur = 7.5;
  const notes = PROG[step++ % PROG.length];
  notes.forEach((n, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = i < 2 ? 'sine' : 'triangle';
    o.frequency.value = N(n + (hour === 'night' ? -12 * (i === 0) : 0));
    o.detune.value = (Math.random() - 0.5) * 8;
    const peak = (i === 0 ? 0.16 : 0.07) * (hour === 'night' ? 0.8 : 1);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + 2.2 + i * 0.25);
    g.gain.linearRampToValueAtTime(0, now + dur + 1.5);
    o.connect(g).connect(music); o.start(now); o.stop(now + dur + 2);
  });
  // a few plucked notes on top, like someone tuning a piano in the next room
  for (let k = 0; k < 3; k++) {
    if (Math.random() < 0.35) continue;
    const t = now + 1 + Math.random() * 5, n = notes[2 + Math.floor(Math.random() * 4)] + 12;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = N(n);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
    o.connect(g).connect(music); o.start(t); o.stop(t + 2.6);
  }
  chordTimer = setTimeout(playChord, dur * 1000);
}

/** projector flutter bed */
function projector() {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = buf.getChannelData(0), every = Math.round(ctx.sampleRate / 24);
  for (let i = 0; i < d.length; i++) d[i] = (i % every < 40 ? (Math.random() * 2 - 1) * 0.5 : 0) + (Math.random() * 2 - 1) * 0.015;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.8;
  const g = ctx.createGain(); g.gain.value = 0.035;
  src.connect(bp).connect(g).connect(master); src.start();
}

export function ambient() {
  try {
    ensure(); ctx.resume(); on = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2.5);
    if (!started) { started = true; projector(); playChord(); }
    else if (!chordTimer) playChord();
    document.dispatchEvent(new Event('omic:sound'));
  } catch { /* no audio */ }
}

export function toggleSound() {
  if (!on) { ambient(); return true; }
  on = false; clearTimeout(chordTimer); chordTimer = null;
  master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  return false;
}

document.addEventListener('omic:hour', (e) => {
  hour = e.detail;
  if (!ctx) return;
  const f = { dusk: 2400, twilight: 1800, night: 900, ember: 2600, dawn: 3600, day: 3200 }[hour] || 2400;
  music.lp.frequency.linearRampToValueAtTime(f, ctx.currentTime + 2);
});

/** short sine "pop" (leader 2-pop) */
export function pop(freq = 880, dur = 0.08, vol = 0.25) {
  if (!ctx || !on) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = freq; g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g).connect(fx); o.start(); o.stop(ctx.currentTime + dur + 0.02);
}

let lastHover = 0;
/** UI foley: hover · pop · tap · whoosh · success · error */
export function sfx(kind, amt = 1) {
  if (!ctx || !on) return;
  const t = ctx.currentTime;
  if (kind === 'hover') {
    if (performance.now() - lastHover < 70) return; lastHover = performance.now();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(1800 + Math.random() * 600, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.05);
    g.gain.setValueAtTime(0.025, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g).connect(fx); o.start(t); o.stop(t + 0.07);
  } else if (kind === 'pop' || kind === 'tap') {
    const o = ctx.createOscillator(), g = ctx.createGain();
    const f = kind === 'pop' ? 520 + Math.random() * 240 : 180 + Math.min(amt, 20) * 8;
    o.type = 'sine'; o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    g.gain.setValueAtTime(kind === 'pop' ? 0.18 : Math.min(0.12, amt * 0.008), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(fx); o.start(t); o.stop(t + 0.3);
  } else if (kind === 'whoosh') {
    const len = ctx.sampleRate * 0.9, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.8);
    const g = ctx.createGain(); g.gain.value = 0.12;
    s.connect(bp).connect(g).connect(fx); s.start(t);
  } else if (kind === 'success' || kind === 'error') {
    const notes = kind === 'success' ? [74, 78, 81, 86] : [62, 61];
    notes.forEach((n, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), tt = t + i * 0.09;
      o.type = 'triangle'; o.frequency.value = N(n);
      g.gain.setValueAtTime(0.08, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.6);
      o.connect(g).connect(fx); o.start(tt); o.stop(tt + 0.7);
    });
  }
}
