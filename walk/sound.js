/* same old samsara · the walk · sound
   Off until someone turns it on. Nothing is downloaded: every sound is made in the browser from noise and a few tones.
   Wind in the meadow, the river when you are near it, crickets after dark, the fire when it is lit, a bird now and then,
   and the raven when you poke it. Loaded only when the sound button is pressed. */

/** build the whole graph on any audio context (a live one, or an offline one for testing) */
export function buildSound(ctx) {
  const now = () => ctx.currentTime;
  const master = ctx.createGain(); master.gain.value = 0;
  const squash = ctx.createDynamicsCompressor();                 // a safety net, so nothing ever jumps out
  squash.threshold.value = -18; squash.ratio.value = 6; squash.attack.value = 0.01; squash.release.value = 0.3;
  master.connect(squash); squash.connect(ctx.destination);

  const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 3), ctx.sampleRate);
  { const d = noiseBuf.getChannelData(0); let s = 12345; for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = s / 2147483648 - 1; } }
  const noise = (offset = 0) => { const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.start(0, offset); return n; };
  const gain = (v, to = master) => { const g = ctx.createGain(); g.gain.value = v; g.connect(to); return g; };
  const filter = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const lfo = (hz, depth, param) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = hz; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); return o; };

  // wind: low soft noise that swells and fades
  const wind = gain(0); { const f = filter("lowpass", 420, 0.5); noise(0).connect(f); f.connect(wind); lfo(0.07, 160, f.frequency); lfo(0.13, 60, f.frequency); }
  // the meadow: dry rustle on top of the wind, louder when you walk
  const rustle = gain(0); { const f = filter("bandpass", 3200, 0.8); noise(0.7).connect(f); f.connect(rustle); }
  // the river: a steady wash with a little movement in it
  const river = gain(0); { const a = filter("bandpass", 700, 0.5), b = filter("highpass", 260, 0.7); noise(1.3).connect(a); a.connect(b); b.connect(river); lfo(0.31, 90, a.frequency); const c = filter("bandpass", 2300, 1.1), cg = gain(0.35, river); noise(2.1).connect(c); c.connect(cg); }
  // crickets: a high tone chopped into quick pulses, two of them a little apart
  const crickets = gain(0);
  for (const [hz, rate, level] of [[4300, 15.5, 0.5], [4750, 13.2, 0.35]]) {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = hz;
    const chop = ctx.createGain(); chop.gain.value = 0; const sq = ctx.createOscillator(); sq.type = "square"; sq.frequency.value = rate;
    const sg = ctx.createGain(); sg.gain.value = 0.5; sq.connect(sg); sg.connect(chop.gain); chop.gain.value = 0.5;
    const swell = ctx.createGain(); swell.gain.value = 0.55; lfo(0.9 + rate * 0.01, 0.45, swell.gain);
    o.connect(chop); chop.connect(swell); const lv = gain(level, crickets); swell.connect(lv); o.start(); sq.start();
  }
  // the fire: a low roar, plus crackles that are scheduled a few at a time
  const fire = gain(0); { const f = filter("lowpass", 520, 0.6), hp = filter("highpass", 90, 0.7); noise(0.4).connect(f); f.connect(hp); hp.connect(fire); lfo(5.3, 60, f.frequency); }
  const crackleOut = gain(0);
  function crackle(t) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; const g = ctx.createGain(), f = filter("bandpass", 1800 + Math.random() * 2600, 2.5);
    const len = 0.012 + Math.random() * 0.03;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 + Math.random() * 0.5, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    n.connect(f); f.connect(g); g.connect(crackleOut); n.start(t, Math.random() * 2.5, len + 0.02);
  }
  // a small bird, a few notes
  const birds = gain(0);
  function chirp(t) {
    const base = 2600 + Math.random() * 1500, notes = 2 + ((Math.random() * 3) | 0);
    for (let k = 0; k < notes; k++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), s = t + k * 0.11;
      o.frequency.setValueAtTime(base * (1 + k * 0.06), s); o.frequency.exponentialRampToValueAtTime(base * (1.25 + k * 0.05), s + 0.06);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.5, s + 0.012); g.gain.exponentialRampToValueAtTime(0.001, s + 0.085);
      o.connect(g); g.connect(birds); o.start(s); o.stop(s + 0.1);
    }
  }
  // the raven: a rough, falling croak
  const ravenOut = gain(0.9);
  function caw(t = now() + 0.02) {
    for (let k = 0; k < 2; k++) {
      const s = t + k * 0.34, o = ctx.createOscillator(), g = ctx.createGain(), f = filter("bandpass", 1150, 3), rough = ctx.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(430, s); o.frequency.exponentialRampToValueAtTime(300, s + 0.24);
      rough.gain.value = 0.6; lfoAt(58, 0.4, rough.gain, s, s + 0.3);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.9, s + 0.03); g.gain.exponentialRampToValueAtTime(0.001, s + 0.26);
      o.connect(f); f.connect(rough); rough.connect(g); g.connect(ravenOut); o.start(s); o.stop(s + 0.3);
    }
  }
  function lfoAt(hz, depth, param, t0, t1) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = hz; g.gain.value = depth; o.connect(g); g.connect(param); o.start(t0); o.stop(t1); }

  let nextCrackle = 0, nextChirp = 0, levels = { fire: 0, day: 0 };
  const ramp = (param, v) => param.setTargetAtTime(v, now(), 0.35);
  return {
    master,
    /** how loud each thing should be right now, each 0..1 */
    set({ wind: w = 0, walking = 0, river: r = 0, night = 0, fire: f = 0, day = 0 }) {
      ramp(wind.gain, 0.11 + w * 0.2); ramp(rustle.gain, 0.009 + w * 0.026 + walking * 0.065);
      ramp(river.gain, r * 0.4); ramp(crickets.gain, night * 0.05); ramp(fire.gain, f * 0.34); ramp(crackleOut.gain, f * 0.45); ramp(birds.gain, day * 0.08);
      levels = { fire: f, day };
    },
    /** call this a few times a second: it lines up the next crackles and bird calls */
    tick() {
      const t = now();
      if (levels.fire > 0.05) { while (nextCrackle < t + 0.5) { nextCrackle = Math.max(nextCrackle, t) + 0.03 + Math.random() * 0.28 / levels.fire; crackle(nextCrackle); } } else nextCrackle = t;
      if (levels.day > 0.2) { if (nextChirp < t) { chirp(t + 0.1); nextChirp = t + 2.5 + Math.random() * 7; } } else nextChirp = t + 1;
    },
    caw,
    fade(v) { master.gain.setTargetAtTime(v, now(), 0.4); },
  };
}

/** the live one. the browser only allows this after a tap or a click, which is exactly when it is called. */
export function startSound() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const s = buildSound(ctx);
  s.ctx = ctx;
  s.on = () => { ctx.resume(); s.fade(0.8); };
  s.off = () => { s.fade(0); setTimeout(() => { if (s.master.gain.value < 0.01) ctx.suspend(); }, 1500); };
  return s;
}
