/* same old samsara · the walk · shapes
   Everything in the world is built here from a few primitives. No model files.
   A vertex is 11 numbers: position (3), normal (3), paint (ink, sway, style, glow), part.
   "part" makes the print pass cut a key line between two pieces of the same thing. */

import { INK, STYLE } from "./glsl.js";
import { rng, TAU, lerp, clamp } from "./m.js";

export const STRIDE = 11;
const P = (ink, style = STYLE.NONE, sway = 0, glow = 0) => [ink, sway, style, glow];

export class Geo {
  constructor() { this.v = []; this.i = []; this.n = 0; }
  vert(x, y, z, nx, ny, nz, paint, part = 0) { this.v.push(x, y, z, nx, ny, nz, paint[0], paint[1], paint[2], paint[3], part); return this.n++; }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }

  /** copy another shape in, moved / turned / scaled. order of turns: roll (z), pitch (x), yaw (y). */
  add(g, { pos = [0, 0, 0], yaw = 0, pitch = 0, roll = 0, scale = 1, basis = null, part = null } = {}) {
    const s = typeof scale === "number" ? [scale, scale, scale] : scale;
    let m = basis;
    if (!m) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch), cz = Math.cos(roll), sz = Math.sin(roll);
      // Ry * Rx * Rz, column major
      m = [cy * cz + sy * sx * sz, cx * sz, -sy * cz + cy * sx * sz,
           -cy * sz + sy * sx * cz, cx * cz, sy * sz + cy * sx * cz,
           sy * cx, -sx, cy * cx];
    }
    const base = this.n, v = g.v;
    for (let k = 0; k < v.length; k += STRIDE) {
      const x = v[k] * s[0], y = v[k + 1] * s[1], z = v[k + 2] * s[2];
      let nx = v[k + 3] / s[0], ny = v[k + 4] / s[1], nz = v[k + 5] / s[2];
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      this.v.push(m[0] * x + m[3] * y + m[6] * z + pos[0], m[1] * x + m[4] * y + m[7] * z + pos[1], m[2] * x + m[5] * y + m[8] * z + pos[2],
                  m[0] * nx + m[3] * ny + m[6] * nz, m[1] * nx + m[4] * ny + m[7] * nz, m[2] * nx + m[5] * ny + m[8] * nz,
                  v[k + 6], v[k + 7], v[k + 8], v[k + 9], part === null ? v[k + 10] : part);
    }
    for (const i of g.i) this.i.push(i + base);
    this.n += g.n;
    return this;
  }
  /** set the sway weight of every vertex from its position */
  sway(fn) { for (let k = 0; k < this.v.length; k += STRIDE) this.v[k + 7] = fn(this.v[k], this.v[k + 1], this.v[k + 2], this.v[k + 7]); return this; }
  build() { return { data: new Float32Array(this.v), idx: this.n > 65535 ? new Uint32Array(this.i) : new Uint16Array(this.i), count: this.i.length }; }
}

/* ---------- primitives ---------- */
export function box(sx, sy, sz, paint, part = 0) {
  const g = new Geo(), x = sx / 2, y = sy / 2, z = sz / 2;
  const F = [[[x, -y, -z], [x, y, -z], [x, y, z], [x, -y, z], [1, 0, 0]], [[-x, -y, z], [-x, y, z], [-x, y, -z], [-x, -y, -z], [-1, 0, 0]],
             [[-x, y, -z], [-x, y, z], [x, y, z], [x, y, -z], [0, 1, 0]], [[-x, -y, z], [-x, -y, -z], [x, -y, -z], [x, -y, z], [0, -1, 0]],
             [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1]], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1]]];
  for (const f of F) { const n = f[4], a = f.slice(0, 4).map((p) => g.vert(p[0], p[1], p[2], n[0], n[1], n[2], paint, part)); g.quad(a[0], a[1], a[2], a[3]); }
  return g;
}

/** a tapered tube standing on y = 0 */
export function cyl(r0, r1, h, sides, paint, part = 0, cap = true) {
  const g = new Geo(), slope = (r0 - r1) / h;
  for (let k = 0; k <= sides; k++) {
    const a = (k / sides) * TAU, c = Math.cos(a), s = Math.sin(a), l = Math.hypot(1, slope);
    g.vert(c * r0, 0, s * r0, c / l, slope / l, s / l, paint, part);
    g.vert(c * r1, h, s * r1, c / l, slope / l, s / l, paint, part);
    if (k) { const b = (k - 1) * 2; g.quad(b, b + 1, b + 3, b + 2); }
  }
  if (cap) {
    for (const [y, r, ny] of [[h, r1, 1], [0, r0, -1]]) {
      if (r < 1e-4) continue;
      const c0 = g.vert(0, y, 0, 0, ny, 0, paint, part);
      for (let k = 0; k <= sides; k++) { const a = (k / sides) * TAU; g.vert(Math.cos(a) * r, y, Math.sin(a) * r, 0, ny, 0, paint, part); if (k) (ny > 0 ? g.tri(c0, c0 + k + 1, c0 + k) : g.tri(c0, c0 + k, c0 + k + 1)); }
    }
  }
  return g;
}

