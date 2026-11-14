/* same old samsara · the walk · sound
   Off until someone turns it on. Nothing is downloaded: every sound is made in the browser from noise and a few tones.
   Wind in the meadow, the river when you are near it, crickets after dark, the fire when it is lit, a bird now and then,
   and the raven when you poke it. Loaded only when the sound button is pressed.

   What makes it sound like outdoors and not like a machine (Nov 13):
   - nothing is a steady tone. crickets are short pulses in little groups, each insect at its own pitch, pace and distance,
     and now and then one stops to listen. birds are a few kinds of song, not one beep.
   - noise is pink (more low than high, like wind and water are), and it swells and drops with slow gusts that never line up.
   - the far things go through a little open air echo, so they sit back in the scene.
   - everything is quiet. it is a bed under the walk, not a soundtrack. */

/** build the whole graph on any audio context (a live one, or an offline one for testing) */
export function buildSound(ctx) {
  const now = () => ctx.currentTime, TAU = Math.PI * 2;
  const master = ctx.createGain(); master.gain.value = 0;
  const squash = ctx.createDynamicsCompressor();                 // a safety net, so nothing ever jumps out
  squash.threshold.value = -20; squash.ratio.value = 5; squash.attack.value = 0.012; squash.release.value = 0.3;
  master.connect(squash); squash.connect(ctx.destination);

  // the loops are built from the same numbers every time, so it is the same meadow on every visit
  let seed = 20261113; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const gain = (v, to = master) => { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
  const filter = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; };
  const loop = (buf, offset = 0) => { const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true; n.start(0, offset); return n; };
  const lfo = (hz, depth, param) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = hz; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); return o; };

  /* ---------- noise: white for dry things, pink for air and water. the ends are blended so the loop has no seam ---------- */
  function noiseLoop(seconds, pink) {
    const n = Math.floor(ctx.sampleRate * seconds), fade = Math.floor(ctx.sampleRate * 0.2), raw = new Float32Array(n + fade);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < raw.length; i++) {
      const w = rnd() * 2 - 1;
      if (!pink) { raw[i] = w; continue; }
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.16; b6 = w * 0.115926;
    }
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = i < fade ? raw[i] * (i / fade) + raw[n + i] * (1 - i / fade) : raw[i];
    return buf;
  }
  const white = noiseLoop(4, false), pink = noiseLoop(6, true);

  /* ---------- gusts: three slow swells that never line up. everything the wind moves follows them ---------- */
  const gusts = gain(1, null); for (const [hz, amt] of [[0.047, 0.5], [0.113, 0.32], [0.271, 0.18]]) lfo(hz, amt, gusts.gain);
  { const one = ctx.createBuffer(1, 2, ctx.sampleRate); one.getChannelData(0).fill(1); loop(one).connect(gusts); gusts.gain.value = 0; }   // gusts now carries -1..1
  const follow = (param, depth) => { const g = gain(depth, null); gusts.connect(g); g.connect(param); };

  /* ---------- wind: low air that swells and drops, with a little breath on top ---------- */
  const wind = gain(0);
  { const body = gain(0.7, wind); follow(body.gain, 0.3);
    const low = filter("lowpass", 620, 0.4); chain(loop(pink), low, filter("highpass", 120, 0.7), body); follow(low.frequency, 240);
    const breath = filter("bandpass", 1050, 0.6); chain(loop(pink, 2.3), breath, gain(0.5, body)); follow(breath.frequency, 280); }

  /* ---------- the meadow: dry stems moving in the wind, and brushing past your legs when you walk ---------- */
  const rustle = gain(0), brush = gain(0);
  { const sway = gain(0.5, rustle); follow(sway.gain, 0.42); lfo(0.83, 0.08, sway.gain);
    chain(loop(white, 0.7), filter("highpass", 2600, 0.6), filter("lowpass", 6500, 0.6), sway);
    const step = gain(0.5, brush); lfo(1.85, 0.42, step.gain);                       // a swish for each stride
    chain(loop(white, 2.1), filter("bandpass", 2900, 0.6), step); }

  /* ---------- the river: a wash of moving water, a brighter ripple, and the small sounds of it going over stones ---------- */
  function burbleLoop() {
    const sr = 24000, len = 7, n = sr * len, buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    for (let b = 0; b < len * 110; b++) {
      const f = 360 * Math.pow(5.5, rnd()), m = Math.floor((0.012 + rnd() * 0.04) * (0.5 + 700 / (f + 400)) * sr);
      const amp = 0.03 + Math.pow(rnd(), 2.4) * 0.5, rise = 0.06 + rnd() * 0.22, i0 = Math.floor(rnd() * n);
      for (let i = 0; i < m; i++) { const x = i / m; d[(i0 + i) % n] += amp * Math.min(1, i / 30) * Math.exp(-4.5 * x) * Math.sin(TAU * f * (1 + rise * x * 0.5) * i / sr); }
    }
    return buf;
  }
  const river = gain(0);
  { const wash = gain(0.8, river), ripple = gain(0.26, river);
    chain(loop(pink, 1.3), filter("bandpass", 700, 0.35), filter("highpass", 190, 0.7), wash); lfo(0.19, 0.12, wash.gain);
    chain(loop(white, 1.9), filter("bandpass", 2200, 0.5), ripple); lfo(0.31, 0.07, ripple.gain);
    chain(loop(burbleLoop()), filter("lowpass", 3800, 0.5), gain(0.8, river)); }

  /* ---------- open air: a short soft echo off the trees, for the things that are far away ---------- */
  const air = gain(1, null);
  { const sr = ctx.sampleRate, n = Math.floor(sr * 1.2), ir = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const t = i / sr; lp += (rnd() * 2 - 1 - lp) * 0.3; d[i] = lp * Math.exp(-t * 5.5) * Math.min(1, t / 0.015); } }
    const echo = ctx.createConvolver(); echo.buffer = ir; chain(air, echo, gain(0.5)); }

  /* ---------- crickets: a few near, a few far. each one chirps in short pulses, at its own pitch and pace ---------- */
  function cricketLoop() {
    const sr = 24000, len = 12, n = sr * len, buf = ctx.createBuffer(2, n, sr), L = buf.getChannelData(0), R = buf.getChannelData(1);
    // [pitch hz, pulses in a chirp, seconds from pulse to pulse, seconds from chirp to chirp, how loud, left -1 .. right 1]
    const singers = [
      [4620, 3, 0.043, 0.58, 1.0, -0.55], [4400, 4, 0.047, 0.73, 0.55, 0.5], [4850, 3, 0.04, 0.49, 0.3, 0.12],     // field crickets
      [2910, 7, 0.021, 0.64, 0.4, -0.15], [3070, 7, 0.022, 0.69, 0.24, 0.7],                                       // tree crickets: lower, softer, steadier
      [4530, 3, 0.045, 0.61, 0.15, -0.85], [4740, 4, 0.042, 0.85, 0.12, 0.9], [4330, 3, 0.049, 0.53, 0.09, 0.3],   // out in the dark
    ];
    for (const [hz, pulses, every, period, loud, pan] of singers) {
      const l = Math.cos((pan + 1) * Math.PI / 4) * loud, r = Math.sin((pan + 1) * Math.PI / 4) * loud, m = Math.floor(every * 0.62 * sr);
      for (let t = rnd() * period; t < len; t += period * (0.94 + rnd() * 0.12)) {
        if (rnd() < 0.07) { t += period * (2 + rnd() * 4); continue; }                // it stops to listen
        const f = hz * (1 + (rnd() - 0.5) * 0.012);
        for (let p = 0; p < pulses; p++) {
          const amp = (0.45 + 0.55 * Math.min(1, (p + 1) / Math.min(pulses, 3))) * (0.85 + rnd() * 0.3), i0 = Math.floor((t + p * every) * sr);
          for (let i = 0; i < m; i++) {
            const x = i / m, env = x < 0.3 ? 0.5 - 0.5 * Math.cos(Math.PI * x / 0.3) : 0.5 + 0.5 * Math.cos(Math.PI * (x - 0.3) / 0.7);
            const v = env * amp * Math.sin(TAU * f * (1 - 0.01 * x) * i / sr), k = (i0 + i) % n;
            L[k] += v * l; R[k] += v * r;
          }
        }
      }
    }
    return buf;
  }
  const crickets = gain(0);
  chain(loop(cricketLoop()), filter("lowpass", 7000, 0.5), crickets); crickets.connect(gain(0.35, air));

  /* ---------- the fire: a low breathing roar, a faint hiss, and snaps of every size, a few at a time ---------- */
  const fire = gain(0);
  { const roar = filter("lowpass", 460, 0.6); chain(loop(pink, 0.4), roar, filter("highpass", 100, 0.7), fire); lfo(4.7, 70, roar.frequency); lfo(7.9, 40, roar.frequency);
    chain(loop(white, 3.1), filter("bandpass", 5200, 0.8), gain(0.035, fire)); }
  const crackleOut = gain(0);
  function crackle(t) {
    const pop = Math.random() < 0.1, len = pop ? 0.03 + Math.random() * 0.05 : 0.004 + Math.random() * 0.014;
    const n = ctx.createBufferSource(), g = ctx.createGain(), f = pop ? filter("bandpass", 450 + Math.random() * 900, 1.1) : filter("highpass", 1400 + Math.random() * 3200, 0.7);
    n.buffer = white;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pop ? 0.6 + Math.random() * 0.4 : 0.1 + Math.pow(Math.random(), 2) * 0.6, t + 0.0015); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    chain(n, f, g, crackleOut); n.start(t, Math.random() * 3.5, len + 0.02);
  }

  /* ---------- birds: three kinds of song, each one from somewhere a little different ---------- */
  const birds = gain(0); birds.connect(gain(0.45, air));
  const voice = ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0]), new Float32Array([0, 1, 0.1, 0.03]));     // a whistle with a little body
  function note(out, t, from, to, len, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(), up = Math.min(0.03, len * 0.3);
    o.setPeriodicWave(voice); o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + len);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + up); g.gain.setTargetAtTime(0, t + Math.max(up, len * 0.6), len * 0.14);
    chain(o, g, out); o.start(t); o.stop(t + len + 0.25);
  }
  const SONGS = [
    (out, t) => { const f = 3350 + Math.random() * 380; note(out, t, f * 1.015, f, 0.4, 0.5); note(out, t + 0.5, f * 0.875, f * 0.868, 0.44, 0.45); return 1; },   // two clear notes, the second lower
    (out, t) => { let s = t; for (let k = 2 + ((Math.random() * 4) | 0); k > 0; k--) { note(out, s, 5000 + Math.random() * 500, 3600, 0.045, 0.4); s += 0.16 + Math.random() * 0.22; } return s - t; },   // a few dry chips
    (out, t) => { let s = t; const base = 2150 + Math.random() * 600;                                                                                       // a slow carol, phrase by phrase
      for (let ph = 3 + ((Math.random() * 3) | 0); ph > 0; ph--) { for (let k = 2 + ((Math.random() * 2) | 0); k > 0; k--) { const a = base * (0.88 + Math.random() * 0.3), len = 0.11 + Math.random() * 0.07; note(out, s, a, a * (0.86 + Math.random() * 0.3), len, 0.42); s += len + 0.025; } s += 0.22 + Math.random() * 0.2; }
      return s - t; },
  ];
  function song(t) {
    const far = 0.3 + Math.random() * 0.7, out = gain(far, null), tone = filter("lowpass", 3500 + far * 4500, 0.5);
    out.connect(tone);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 1.6 - 0.8; chain(tone, p, birds); } else tone.connect(birds);
    return SONGS[Math.random() < 0.4 ? 0 : Math.random() < 0.5 ? 1 : 2](out, t);
  }

  /* ---------- the raven: a rough, falling croak ---------- */
  const ravenOut = gain(0.45); ravenOut.connect(gain(0.3, air));
  function caw(t = now() + 0.02) {
    for (let k = 0; k < 2; k++) {
      const s = t + k * 0.36, o = ctx.createOscillator(), g = ctx.createGain(), mouth = gain(1, null), rough = ctx.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(415 * (1 - k * 0.04), s); o.frequency.exponentialRampToValueAtTime(285, s + 0.27);
      const f1 = filter("bandpass", 1100, 3), f2 = filter("bandpass", 1900, 5), breath = ctx.createBufferSource(); breath.buffer = white;
      o.connect(f1); o.connect(f2); f1.connect(mouth); chain(f2, gain(0.4, mouth)); chain(breath, filter("bandpass", 1400, 1.5), gain(0.12, mouth)); breath.start(s, k, 0.32);
      rough.gain.value = 0.6; lfoAt(56, 0.4, rough.gain, s, s + 0.33);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.9, s + 0.035); g.gain.setTargetAtTime(0, s + 0.17, 0.045);
      chain(mouth, rough, g, ravenOut); o.start(s); o.stop(s + 0.36);
    }
  }
  function lfoAt(hz, depth, param, t0, t1) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = hz; g.gain.value = depth; o.connect(g); g.connect(param); o.start(t0); o.stop(t1); }

  let nextCrackle = 0, nextSong = 0, levels = { fire: 0, day: 0 };
  const ramp = (param, v) => param.setTargetAtTime(v, now(), 0.35);
  return {
    master,
    /** how loud each thing should be right now, each 0..1 */
    set({ wind: w = 0, walking = 0, river: r = 0, night = 0, fire: f = 0, day = 0 }) {
      ramp(wind.gain, 0.065 + w * 0.13); ramp(rustle.gain, 0.006 + w * 0.02); ramp(brush.gain, walking * 0.04);
      ramp(river.gain, r * 0.34); ramp(crickets.gain, night * 0.04); ramp(fire.gain, f * 0.24); ramp(crackleOut.gain, f * 0.3); ramp(birds.gain, day * 0.05);
      levels = { fire: f, day };
    },
    /** call this a few times a second: it lines up the next crackles and bird songs */
    tick() {
      const t = now();
      if (levels.fire > 0.05) { while (nextCrackle < t + 0.5) { nextCrackle = Math.max(nextCrackle, t) + 0.015 + Math.pow(Math.random(), 2) * 0.6 / levels.fire; crackle(nextCrackle); } } else nextCrackle = t;
      if (levels.day > 0.2) { if (nextSong < t) nextSong = t + 0.1 + song(t + 0.1) + 4 + Math.random() * 9; } else nextSong = t + 1.5;
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
  s.on = () => { ctx.resume(); s.fade(0.7); };
  s.off = () => { s.fade(0); setTimeout(() => { if (s.master.gain.value < 0.01) ctx.suspend(); }, 1500); };
  return s;
}
