/* same old samsara · the walk · the ground
   MADE UP GROUND. Nothing in this file comes from the real land: no survey, no lidar, no map, no coordinates.
   It is a formula for a meadow on a bench above a river, with woods around it and one loop trail,
   in the spirit of the place and in nobody's shape. Units are metres. "Up the page" is -z. */

import { smooth, lerp, fbm, vnoise, hash2, rng, catmull, clamp } from "./m.js";

export const WATER_Y = -22;
export const EYE = 1.62;                       // how high the camera rides above the trail
export const EXTENT = 440;                     // the ground mesh runs from -EXTENT to +EXTENT

/* ---------- the river and the road ---------- */
export const riverZ = (x) => -160 + 16 * Math.sin(x * 0.016 + 0.6) + 7 * Math.sin(x * 0.043 + 2.1);
export const roadZ = (x) => 131 + (x > 0 ? -0.0011 * x * x : 0.0004 * x * x);

/* ---------- the shape of the ground, before the trail is cut into it ---------- */
function rawHeight(x, z) {
  const d = z - riverZ(x);                     // + is our side of the river
  const roll = (fbm(x * 0.011 + 3.1, z * 0.011 - 1.7, 4) - 0.5) * 2;
  let h;
  if (d >= 0) {
    const s1 = smooth(12, 60, d), s2 = smooth(55, 108, d);          // bank, a bench half way up, then the meadow
    h = WATER_Y - 1.4 + 2.8 * smooth(3, 11, d) + 9 * s1 + (-WATER_Y - 1.4 - 9) * s2;
    h += roll * (0.6 + 1.9 * s2);
    // low hills around the meadow so the horizon is never a ruler line
    const rim = Math.max(smooth(170, 430, z) * 34, smooth(125, 420, x) * 40, smooth(130, 420, -x) * 44);
    h += rim * smooth(20, 120, d) * (0.75 + 0.5 * vnoise(x * 0.006 + 9, z * 0.006 + 4));
    h -= 2.2 * Math.exp(-((z - 152) ** 2) / 260) * smooth(-60, 20, 200 - Math.abs(x));   // a dip past the road
  } else {
    h = WATER_Y - 1.4 + 2.4 * smooth(3, 10, -d) + 66 * smooth(9, 210, -d);
    h += roll * (0.6 + 3.2 * smooth(10, 120, -d));
  }
  h += 3.4 * Math.exp(-((x + 46) ** 2 + (z - 34) ** 2) / (2 * 22 * 22));                // the knoll with the lone tree
  return h;
}

function withRoad(x, z) {
  let h = rawHeight(x, z);
  const rz = roadZ(x), dr = Math.abs(z - rz);
  if (dr < 10) h = lerp(h, rawHeight(x, rz), 1 - smooth(3.6, 10, dr));
  return h;
}

/* ---------- the trail: a loop from the gate, around, and back ---------- */
const R = riverZ;
/** control points [x, z, stop name?]. the walk does not wrap, it ends a few steps from where it starts. */
const CONTROL = [
  [-2.4, 127, "gate"],          // on the shoulder of the road, looking in
  [0, 118],                     // through the gate
  [-1, 104],
  [-6, 86],
  [-9, 72, "films"],            // the bedsheet screen is off to the left
  [-5, 54],
  [8, 40],
  [22, 26, "make"],             // the table under the awning
  [20, 8],
  [5, -10, "jewelry"],          // the old apple tree
  [3, -30],
  [-3, -52],                    // into the woods
  [-14, -74],
  [-19, -97, "field-guide"],    // the bench half way down
  [-12, -120],
  [2, R(2) + 12],
  [20, R(20) + 11, "land"],     // the river
  [40, R(40) + 13],
  [58, -124],
  [70, -100],
  [73, -74],
  [68, -48],
  [58, -22],
  [45, 2],
  [37, 26, "follow"],           // the fire
  [34, 54],
  [28, 80],
  [18, 100],
  [8, 111],
  [1, 117],                     // back through the gate
  [2, 122.5, "say-hi"],         // the mailbox
  [1, 126.5, "road"],           // and the road
];