/** a tube from point a to point b */
export function tube(a, b, r0, r1, sides, paint, part = 0, cap = true) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(d[0], d[1], d[2]) || 1e-6;
  const y = [d[0] / len, d[1] / len, d[2] / len];
  const up = Math.abs(y[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
  let x = [up[1] * y[2] - up[2] * y[1], up[2] * y[0] - up[0] * y[2], up[0] * y[1] - up[1] * y[0]];
  const xl = Math.hypot(x[0], x[1], x[2]); x = [x[0] / xl, x[1] / xl, x[2] / xl];
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  return new Geo().add(cyl(r0, r1, len, sides, paint, part, cap), { pos: a, basis: [x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]] });
}

/** a flat sheet in the xy plane, facing +z, cut into nx by ny squares */
export function plane(w, h, paint, part = 0, nx = 1, ny = 1) {
  const g = new Geo();
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) g.vert((i / nx - 0.5) * w, (j / ny - 0.5) * h, 0, 0, 0, 1, paint, part);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; g.quad(a, a + 1, a + nx + 2, a + nx + 1); }
  return g;
}

/* icosphere, cached by subdivision level */
const ICO = [];
function ico(sub) {
  if (ICO[sub]) return ICO[sub];
  const t = (1 + Math.sqrt(5)) / 2;
  let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
    .map((p) => { const l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; });
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
           [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < sub; s++) {
    const cache = new Map();
    const mid = (a, b) => {
      const key = a < b ? a * 100000 + b : b * 100000 + a;
      if (cache.has(key)) return cache.get(key);
      const p = [v[a][0] + v[b][0], v[a][1] + v[b][1], v[a][2] + v[b][2]], l = Math.hypot(p[0], p[1], p[2]);
      v.push([p[0] / l, p[1] / l, p[2] / l]); cache.set(key, v.length - 1); return v.length - 1;
    };
    f = f.flatMap(([a, b, c]) => { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]; });
  }
  return (ICO[sub] = { v, f });
}

function h3(x, y, z) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
           L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
}

/** a lumpy ball: leaf masses, stones, bodies. smooth normals are worked out after the lumps are pushed in. */
export function blob(rx, ry, rz, sub, paint, part = 0, { seed = 0, bump = 0, freq = 2.2, flat = 0 } = {}) {
  const { v, f } = ico(sub), g = new Geo(), pts = [];
  for (const d of v) {
    const k = 1 + (bump ? bump * (noise3(d[0] * freq + seed, d[1] * freq + seed * 1.7, d[2] * freq - seed) - 0.5) * 2 : 0);
    let y = d[1] * ry * k;
    if (flat && d[1] < 0) y *= 1 - flat;                    // flatter underneath
    pts.push([d[0] * rx * k, y, d[2] * rz * k]);
  }
  const nor = pts.map(() => [0, 0, 0]);
  for (const [a, b, c] of f) {
    const A = pts[a], B = pts[b], C = pts[c];
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    for (const i of [a, b, c]) { nor[i][0] += n[0]; nor[i][1] += n[1]; nor[i][2] += n[2]; }
  }
  pts.forEach((p, i) => { const n = nor[i], l = Math.hypot(n[0], n[1], n[2]) || 1; g.vert(p[0], p[1], p[2], n[0] / l, n[1] / l, n[2] / l, paint, part); });
  for (const [a, b, c] of f) g.tri(a, b, c);
  return g;
}

/* ---------- trees ---------- */
/** species: 0 maple (round), 1 aspen (tall, pale trunk), 2 hemlock. lod: 0 near, 1 mid, 2 far. */
export function buildTree(species, lod) {
  const g = new Geo(), r = rng(1000 + species * 31 + lod * 7);
  const leaf = P(INK.FOLIAGE, species === 2 ? STYLE.NEEDLE : STYLE.CANOPY);
  if (species === 0) {
    if (lod < 2) g.add(cyl(0.36, 0.2, 5.2, lod ? 5 : 8, P(INK.BARK, STYLE.BARK), 0, false));
    else g.add(cyl(0.34, 0.22, 4.6, 3, P(INK.BARK, STYLE.PLAIN), 0, false));
    if (lod === 0) for (const [a, len] of [[0.7, 2.4], [2.6, 2.1], [4.4, 2.6]]) g.add(tube([0, 3.3, 0], [Math.cos(a) * len, 5.3, Math.sin(a) * len], 0.14, 0.07, 5, P(INK.BARK, STYLE.BARK), 0, false));
    if (lod === 2) g.add(blob(3.5, 3.0, 3.5, 1, leaf, 1, { seed: 3, bump: 0.3, freq: 1.9, flat: 0.45 }), { pos: [0, 6.4, 0] });
    else {
      const sub = lod ? 1 : 2;
      g.add(blob(3.0, 2.5, 3.0, sub, leaf, 1, { seed: 1, bump: 0.2, flat: 0.4 }), { pos: [0, 6.3, 0] });
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + r() * 0.7, rad = 1.9 + r() * 0.5, s = 1.7 + r() * 0.45;
        g.add(blob(s, s * 0.82, s, sub, leaf, 2 + (k % 3), { seed: 5 + k * 3, bump: 0.22, flat: 0.4 }), { pos: [Math.cos(a) * rad, 5.2 + r() * 1.3, Math.sin(a) * rad] });
      }
      g.add(blob(1.9, 1.6, 1.9, sub, leaf, 5, { seed: 40, bump: 0.22, flat: 0.3 }), { pos: [0.3, 8.0, -0.2] });
    }
    g.sway((x, y, z, w) => (y > 3.6 ? clamp((y - 3.6) / 6, 0, 1) * 0.5 + 0.08 : 0));
  } else if (species === 1) {
    g.add(cyl(0.2, 0.1, 7.5, lod === 2 ? 3 : lod ? 5 : 7, P(INK.BARK_PALE, lod === 2 ? STYLE.PLAIN : STYLE.PALE), 0, false));
    if (lod === 2) g.add(blob(1.9, 3.5, 1.9, 1, leaf, 1, { seed: 8, bump: 0.26, freq: 1.8, flat: 0.2 }), { pos: [0, 7.6, 0] });
    else {
      const sub = lod ? 1 : 2;
      for (let k = 0; k < 4; k++) {
        const s = [1.75, 1.9, 1.6, 1.15][k];
        g.add(blob(s, s * 0.95, s, sub, leaf, 1 + k, { seed: 9 + k * 4, bump: 0.22, flat: 0.25 }), { pos: [(r() - 0.5) * 0.9, 5.2 + k * 1.75, (r() - 0.5) * 0.9] });
      }
    }
    g.sway((x, y) => (y > 4 ? clamp((y - 4) / 7, 0, 1) * 0.75 + 0.1 : 0));
  } else {
    const tiers = lod === 2 ? 3 : 6, sides = lod === 2 ? 5 : lod ? 6 : 9, top = 13.5, base = 3.6;
    g.add(cyl(0.32, 0.14, 5.2, lod === 2 ? 3 : 6, P(INK.BARK, lod === 2 ? STYLE.PLAIN : STYLE.BARK), 0, false));
    for (let t = 0; t < tiers; t++) {
      const f = t / tiers, y0 = base + f * (top - base - 1.4), hgt = (top - base) / tiers * 1.6, rb = 3.0 * (1 - f * 0.86);
      const c = new Geo(), tip = c.vert(0, y0 + hgt, 0, 0, 1, 0, leaf, 1 + (t % 5));
      for (let k = 0; k <= sides * 2; k++) {
        const a = (k / (sides * 2)) * TAU + t * 0.5, out = k % 2 ? 1 : 0.72, rr = rb * out, droop = k % 2 ? -0.28 : 0.1;
        const nx = Math.cos(a), nz = Math.sin(a);
        c.vert(nx * rr, y0 + droop * (1 - f * 0.5), nz * rr, nx * 0.75, 0.66, nz * 0.75, leaf, 1 + (t % 5));
        if (k) c.tri(tip, tip + k + 1, tip + k);
      }
      g.add(c);
    }
    if (lod === 0) g.add(tube([0, top - 0.3, 0], [0.5, top + 0.7, 0.15], 0.07, 0.01, 4, leaf, 6, false));   // the tip nods over, the way a hemlock's does
    g.sway((x, y) => (y > 3.4 ? clamp((y - 3.4) / 10, 0, 1) * 0.35 + Math.min(Math.hypot(x) * 0.04, 0.12) : 0));
  }
  return g;
}

/* ---------- things people put there ---------- */
export function gate() {
  const g = new Geo(), wood = P(INK.WOOD, STYLE.PLANK), iron = P(INK.RUST, STYLE.PLAIN);
  for (const x of [-1.9, 1.9]) {
    g.add(box(0.26, 2.4, 0.26, wood, 1), { pos: [x, 1.2, 0] });
    g.add(box(0.36, 0.08, 0.36, wood, 2), { pos: [x, 2.44, 0] });
  }
  // the gate itself, swung open into the land
  const leaf = new Geo();
  for (let k = 0; k < 5; k++) leaf.add(tube([0, 0.32 + k * 0.24, 0], [3.5, 0.32 + k * 0.24, 0], 0.028, 0.028, 5, iron, 3, false));
  for (const x of [0, 1.75, 3.5]) leaf.add(tube([x, 0.26, 0], [x, 1.36, 0], 0.03, 0.03, 5, iron, 3, false));
  leaf.add(tube([0, 0.32, 0], [3.5, 1.28, 0], 0.022, 0.022, 4, iron, 3, false));
  g.add(leaf, { pos: [-1.9, 0, -0.14], yaw: 1.18 });
  return g;
}