const STEP = 0.5;                               // metres between trail samples
function buildTrail() {
  // dense catmull-rom, then resample to even steps
  const pts = [];
  const P = (i) => CONTROL[clamp(i, 0, CONTROL.length - 1)];
  for (let i = 0; i < CONTROL.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < 40; k++) {
      const t = k / 40;
      pts.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t), i + t]);
    }
  }
  const last = CONTROL[CONTROL.length - 1];
  pts.push([last[0], last[1], CONTROL.length - 1]);
  const xs = [pts[0][0]], zs = [pts[0][1]], us = [pts[0][2]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    let ax = pts[i - 1][0], az = pts[i - 1][1], au = pts[i - 1][2];
    const bx = pts[i][0], bz = pts[i][1], bu = pts[i][2];
    let seg = Math.hypot(bx - ax, bz - az);
    while (carry + seg >= STEP) {
      const t = (STEP - carry) / seg;
      ax = lerp(ax, bx, t); az = lerp(az, bz, t); au = lerp(au, bu, t);
      xs.push(ax); zs.push(az); us.push(au);
      seg = Math.hypot(bx - ax, bz - az); carry = 0;
    }
    carry += seg;
  }
  const n = xs.length;
  // ride height: the ground under the trail, smoothed so the camera does not bob
  const rawY = new Float32Array(n);
  for (let i = 0; i < n; i++) rawY[i] = withRoad(xs[i], zs[i]);
  const y = new Float32Array(n), W = 14;
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let k = -W; k <= W; k++) { const j = clamp(i + k, 0, n - 1), w = W + 1 - Math.abs(k); s += rawY[j] * w; c += w; }
    y[i] = s / c;
  }
  // where each named stop sits along the trail (in samples)
  const stops = {};
  CONTROL.forEach((c, ci) => {
    if (!c[2]) return;
    let best = 0, bd = 1e9;
    for (let i = 0; i < n; i++) { const dd = Math.abs(us[i] - ci); if (dd < bd) { bd = dd; best = i; } }
    stops[c[2]] = best;
  });
  return { x: Float32Array.from(xs), z: Float32Array.from(zs), y, n, stops, length: (n - 1) * STEP };
}
export const trail = buildTrail();

/* a grid of "how far is the trail from here", so planting and ground shaping stay cheap */
const GRID = (() => {
  const cell = 0.75, pad = 24;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < trail.n; i++) { x0 = Math.min(x0, trail.x[i]); x1 = Math.max(x1, trail.x[i]); z0 = Math.min(z0, trail.z[i]); z1 = Math.max(z1, trail.z[i]); }
  x0 -= pad; z0 -= pad; x1 += pad; z1 += pad;
  const w = Math.ceil((x1 - x0) / cell) + 1, h = Math.ceil((z1 - z0) / cell) + 1;
  const dist = new Float32Array(w * h).fill(99), idx = new Int32Array(w * h);
  const r = Math.ceil(pad / cell);
  for (let i = 0; i < trail.n; i++) {
    const cx = Math.round((trail.x[i] - x0) / cell), cz = Math.round((trail.z[i] - z0) / cell);
    for (let dz = -r; dz <= r; dz++) {
      const gz = cz + dz; if (gz < 0 || gz >= h) continue;
      for (let dx = -r; dx <= r; dx++) {
        const gx = cx + dx; if (gx < 0 || gx >= w) continue;
        const d = Math.hypot(x0 + gx * cell - trail.x[i], z0 + gz * cell - trail.z[i]);
        const c = gz * w + gx;
        if (d < dist[c]) { dist[c] = d; idx[c] = i; }
      }
    }
  }
  return { cell, x0, z0, w, h, dist, idx };
})();

/** distance from (x, z) to the trail, in metres (99 when it is far away) */
export function trailDist(x, z) {
  const fx = (x - GRID.x0) / GRID.cell, fz = (z - GRID.z0) / GRID.cell;
  if (fx < 0 || fz < 0 || fx >= GRID.w - 1 || fz >= GRID.h - 1) return 99;
  const ix = fx | 0, iz = fz | 0, u = fx - ix, v = fz - iz, c = iz * GRID.w + ix;
  const a = GRID.dist[c], b = GRID.dist[c + 1], d = GRID.dist[c + GRID.w], e = GRID.dist[c + GRID.w + 1];
  return a + (b - a) * u + (d - a) * v + (a - b - d + e) * u * v;
}
/** true where the trail is the two rut track in from the gate (the rest is a mown footpath) */
export function onTrack(x, z) {
  const i = trailNearest(x, z);
  return i >= 0 && (i < trail.stops.make + 14 || i > trail.stops["say-hi"] - 50);
}
function trailNearest(x, z) {
  const ix = Math.round((x - GRID.x0) / GRID.cell), iz = Math.round((z - GRID.z0) / GRID.cell);
  if (ix < 0 || iz < 0 || ix >= GRID.w || iz >= GRID.h) return -1;
  return GRID.idx[iz * GRID.w + ix];
}

/* ---------- things that stand on the ground (all invented positions) ---------- */
export const PLACES = {
  gateL: [-1.9, 118], gateR: [1.9, 118],
  mailbox: [5.4, 126.4],
  screen: [-19, 63],            // the bedsheet, facing the trail
  tripod: [-13.2, 68.4],
  camper: [9, 17],
  table: [10.7, 19.7],
  truck: [27.5, 5.5],
  fire: [29.5, 25.5],
  apple: [-2, -18],
  shed: [21, -41],
  loneTree: [-46, 34],
  stakes: [-38, 27],            // the house site, someday
  log: [-25.5, -100.5],
  camTree: [-28.5, -98],
  riverRock: [9, R(9) + 5.2],
};
const PADS = [                  // level patches [x, z, radius]
  [PLACES.camper[0], PLACES.camper[1], 11], [PLACES.shed[0], PLACES.shed[1], 6], [PLACES.fire[0], PLACES.fire[1], 5],
  [PLACES.screen[0], PLACES.screen[1], 5], [PLACES.truck[0], PLACES.truck[1], 5],
];
const PAD_Y = PADS.map((p) => withRoad(p[0], p[1]));
/** mown or trodden patches, where the goldenrod is kept short [x, z, radius] */
export const CLEARINGS = [
  [-15, 66, 8.5], [11, 19, 11.5], [27.5, 5.5, 6], [29.5, 25.5, 6.5], [34, 26, 4], [-2, -18, 7.5], [21, -41, 6], [-40, 29, 4], [1, 121, 5.5],
];

/** the finished ground: the raw shape, the road, the level pads, and the trail benched in */
export function height(x, z) {
  let h = withRoad(x, z);
  for (let i = 0; i < PADS.length; i++) {
    const p = PADS[i], d = Math.hypot(x - p[0], z - p[1]);
    if (d < p[2]) h = lerp(h, PAD_Y[i], 1 - smooth(p[2] * 0.55, p[2], d));
  }
  const i = trailNearest(x, z);
  if (i >= 0) {
    const d = trailDist(x, z);
    if (d < 6.5) h = lerp(h, trail.y[i], 1 - smooth(1.5, 6.5, d));
  }
  return h;
}

export function normalAt(x, z, e = 0.7) {
  const hx = height(x + e, z) - height(x - e, z), hz = height(x, z + e) - height(x, z - e);
  const l = Math.hypot(hx, 2 * e, hz);
  return [-hx / l, (2 * e) / l, -hz / l];
}