export function mailbox() {
  const g = new Geo();
  g.add(box(0.11, 1.12, 0.11, P(INK.WOOD, STYLE.PLANK), 1), { pos: [0, 0.56, 0] });
  g.add(box(0.5, 0.05, 0.16, P(INK.WOOD, STYLE.PLANK), 1), { pos: [0, 1.1, 0.08] });
  g.add(box(0.2, 0.13, 0.5, P(INK.WHITE, STYLE.PLAIN), 2), { pos: [0, 1.2, 0.1] });
  g.add(cyl(0.1, 0.1, 0.5, 10, P(INK.WHITE, STYLE.PLAIN), 2), { pos: [0, 1.265, -0.15], pitch: Math.PI / 2 });
  g.add(box(0.012, 0.05, 0.03, P(INK.PEPPER, STYLE.PLAIN), 3), { pos: [0, 1.26, 0.355] });          // the latch
  // a jar lantern on a hook, for coming home in the dark
  g.add(tube([0, 1.0, -0.02], [0, 1.0, -0.3], 0.012, 0.012, 4, P(INK.PEPPER, STYLE.PLAIN), 3, false));
  g.add(cyl(0.055, 0.055, 0.14, 8, P(INK.LAMP, STYLE.PLAIN, 0, 1), 4), { pos: [0, 0.8, -0.3] });
  g.add(cyl(0.06, 0.02, 0.04, 8, P(INK.PEPPER, STYLE.PLAIN), 3), { pos: [0, 0.94, -0.3] });
  return g;
}
export function mailboxFlag() {      // pivots at its own origin
  const g = new Geo();
  g.add(box(0.014, 0.2, 0.03, P(INK.RUST, STYLE.PLAIN), 5), { pos: [0, 0.1, 0] });
  g.add(box(0.014, 0.075, 0.1, P(INK.RUST, STYLE.PLAIN), 5), { pos: [0, 0.165, -0.055] });
  return g;
}

export function screen() {
  const g = new Geo(), wood = P(INK.WOOD, STYLE.PLANK);
  for (const x of [-1.85, 1.85]) g.add(cyl(0.055, 0.045, 2.75, 6, wood, 1), { pos: [x, 0, 0], roll: x > 0 ? -0.04 : 0.04 });
  g.add(tube([-1.9, 2.66, 0], [1.9, 2.66, 0], 0.012, 0.012, 4, P(INK.PEPPER, STYLE.PLAIN), 2, false));
  const sheet = plane(3.4, 2.05, P(INK.WHITE, STYLE.CLOTH), 3, 10, 6);
  sheet.sway((x, y) => (1 - Math.abs(x) / 1.7) * (0.5 - y / 2.05) * 0.5);        // pinned along the top, loose at the bottom
  g.add(sheet, { pos: [0, 1.62, 0] });
  for (const x of [-1.9, 1.9]) g.add(tube([x, 2.3, 0], [x * 1.9, 0, 1.3], 0.008, 0.008, 3, P(INK.PEPPER, STYLE.PLAIN), 2, false));  // guy lines
  return g;
}

export function tripod() {
  const g = new Geo(), dark = P(INK.PEPPER, STYLE.PLAIN);
  for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + 0.5; g.add(tube([Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5], [0, 1.38, 0], 0.016, 0.02, 4, dark, 1, false)); }
  g.add(cyl(0.03, 0.03, 0.12, 6, dark, 1), { pos: [0, 1.36, 0] });
  g.add(box(0.15, 0.1, 0.09, dark, 2), { pos: [0, 1.53, 0] });
  g.add(cyl(0.042, 0.048, 0.1, 8, dark, 3), { pos: [0, 1.53, 0.04], pitch: Math.PI / 2 });
  g.add(box(0.02, 0.02, 0.01, P(INK.RUST, STYLE.PLAIN, 0, 1), 4), { pos: [0.05, 1.56, 0.047] });   // the record light
  return g;
}

export function camper() {
  const g = new Geo(), skin = P(INK.WHITE), glass = P(INK.WINDOW, STYLE.PLAIN), dark = P(INK.PEPPER, STYLE.PLAIN);
  g.add(box(7.3, 2.55, 2.5, skin, 1), { pos: [-1.25, 2.225, 0] });
  g.add(box(2.5, 1.75, 2.5, skin, 1), { pos: [3.65, 2.625, 0] });
  g.add(box(0.9, 0.9, 2.5, skin, 1), { pos: [4.75, 2.7, 0], roll: 0.5 });                          // the slanted nose
  g.add(box(7.0, 0.36, 2.1, dark, 2), { pos: [-1.1, 0.78, 0] });
  for (const x of [-2.2, -1.25]) for (const z of [-1.13, 1.13]) g.add(cyl(0.38, 0.38, 0.26, 12, dark, 3), { pos: [x, 0.38, z - 0.13], pitch: Math.PI / 2 });
  for (const z of [-0.9, 0.9]) g.add(box(0.12, 1.75, 0.12, dark, 2), { pos: [2.95, 0.875, z] });
  for (const z of [-1.262, 1.262]) {
    g.add(box(7.3, 0.17, 0.02, P(INK.LEAF_DARK, STYLE.PLAIN), 4), { pos: [-1.25, 1.56, z] });
    g.add(box(7.3, 0.07, 0.02, P(INK.RUST, STYLE.PLAIN), 5), { pos: [-1.25, 1.37, z] });
  }
  // windows. after dark these are the lit ones.
  for (const [x, y, w, h, z] of [[-3.5, 2.4, 1.25, 0.75, 1.265], [-1.75, 2.4, 1.0, 0.75, 1.265], [3.6, 2.8, 1.0, 0.55, 1.265],
                                  [-3.2, 2.4, 1.3, 0.7, -1.265], [-0.9, 2.4, 1.3, 0.7, -1.265], [3.6, 2.8, 1.0, 0.55, -1.265]])
    g.add(box(w, h, 0.03, glass, 6), { pos: [x, y, z] });
  g.add(box(0.03, 0.75, 1.5, glass, 6), { pos: [-4.91, 2.45, 0] });
  // the door, the steps
  g.add(box(0.76, 1.95, 0.04, P(INK.CREAM, STYLE.PLAIN), 7), { pos: [0.55, 1.93, 1.27] });
  g.add(box(0.4, 0.45, 0.02, glass, 6), { pos: [0.55, 2.45, 1.295] });
  g.add(box(0.85, 0.05, 0.32, dark, 2), { pos: [0.55, 0.66, 1.45] });
  g.add(box(0.85, 0.05, 0.32, dark, 2), { pos: [0.55, 0.34, 1.74] });
  // the awning, its arms, and a string of lights along its edge
  const cloth = plane(5.0, 2.62, P(INK.CREAM, STYLE.CLOTH), 3, 6, 3);
  cloth.sway((x, y) => (0.5 - y / 2.62) * 0.12);
  g.add(cloth, { pos: [-1.1, 2.88, 2.46], pitch: -1.235 });
  for (const x of [-3.6, 1.4]) g.add(tube([x, 1.25, 1.28], [x, 2.47, 3.68], 0.022, 0.022, 4, dark, 2, false));
  g.add(box(5.0, 0.07, 0.07, P(INK.RUST, STYLE.PLAIN), 5), { pos: [-1.1, 2.46, 3.7] });
  for (let k = 0; k < 11; k++) g.add(blob(0.045, 0.06, 0.045, 0, P(INK.LAMP, STYLE.PLAIN, 0, 1), 4), { pos: [-3.5 + k * 0.48, 2.34 - Math.sin((k / 10) * Math.PI) * 0.07, 3.72] });
  g.add(box(0.95, 0.28, 0.85, skin, 1), { pos: [-1.4, 3.64, 0] });                                 // the roof unit
  return g;
}

export function table() {
  const g = new Geo(), wood = P(INK.WOOD, STYLE.PLANK), dark = P(INK.PEPPER, STYLE.PLAIN);
  g.add(box(1.7, 0.045, 0.78, wood, 1), { pos: [0, 0.75, 0] });
  for (const x of [-0.72, 0.72]) for (const z of [-0.3, 0.3]) g.add(tube([x, 0, z], [x * 0.92, 0.73, z * 0.9], 0.018, 0.018, 4, dark, 2, false));
  // what is on it: a pattern chart, trays of beads, a mug gone cold
  g.add(box(0.36, 0.006, 0.46, P(INK.WHITE, STYLE.PLAIN), 3), { pos: [-0.38, 0.777, 0.02], yaw: 0.2 });
  const beads = [INK.BEAD0, INK.BEAD1, INK.BEAD2, INK.BEAD3, INK.BEAD4, INK.BEAD5];
  for (let k = 0; k < 6; k++) g.add(box(0.11, 0.03, 0.11, P(beads[k], STYLE.PLAIN, 0, 0.85), 4 + (k % 3)), { pos: [0.12 + (k % 3) * 0.14, 0.79, -0.12 + ((k / 3) | 0) * 0.14] });
  g.add(cyl(0.04, 0.045, 0.1, 8, P(INK.RUST, STYLE.PLAIN), 7), { pos: [0.66, 0.775, 0.2] });
  return g;
}

export function chair(ink = INK.LEAF_DARK) {
  const g = new Geo(), dark = P(INK.PEPPER, STYLE.PLAIN), cloth = P(ink, STYLE.CLOTH);
  for (const x of [-0.27, 0.27]) {
    g.add(tube([x, 0, 0.26], [x, 0.9, -0.3], 0.014, 0.014, 4, dark, 1, false));
    g.add(tube([x, 0, -0.26], [x, 0.52, 0.28], 0.014, 0.014, 4, dark, 1, false));
  }
  g.add(plane(0.54, 0.5, cloth, 2, 2, 2), { pos: [0, 0.44, 0.02], pitch: -Math.PI / 2 + 0.16 });
  g.add(plane(0.54, 0.5, cloth, 3, 2, 2), { pos: [0, 0.72, -0.22], pitch: -0.3 });
  return g;
}

export function truck() {
  const g = new Geo(), body = P(INK.STONE), glass = P(INK.WINDOW, STYLE.PLAIN), dark = P(INK.PEPPER, STYLE.PLAIN);
  g.add(box(5.7, 0.78, 1.95, body, 1), { pos: [0, 0.86, 0] });
  g.add(box(2.0, 0.74, 1.8, body, 1), { pos: [0.55, 1.6, 0] });
  for (const z of [-0.905, 0.905]) g.add(box(1.6, 0.46, 0.02, glass, 2), { pos: [0.55, 1.66, z] });
  g.add(box(0.02, 0.5, 1.56, glass, 2), { pos: [1.555, 1.66, 0] });
  g.add(box(0.02, 0.44, 1.5, glass, 2), { pos: [-0.455, 1.68, 0] });
  for (const x of [-1.9, 1.85]) for (const z of [-0.9, 0.9]) g.add(cyl(0.42, 0.42, 0.28, 12, dark, 3), { pos: [x, 0.42, z - 0.14], pitch: Math.PI / 2 });
  g.add(box(0.06, 0.16, 1.7, dark, 3), { pos: [2.87, 0.72, 0] });
  g.add(box(0.06, 0.16, 1.7, dark, 3), { pos: [-2.87, 0.72, 0] });
  return g;
}