/** point on the trail at s samples (fractional): position of the ground under your feet */
export function trailAt(s) {
  s = clamp(s, 0, trail.n - 1.001);
  const i = s | 0, t = s - i;
  return [lerp(trail.x[i], trail.x[i + 1], t), lerp(trail.y[i], trail.y[i + 1], t), lerp(trail.z[i], trail.z[i + 1], t)];
}

/* ---------- what grows where ---------- */
export function woodsAmt(x, z) {
  const d = z - riverZ(x);
  if (Math.abs(d) < 8.5 || (d > 0 && d < 12.5)) return 0;                  // the water and the gravel bar
  const n = fbm(x * 0.02 + 7, z * 0.02 + 3, 3) - 0.5;
  let w = 1 - smooth(98 + 30 * n, 110 + 30 * n, d);                       // the slope to the river, and across it
  w = Math.max(w, smooth(96 + 36 * n, 110 + 36 * n, x), smooth(92 + 36 * n, 106 + 36 * n, -x));
  w = Math.max(w, smooth(170 + 44 * n, 188 + 44 * n, z));                 // past the road
  if (Math.abs(z - roadZ(x)) < 7) w = 0;
  return w;
}
function inClearing(x, z, grow = 0) {
  for (const c of CLEARINGS) if ((x - c[0]) ** 2 + (z - c[1]) ** 2 < (c[2] + grow) ** 2) return true;
  return false;
}
export function clearingAmt(x, z) {
  let m = 0;
  for (const c of CLEARINGS) m = Math.max(m, 1 - smooth(c[2] - 1.6, c[2] + 0.4, Math.hypot(x - c[0], z - c[1])));
  return m;
}

/** the ground mesh: a square grid, fine near the trail and coarse far away */
export function buildGround(N = 220) {
  const L = EXTENT, c = 0.42;
  const warp = (u) => L * (c * u + (1 - c) * u * u * u);
  const side = N + 1;
  const pos = new Float32Array(side * side * 3), nor = new Float32Array(side * side * 3), mask = new Float32Array(side * side * 4);
  for (let j = 0; j < side; j++) {
    const z = warp((j / N) * 2 - 1);
    for (let i = 0; i < side; i++) {
      const x = warp((i / N) * 2 - 1), k = j * side + i;
      const y = height(x, z), n = normalAt(x, z, 0.9);
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      nor[k * 3] = n[0]; nor[k * 3 + 1] = n[1]; nor[k * 3 + 2] = n[2];
      const d = z - riverZ(x), w = woodsAmt(x, z);
      const gravel = Math.max(1 - smooth(8.5, 13.5, Math.abs(d)), 1 - smooth(2.6, 4.4, Math.abs(z - roadZ(x))));
      mask[k * 4] = (1 - w) * (1 - gravel);                               // meadow
      mask[k * 4 + 1] = w;                                                // woods floor
      mask[k * 4 + 2] = Math.max(clearingAmt(x, z), 1 - smooth(0.9, 2.6, trailDist(x, z))) * (1 - w * 0.6);   // mown or trodden
      mask[k * 4 + 3] = gravel;                                           // gravel bar, road shoulder
    }
  }
  const idx = new Uint32Array(N * N * 6);
  let q = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * side + i, b = a + 1, d = a + side, e = d + 1;
    idx[q++] = a; idx[q++] = d; idx[q++] = b; idx[q++] = b; idx[q++] = d; idx[q++] = e;
  }
  return { pos, nor, mask, idx };
}