export function fireRing() {
  const g = new Geo(), r = rng(77);
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * TAU, s = 0.17 + r() * 0.07;
    g.add(blob(s, s * 0.7, s * 1.15, 1, P(INK.STONE, STYLE.STONE), 1 + (k % 4), { seed: k, bump: 0.2 }), { pos: [Math.cos(a) * 0.78, 0.09, Math.sin(a) * 0.78], yaw: a });
  }
  g.add(cyl(0.66, 0.66, 0.03, 12, P(INK.PEPPER, STYLE.STONE), 5), { pos: [0, 0.005, 0] });
  for (let k = 0; k < 4; k++) { const a = k * 0.8 + 0.3; g.add(tube([Math.cos(a) * 0.5, 0.08, Math.sin(a) * 0.5], [-Math.cos(a) * 0.25, 0.34, -Math.sin(a) * 0.25], 0.07, 0.06, 6, P(INK.BARK, STYLE.BARK), 6)); }
  return g;
}
export function flames() {
  const g = new Geo(), r = rng(5);
  for (let k = 0; k < 9; k++) {
    const a = r() * TAU, d = r() * 0.3, h = 0.6 + r() * 0.75, w = 0.14 + r() * 0.13;
    const f = cyl(w, 0.0, h, 5, P(k % 3 ? INK.FLAME : INK.EMBER, STYLE.PLAIN, 1, 1), 1 + (k % 3), false);
    f.sway((x, y) => (y / h) * 0.9);
    g.add(f, { pos: [Math.cos(a) * d, 0.12, Math.sin(a) * d] });
  }
  return g;
}

/** the old apple tree. low, wide, nobody prunes it. */
export function appleTree() {
  const g = new Geo(), bark = P(INK.BARK, STYLE.BARK), leaf = P(INK.LEAF, STYLE.CANOPY), r = rng(31);
  g.add(tube([0, 0, 0], [0.25, 1.5, 0.1], 0.36, 0.27, 9, bark, 0, false));
  const limbs = [[1.9, 2.9, 0.5], [-1.7, 3.0, 0.9], [0.3, 3.1, -1.9], [-0.6, 2.7, 1.9], [1.4, 3.2, -1.3]];
  for (const l of limbs) g.add(tube([0.25, 1.45, 0.1], l, 0.2, 0.08, 6, bark, 0, false));
  const crowns = [[1.9, 3.4, 0.5, 1.7], [-1.7, 3.5, 0.9, 1.75], [0.3, 3.7, -1.9, 1.7], [-0.6, 3.3, 1.9, 1.6], [1.4, 3.8, -1.3, 1.5], [0, 4.3, 0, 1.9], [-1.6, 3.9, -1.2, 1.4]];
  crowns.forEach(([x, y, z, s], k) => g.add(blob(s, s * 0.66, s, 2, leaf, 1 + (k % 5), { seed: 50 + k * 3, bump: 0.24, flat: 0.5 }), { pos: [x, y, z] }));
  for (let k = 0; k < 16; k++) {                           // a few small sour apples
    const a = r() * TAU, d = 1 + r() * 2.1;
    g.add(blob(0.065, 0.06, 0.065, 0, P(INK.RUST, STYLE.PLAIN), 6), { pos: [Math.cos(a) * d, 2.75 + r() * 0.5, Math.sin(a) * d] });
  }
  g.sway((x, y) => (y > 2.6 ? clamp((y - 2.6) / 3, 0, 1) * 0.4 + 0.06 : 0));
  return g;
}
/** the earrings in the apple tree: strands of beads that swing. the only loud colour in the whole print. */
export function beadStrands() {
  const g = new Geo(), r = rng(9), inks = [INK.BEAD0, INK.BEAD1, INK.BEAD2, INK.BEAD3, INK.BEAD4, INK.BEAD5];
  const spots = [];
  for (let k = 0; k < 26; k++) { const a = (k / 26) * TAU + r() * 0.3, d = 0.9 + r() * 2.1; spots.push([Math.cos(a) * d, 2.72 + r() * 0.2, Math.sin(a) * d]); }
  spots.forEach(([x, top, z], k) => {
    const n = 5 + ((r() * 5) | 0), size = 0.052 + r() * 0.014, start = (r() * 6) | 0, s = new Geo();
    s.add(tube([0, 0, 0], [0, -0.12, 0], 0.004, 0.004, 3, P(INK.PEPPER, STYLE.PLAIN), 1, false));
    for (let b = 0; b < n; b++) s.add(blob(size, size, size, 0, P(inks[(start + b) % 6], STYLE.PLAIN, 0, 0.9), 2 + (b % 5)), { pos: [0, -0.14 - b * size * 1.9, 0] });
    // the drop at the end: a little beaded diamond
    const y0 = -0.14 - n * size * 1.9 - 0.02, w = 0.09 + r() * 0.035, ink = P(inks[(start + 2) % 6], STYLE.PLAIN, 0, 0.9), ink2 = P(inks[(start + 4) % 6], STYLE.PLAIN, 0, 0.9);
    const a = s.vert(0, y0, 0, 0, 0, 1, ink, 7), b2 = s.vert(-w, y0 - w * 1.3, 0, 0, 0, 1, ink, 7), c = s.vert(w, y0 - w * 1.3, 0, 0, 0, 1, ink, 7), d = s.vert(0, y0 - w * 2.9, 0, 0, 0, 1, ink2, 7);
    s.tri(a, b2, c); s.tri(b2, d, c);
    s.sway((px, py) => -py * 1.6);                         // the lower on the strand, the more it swings
    g.add(s, { pos: [x, top, z], yaw: r() * TAU });
  });
  return g;
}

export function shed() {
  const g = new Geo(), wall = P(INK.WOOD, STYLE.PLANK), tin = P(INK.RUST, STYLE.TIN);
  g.add(box(3.7, 2.2, 2.7, wall, 1), { pos: [0, 1.1, 0] });
  // gable ends
  for (const x of [-1.85, 1.85]) {
    const n = x > 0 ? 1 : -1, a = g.vert(x, 2.2, -1.35, n, 0, 0, wall, 1), b = g.vert(x, 2.2, 1.35, n, 0, 0, wall, 1), c = g.vert(x, 3.15, 0, n, 0, 0, wall, 1);
    n > 0 ? g.tri(a, c, b) : g.tri(a, b, c);
  }
  // the tin roof, two slopes with an overhang
  for (const s of [-1, 1]) {
    const len = Math.hypot(1.65, 1.05), roof = plane(4.3, len, tin, s > 0 ? 2 : 3, 1, 1);
    g.add(roof, { pos: [0, 2.2 + 0.95 / 2 - 0.02, s * 0.76], pitch: s * (-Math.PI / 2 + Math.atan2(1.05, 1.65)) , yaw: s > 0 ? 0 : Math.PI });
  }
  g.add(box(0.95, 1.8, 0.05, P(INK.PEPPER, STYLE.PLAIN), 4), { pos: [-0.5, 0.9, 1.36] });           // the doorway
  g.add(box(0.6, 0.5, 0.05, P(INK.WINDOW, STYLE.PLAIN), 5), { pos: [1.0, 1.45, 1.36] });
  return g;
}

export function mossyLog() {
  const g = new Geo(), r = rng(12);
  g.add(tube([-2.4, 0.3, 0], [2.3, 0.26, 0.15], 0.36, 0.3, 10, P(INK.BARK, STYLE.BARK), 1, false));
  g.add(cyl(0.36, 0.36, 0.02, 10, P(INK.WOOD, STYLE.STONE), 2), { pos: [-2.4, 0.3, 0], roll: Math.PI / 2 });
  g.add(cyl(0.3, 0.3, 0.02, 10, P(INK.WOOD, STYLE.STONE), 2), { pos: [2.32, 0.26, 0.15], roll: -Math.PI / 2 });
  for (let k = 0; k < 6; k++) { const x = -2 + k * 0.75 + r() * 0.3; g.add(blob(0.42 + r() * 0.2, 0.11, 0.3, 1, P(INK.MOSS, STYLE.CANOPY), 3, { seed: k, bump: 0.3 }), { pos: [x, 0.6, 0.02 + r() * 0.1] }); }
  for (let k = 0; k < 7; k++) {                             // mushrooms. we are not naming them.
    const x = -1.8 + r() * 3.6, z = 0.2 + r() * 0.2, h = 0.1 + r() * 0.1, y = 0.45;
    g.add(cyl(0.018, 0.014, h, 5, P(INK.CREAM, STYLE.PLAIN), 4, false), { pos: [x, y, z], roll: (r() - 0.5) * 0.5 });
    g.add(blob(0.07, 0.035, 0.07, 1, P(k % 3 ? INK.CREAM : INK.RUST, STYLE.PLAIN), 5, { flat: 0.8 }), { pos: [x, y + h, z] });
  }
  return g;
}

export function trailCam() {
  const g = new Geo();
  g.add(box(0.11, 0.15, 0.07, P(INK.LEAF_DARK, STYLE.PLAIN), 1), { pos: [0, 0, 0.05] });
  g.add(cyl(0.022, 0.022, 0.012, 8, P(INK.PEPPER, STYLE.PLAIN), 2), { pos: [0, 0.03, 0.085], pitch: Math.PI / 2 });
  g.add(box(0.07, 0.03, 0.01, P(INK.PEPPER, STYLE.PLAIN), 2), { pos: [0, -0.035, 0.088] });
  g.add(box(0.5, 0.03, 0.5, P(INK.PEPPER, STYLE.PLAIN), 3), { pos: [0, 0, -0.2] });                 // the strap round the trunk
  g.add(box(0.012, 0.012, 0.01, P(INK.EMBER, STYLE.PLAIN, 0, 1), 4), { pos: [0.035, 0.055, 0.088] });
  return g;
}

export function riverRocks() {
  const g = new Geo(), r = rng(4);
  for (let k = 0; k < 9; k++) {
    const s = 0.45 + r() * 0.9;
    g.add(blob(s, s * 0.5, s * 0.8, 1, P(INK.STONE, STYLE.STONE), 1 + (k % 5), { seed: k * 2, bump: 0.25, flat: 0.3 }), { pos: [(r() - 0.5) * 16, 0.05, (r() - 0.5) * 5], yaw: r() * 3 });
  }
  return g;
}