/** a ribbon laid on the ground along a centre line: the trail, the road, the river */
export function buildRibbon(points, halfWidth, lift = 0.05, flat = null) {
  const n = points.length, pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = new Uint32Array((n - 1) * 6);
  let run = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i], a = points[Math.max(i - 1, 0)], b = points[Math.min(i + 1, n - 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    if (i) run += Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]);
    const hw = typeof halfWidth === "function" ? halfWidth(i) : halfWidth;
    for (let s = 0; s < 2; s++) {
      const side = s ? 1 : -1, x = p[0] - tz * hw * side, z = p[1] + tx * hw * side, k = i * 2 + s;
      pos[k * 3] = x; pos[k * 3 + 1] = (flat === null ? height(x, z) : flat) + lift; pos[k * 3 + 2] = z;
      uv[k * 2] = side; uv[k * 2 + 1] = run;
    }
    if (i < n - 1) { const k = i * 2, q = i * 6; idx[q] = k; idx[q + 1] = k + 2; idx[q + 2] = k + 1; idx[q + 3] = k + 1; idx[q + 4] = k + 2; idx[q + 5] = k + 3; }
  }
  return { pos, uv, idx };
}

export function trailRibbonPoints() { const p = []; for (let i = 0; i < trail.n; i += 2) p.push([trail.x[i], trail.z[i]]); return p; }
export function roadPoints() { const p = []; for (let x = -EXTENT; x <= EXTENT; x += 4) p.push([x, roadZ(x)]); return p; }
export function riverPoints() { const p = []; for (let x = -EXTENT; x <= EXTENT; x += 5) p.push([x, riverZ(x)]); return p; }

/* ---------- planting ---------- */
export const SPECIES = { MAPLE: 0, ASPEN: 1, HEMLOCK: 2 };

/** every tree: {x, y, z, scale, yaw, species, ink (0..3), lod (0 near, 1 mid, 2 far)} */
export function plantTrees(quality = 1) {
  const out = [], rand = rng(20260904);
  const propList = Object.values(PLACES);
  const place = (x, z, scale, far) => {
    const w = woodsAmt(x, z);
    if (w <= 0 || rand() > w * (far ? 0.82 : 0.6)) return;
    const td = trailDist(x, z);
    if (td < 3.4) return;
    for (const p of propList) if ((x - p[0]) ** 2 + (z - p[1]) ** 2 < 20) return;
    const d = z - riverZ(x), y = height(x, z);
    if (y < WATER_Y + 0.5) return;
    // hemlock likes the shaded slope and the far bank. maple and aspen take the rest.
    const cool = (d > 0 ? smooth(100, 30, d) * 0.6 : 0.42) + (vnoise(x * 0.03, z * 0.03) - 0.5) * 0.5;
    const r = rand();
    const species = r < cool ? SPECIES.HEMLOCK : rand() < 0.3 ? SPECIES.ASPEN : SPECIES.MAPLE;
    // late september: mostly green, some gone gold, the red maples early and loud
    const c = rand();
    const ink = species === SPECIES.HEMLOCK ? 1 : species === SPECIES.ASPEN ? (c < 0.45 ? 2 : 0) : c < 0.2 ? 3 : c < 0.32 ? 2 : 0;
    out.push({ x, y: y - 0.15, z, scale: scale * (0.78 + rand() * 0.6), yaw: rand() * 6.283, species, ink,
               lod: td < 17 ? 0 : td < 64 ? 1 : 2 });
  };
  const near = 5.2, far = 10.5 / Math.sqrt(quality);
  for (let gz = -EXTENT; gz < EXTENT; gz += near) for (let gx = -EXTENT; gx < EXTENT; gx += near) {
    const x = gx + rand() * near, z = gz + rand() * near;
    if (trailDist(x, z) < 23) place(x, z, 1, false); else rand();
  }
  for (let gz = -EXTENT; gz < EXTENT; gz += far) for (let gx = -EXTENT; gx < EXTENT; gx += far) {
    const x = gx + rand() * far, z = gz + rand() * far;
    if (trailDist(x, z) >= 23) place(x, z, 1.55, true); else rand();
  }
  // a hedgerow along the road, and a few loners in the meadow
  for (let x = -150; x < 110; x += 9 + rand() * 9) {
    if (Math.abs(x) < 44) continue;                                        // keep the view open at the gate
    const z = roadZ(x) - 8.5 - rand() * 3;
    out.push({ x, y: height(x, z) - 0.15, z, scale: 0.7 + rand() * 0.5, yaw: rand() * 6.283, species: rand() < 0.5 ? SPECIES.MAPLE : SPECIES.ASPEN,
               ink: rand() < 0.3 ? 3 : rand() < 0.4 ? 2 : 0, lod: trailDist(x, z) < 17 ? 0 : 1 });
  }
  const loners = [[PLACES.loneTree[0], PLACES.loneTree[1], 1.5, SPECIES.MAPLE, 0], [-62, -14, 1.0, SPECIES.ASPEN, 2], [-66, -9, 0.9, SPECIES.ASPEN, 2],
                  [-58, -8, 1.1, SPECIES.ASPEN, 0], [84, 44, 1.2, SPECIES.MAPLE, 3], [30, 64, 0.8, SPECIES.MAPLE, 0], [-30, 96, 1.0, SPECIES.MAPLE, 3]];
  for (const [x, z, s, sp, ink] of loners) out.push({ x, y: height(x, z) - 0.15, z, scale: s, yaw: rand() * 6.283, species: sp, ink, lod: trailDist(x, z) < 17 ? 0 : 1 });
  return out;
}

/** goldenrod, grass and fern near the trail. returns a Float32Array of [x, y, z, height, seed, kind] per plant.
    kind: 0 goldenrod, 1 grass, 2 fern */
export function plantMeadow(quality = 1) {
  const out = [], rand = rng(92026);
  const x0 = GRID.x0, z0 = GRID.z0, x1 = x0 + GRID.w * GRID.cell, z1 = z0 + GRID.h * GRID.cell;
  const cell = 0.43 / Math.sqrt(quality);
  for (let gz = z0; gz < z1; gz += cell) for (let gx = x0; gx < x1; gx += cell) {
    const jx = rand(), jz = rand(), keep = rand(), pick = rand(), tall = rand(), seed = rand();
    const x = gx + jx * cell, z = gz + jz * cell;
    const td = trailDist(x, z);
    if (td > 20) continue;
    const edge = onTrack(x, z) ? 1.8 : 1.15;                               // the mown strip
    if (td < edge) continue;
    if (Math.abs(z - roadZ(x)) < 7.6) continue;                            // the shoulder of the road is kept cut
    const w = woodsAmt(x, z), d = z - riverZ(x);
    const low = smooth(edge, edge + 3.2, td);                              // shorter beside the trail, so you can see over it
    if (w < 0.5) {
      if (d < 92) continue;                                                // goldenrod is a meadow plant: none on the slope or the bank
      if (keep > 1 - smooth(9, 20, td) * 0.94) continue;
      if (inClearing(x, z, -0.5)) continue;
      const patch = vnoise(x * 0.09 + 5, z * 0.09 - 2);                    // it grows in drifts
      const kind = pick < 0.2 + (0.5 - patch) * 0.5 ? 1 : 0;
      const h = kind ? 0.5 + tall * 0.4 : 0.85 + tall * 0.42 + patch * 0.18;
      out.push(x, height(x, z), z, h * (0.6 + 0.4 * low), seed, kind);
    } else {
      if (td > 12 || d < 14 || keep > 0.2 * (1 - smooth(5, 12, td) * 0.8)) continue;   // ferns thin out fast
      out.push(x, height(x, z), z, 0.5 + tall * 0.4, seed, 2);
    }
  }
  return new Float32Array(out);
}

/** a few fence posts along the road either side of the gate: [x, y, z] */
export function fencePosts() {
  const out = [];
  for (let x = -58; x <= 58; x += 3.4) {
    if (Math.abs(x) < 3) continue;
    const z = roadZ(x) - 13;                    // the fence runs a little in from the road
    out.push([x, height(x, z), z]);
  }
  return out;
}

export { hash2 };