/** four stakes and some flagging tape: where the house goes, someday */
export function stakes() {
  const g = new Geo();
  for (const [x, z] of [[-4, -3], [4, -3], [4, 3], [-4, 3]]) {
    g.add(box(0.05, 0.9, 0.05, P(INK.WOOD, STYLE.PLAIN), 1), { pos: [x, 0.45, z] });
    const tape = plane(0.3, 0.07, P(INK.RUST, STYLE.PLAIN, 0, 0.6), 2, 2, 1); tape.sway((px) => (px + 0.15) * 2.5);
    g.add(tape, { pos: [x + 0.16, 0.84, z] });
  }
  return g;
}

export function fencePost() { return new Geo().add(cyl(0.07, 0.06, 1.25, 5, P(INK.WOOD, STYLE.PLANK), 1), { roll: 0.03 }); }

/** the raven. body here, wings separate so they can beat. faces +z. */
export function ravenBody() {
  const g = new Geo(), ink = P(INK.RAVEN, STYLE.PLAIN, 0, -1);      // glow -1: firelight leaves the raven alone
  g.add(blob(0.11, 0.115, 0.25, 2, ink, 1), { pos: [0, 0, 0], pitch: -0.22 });
  g.add(blob(0.075, 0.075, 0.09, 1, ink, 1), { pos: [0, 0.1, 0.23] });
  g.add(cyl(0.036, 0.004, 0.15, 6, P(INK.PEPPER, STYLE.PLAIN, 0, -1), 2, false), { pos: [0, 0.095, 0.3], pitch: Math.PI / 2 + 0.12 });
  // tail: a wedge
  const a = g.vert(0, -0.03, -0.2, 0, 1, 0, ink, 1), b = g.vert(-0.1, -0.07, -0.52, 0, 1, 0, ink, 1), c = g.vert(0.1, -0.07, -0.52, 0, 1, 0, ink, 1), d = g.vert(0, -0.08, -0.58, 0, 1, 0, ink, 1);
  g.tri(a, b, c); g.tri(b, d, c);
  for (const x of [-0.045, 0.045]) g.add(tube([x, -0.09, 0.02], [x, -0.24, 0.05], 0.011, 0.009, 4, P(INK.PEPPER, STYLE.PLAIN, 0, -1), 2, false));
  return g;
}
export function ravenWing(side) {      // root at the origin, reaching out along x
  const g = new Geo(), ink = P(INK.RAVEN, STYLE.PLAIN, 0, -1), s = side;
  const pts = [[0, 0, 0.12], [0.3 * s, 0.02, 0.17], [0.62 * s, 0, 0.08], [0.78 * s, -0.01, -0.06], [0.6 * s, 0, -0.16], [0.36 * s, 0, -0.2], [0.14 * s, 0, -0.22], [0, 0, -0.14]];
  const c = g.vert(0.3 * s, 0.01, -0.02, 0, 1, 0, [ink[0], -0.14, ink[2], ink[3]], 3);
  pts.forEach((p) => g.vert(p[0], p[1], p[2], 0, 1, 0, [ink[0], -Math.abs(p[0]) * 0.62, ink[2], ink[3]], 3));
  for (let k = 0; k < pts.length; k++) g.tri(c, c + 1 + k, c + 1 + ((k + 1) % pts.length));
  return g;
}

/** a raccoon, mostly tail, looking round a trunk */
export function raccoon() {
  const g = new Geo(), fur = P(INK.STONE, STYLE.NONE), dark = P(INK.PEPPER, STYLE.PLAIN);
  g.add(blob(0.2, 0.19, 0.3, 1, fur, 1, { bump: 0.08 }), { pos: [0, 0.24, 0] });
  g.add(blob(0.13, 0.115, 0.13, 1, fur, 2), { pos: [0, 0.4, 0.27] });
  g.add(box(0.2, 0.045, 0.06, dark, 3), { pos: [0, 0.415, 0.375] });                                // the mask
  g.add(cyl(0.035, 0.012, 0.09, 5, dark, 3, false), { pos: [0, 0.37, 0.38], pitch: Math.PI / 2 });
  for (const x of [-0.085, 0.085]) g.add(cyl(0.04, 0.0, 0.07, 4, fur, 2, false), { pos: [x, 0.49, 0.26] });
  for (let k = 0; k < 6; k++) g.add(cyl(0.062 - k * 0.006, 0.058 - k * 0.006, 0.075, 7, k % 2 ? dark : fur, 4 + (k % 2), false), { pos: [0.1, 0.18 + k * 0.035, -0.3 - k * 0.062], pitch: -1.1 });
  return g;
}

/** one goose, for the V going south */
export function goose() {
  const g = new Geo(), ink = P(INK.RAVEN, STYLE.PLAIN);
  g.add(blob(0.1, 0.09, 0.3, 0, ink, 1), {});
  g.add(tube([0, 0.02, 0.25], [0, 0.05, 0.62], 0.035, 0.028, 4, ink, 1));
  return g;
}
export function gooseWing(side) {
  const g = new Geo(), ink = P(INK.RAVEN, STYLE.PLAIN), s = side;
  const a = g.vert(0, 0, 0.12, 0, 1, 0, ink, 2), b = g.vert(0.75 * s, 0, 0.0, 0, 1, 0, [ink[0], -0.42, ink[2], ink[3]], 2), c = g.vert(0, 0, -0.12, 0, 1, 0, ink, 2);
  g.tri(a, b, c);
  return g;
}
