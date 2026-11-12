/* pneuma nomads · the road · the ground
   A MADE UP ROAD. One road running south, with a strip of made up country on either side of it: frosty woods, then hills,
   then pine flats, then the water. It is no real route and no real place. Units are metres.
   You drive toward -z. +x is on your right (the west, where the sun goes down). */

import { smooth, lerp, fbm, vnoise, rng, clamp } from "../walk/m.js";

export const LEN = 1640;                       // how far the road goes
export const EYE = 3.15;                       // how high the camera rides above the road
export const WATER_Y = -1.25;
export const LANE = 1.8;                       // the middle of the right hand lane, from the centre line
export const HALF = 3.7;                       // half the width of the road
export const CAM_D = -3.4;                     // the camera rides left of the centre line, so the road shows past the rig

/* ---------- the road ---------- */
const bend = (z) => 58 * Math.sin(z / 255 + 0.5) + 15 * Math.sin(z / 96 + 2.2);
export const roadX = (z) => bend(z) - bend(0);
const slope = (z) => (roadX(z - 1) - roadX(z + 1)) / 2;                    // how much x changes for a metre of driving
/** which way the road is heading at z, as a unit vector [x, z] */
export function heading(z) { const s = slope(z), l = Math.hypot(s, 1); return [s / l, -1 / l]; }
/** how far along the trip you are, 0 at the start, 1 at the water */
export const along = (z) => clamp(-z / LEN, 0, 1);

/** how much of each kind of country there is at this point of the trip: north woods, hills, pine flats, the gulf */
export function country(t) {
  const a = smooth(0.15, 0.25, t), b = smooth(0.46, 0.56, t), c = smooth(0.75, 0.83, t);
  return [1 - a, a * (1 - b), b * (1 - c), c];
}
/** the road's own height: rolling in the north, up and over the hills, then nearly flat down to the water */
export function roadY(z) {
  const t = along(z), w = country(t);
  return 1.25 + 2.1 * Math.sin(z / 83 + 1) * (w[0] + 0.5 * w[1]) + 30 * Math.exp(-(((t - 0.355) / 0.105) ** 2)) + 0.5 * Math.sin(z / 61) * w[2];
}
/** signed distance from the centre line: + is the right hand side */
export function lateral(x, z) { return (x - roadX(z)) / Math.hypot(slope(z), 1); }
/** a point beside the road: d metres to the right of the centre line at z */
export function beside(z, d) { const h = heading(z); return [roadX(z) - h[1] * d, z + h[0] * d]; }

/* ---------- places (all invented): [metres to the right of the centre line, z] ---------- */
export const STOPS_Z = [-23, -560, -900, -1240, -1590];                    // where the camera is at each stop
export const PLACES = {
  gate: [13.6, -43.5],         // the land's gate
  mailbox: [6.6, -36.5],
  park0: [2.6, -51],           // the rig, half way out of the gate and turning down the road
  screen: [-19, -589],         // the big roadside screen with the latest road video on it, up where the road tops the hills
  park1: [-12, -580],          // where the rig pulls in to watch it, at the foot of the screen
  signpost: [-8.6, -915],
  park2: [-6.8, -933],
  pump: [-10, -1253.5],
  cup: [-15.2, -1256],
  park3: [-10.2, -1268],       // at the pump
  camp: [10, -1617],           // where the rig is parked at the end, by the water
  chairs: [11.5, -1606],
  north: [5.8, -1627],         // the sign that points back up the road
};
const ROOM = { screen: 12 };                                               // how far the trees stand back from a thing (7.5 if not said)
const PADS = Object.entries(PLACES).map(([name, [d, z]]) => [...beside(z, d), d, z, ROOM[name] || 7.5]);
const segDist = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1); return Math.hypot(x - ax - dx * t, z - az - dz * t); };
/* nothing is planted between where you stand at a stop and what you look at there: [stop, place, how wide a lane to keep clear] */
const SIGHT = [[0, "park0", 7], [0, "gate", 6], [1, "screen", 10], [1, "park1", 5], [2, "signpost", 6], [3, "cup", 7], [3, "pump", 5], [4, "camp", 8], [4, "chairs", 8], [4, "north", 4]]
  .map(([k, name, r]) => [...beside(STOPS_Z[k], CAM_D), ...beside(PLACES[name][1], PLACES[name][0]), r]);
const inSight = (x, z) => SIGHT.some((s) => segDist(x, z, s[0], s[1], s[2], s[3]) < s[4]);
/* the gravel where the land's drive meets the road */
const DRIVE = [...beside(PLACES.gate[1], PLACES.gate[0] + 7), ...beside(PLACES.gate[1] - 3.5, HALF - 0.5)];

function raw(x, z) {
  const t = along(z), w = country(t), d = lateral(x, z), a = Math.abs(d), ry = roadY(z);
  const roll = fbm(x * 0.012 + 3.1, z * 0.012 - 1.7, 4) - 0.5, far = vnoise(z * 0.0042 + (d > 0 ? 7.3 : 1.9), d * 0.0031 + 4);
  const off = smooth(7, 52, a);
  // north: low rolling ground, a wooded ridge well back from the road
  const north = roll * 9 * off + 24 * smooth(110, 270, a) * (0.55 + 0.9 * far);
  // hills: the road is cut into a slope. the ground climbs on your right and falls away on your left to a valley, with
  // the next range standing up beyond it
  const hills = d > 0 ? Math.min(0.5 * Math.max(a - 7, 0), 34) * (0.75 + 0.5 * far) + roll * 10 * off + 60 * smooth(90, 290, a) * (0.4 + far)
                      : -24 * smooth(7, 78, a) + roll * 12 * off + 118 * smooth(105, 300, a) * (0.45 + 0.9 * far);
  // pine flats: nearly level
  const pines = roll * 2.6 * off;
  // the gulf: low dunes inland on your left. on your right the sand runs down under the water
  const gulf = d > 0 ? -smooth(9, 30, d) * (ry - WATER_Y + 1.6) + roll * 0.8 * off * (1 - smooth(9, 22, d))
                     : roll * 3.2 * off + 2.2 * smooth(30, 90, a) * far;
  let h = ry + north * w[0] + hills * w[1] + pines * w[2] + gulf * w[3];
  h -= 0.42 * smooth(4.4, 6.4, a) * (1 - smooth(6.4, 10.5, a)) * (1 - w[3] * (d > 0 ? 1 : 0));       // a shallow ditch off each shoulder
  return h;
}
/** the finished ground: the country, with the road benched into it and a level patch under each thing that stands by it */
export function height(x, z) {
  let h = raw(x, z);
  const a = Math.abs(lateral(x, z));
  if (a < 6.5) h = lerp(roadY(z), h, smooth(HALF + 0.5, 6.5, a));
  for (const p of PADS) {
    const dd = Math.hypot(x - p[0], z - p[1]);
    if (dd < 9) h = lerp(roadY(p[3]) - 0.05, h, smooth(4.5, 9, dd));
  }
  return h;
}
export function normalAt(x, z, e = 1.0) {
  const hx = height(x + e, z) - height(x - e, z), hz = height(x, z + e) - height(x, z - e), l = Math.hypot(hx, 2 * e, hz);
  return [-hx / l, (2 * e) / l, -hz / l];
}
/** the point on the road's centre line at z, d metres to the right of it */
export function roadAt(z, d = 0) { const p = beside(z, d); return [p[0], roadY(z), p[1]]; }

/* ---------- the ground: a strip that follows the road, fine near it and coarse far off ---------- */
const COLS = [-310, -235, -175, -128, -96, -72, -54, -41, -31, -23.5, -17.5, -13, -9.8, -7.4, -5.6, -HALF, -1.85, 0,
              1.85, HALF, 5.6, 7.4, 9.8, 13, 17.5, 23.5, 31, 41, 54, 72, 96, 128, 175, 235, 310];
export function buildGround(step = 4) {
  const z0 = 60, z1 = -LEN - 150, rows = Math.round((z0 - z1) / step) + 1, cols = COLS.length;
  const pos = new Float32Array(rows * cols * 3), nor = new Float32Array(rows * cols * 3), mask = new Float32Array(rows * cols * 4);
  for (let j = 0; j < rows; j++) {
    const z = z0 - j * step, t = along(z), w = country(t);
    for (let i = 0; i < cols; i++) {
      const d = COLS[i], k = j * cols + i, [x, zz] = beside(z, d), y = height(x, zz), n = normalAt(x, zz, 1.2), a = Math.abs(d);
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = zz;
      nor[k * 3] = n[0]; nor[k * 3 + 1] = n[1]; nor[k * 3 + 2] = n[2];
      const patch = fbm(x * 0.021 + 7, zz * 0.021 + 3, 3);
      const sand = w[3] * (d > 0 ? smooth(5, 9, d) : 0.35 + 0.5 * smooth(0.45, 0.6, patch));
      const litter = clamp(w[0] * (0.55 + 0.6 * smooth(0.4, 0.6, patch)) + w[1] * smooth(0.52, 0.66, patch) * 0.8 + w[2] * smooth(0.42, 0.56, patch) * 0.9, 0, 1);
      const drive = 1 - smooth(2.3, 4.6, segDist(x, zz, DRIVE[0], DRIVE[1], DRIVE[2], DRIVE[3]));
      mask[k * 4] = (1 - litter) * (1 - sand) * (1 - drive);               // grass
      mask[k * 4 + 1] = litter * (1 - sand) * (1 - drive);                 // leaf litter, pine straw
      mask[k * 4 + 2] = Math.max(1 - smooth(HALF + 0.3, 6.6, a), drive) * (1 - sand);     // the shoulder, and the land's drive
      mask[k * 4 + 3] = sand;
    }
  }
  const idx = new Uint32Array((rows - 1) * (cols - 1) * 6);
  let q = 0;
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
    const a = j * cols + i, b = a + 1, c = a + cols, e = c + 1;
    idx[q++] = a; idx[q++] = b; idx[q++] = c; idx[q++] = b; idx[q++] = e; idx[q++] = c;
  }
  return { pos, nor, mask, idx };
}

/** a ribbon laid on the ground along a centre line (the road), or held level (the water) */
export function buildRibbon(points, halfWidth, lift = 0.05, flat = null) {
  const n = points.length, pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = new Uint32Array((n - 1) * 6);
  let run = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i], a = points[Math.max(i - 1, 0)], b = points[Math.min(i + 1, n - 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    if (i) run += Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]);
    for (let s = 0; s < 2; s++) {
      const side = s ? 1 : -1, x = p[0] - tz * halfWidth * side, z = p[1] + tx * halfWidth * side, k = i * 2 + s;
      pos[k * 3] = x; pos[k * 3 + 1] = (flat === null ? roadY(p[1]) : flat) + lift; pos[k * 3 + 2] = z;
      uv[k * 2] = side; uv[k * 2 + 1] = run;
    }
    if (i < n - 1) { const k = i * 2, q = i * 6; idx[q] = k; idx[q + 1] = k + 2; idx[q + 2] = k + 1; idx[q + 3] = k + 1; idx[q + 4] = k + 2; idx[q + 5] = k + 3; }
  }
  return { pos, uv, idx };
}
export function roadPoints() { const p = []; for (let z = 60; z >= -LEN - 150; z -= 3) p.push([roadX(z), z]); return p; }
export function waterPoints() { const p = []; for (let z = -LEN * 0.7; z >= -LEN - 150; z -= 12) p.push([...beside(z, 170)]); return p; }

/* ---------- planting ---------- */
export const SPECIES = { MAPLE: 0, ASPEN: 1, PINE: 2, PALM: 3, BARE: 4 };
const clearOf = (x, z, k = 1) => PADS.every((p) => (x - p[0]) ** 2 + (z - p[1]) ** 2 > (p[4] * k) ** 2);

/** every tree: {x, y, z, scale, yaw, species, ink (0 green, 1 dark, 2 gold, 3 rust), lod (0 near, 1 mid, 2 far)} */
export function plantTrees(quality = 1) {
  const out = [], rand = rng(20261115);
  const gap = 7.5 / Math.sqrt(quality);
  for (let z = 50; z > -LEN - 130; z -= gap) {
    const t = along(z), w = country(t);
    for (const side of [-1, 1]) {
      for (let a = 9.5; a < 240; a += gap * (1 + a / 70)) {
        const d = side * (a + rand() * gap), zz = z + (rand() - 0.5) * gap, keep = rand(), kind = rand(), tone = rand(), size = rand(), yaw = rand() * 6.283;
        const [x, pz] = beside(zz, d), patch = fbm(x * 0.021 + 7, pz * 0.021 + 3, 3);
        // how wooded it is here: thick in the north and the hills, open pine flats, a few palms by the water
        const thick = w[0] * (0.5 + 0.5 * smooth(0.35, 0.6, patch)) + w[1] * (d > 0 ? 0.85 : 0.55 + 0.4 * smooth(60, 120, a)) + w[2] * 0.34 * smooth(0.38, 0.6, patch) + w[3] * (d > 0 ? 0.1 * (1 - smooth(10, 20, a)) : 0.16);
        if (keep > thick) continue;
        if (w[3] > 0.5 && d > 21) continue;                                  // nothing grows in the water
        if (!clearOf(x, pz) || inSight(x, pz)) continue;
        const pick = w[0] > 0.5 ? 0 : w[1] > 0.5 ? 1 : w[2] > 0.5 ? 2 : 3;
        let species, ink, scale = 0.8 + size * 0.55;
        if (pick === 0) { species = kind < 0.52 ? SPECIES.BARE : kind < 0.8 ? SPECIES.PINE : SPECIES.MAPLE; ink = species === SPECIES.PINE ? 1 : tone < 0.6 ? 3 : 2; }
        else if (pick === 1) { species = kind < 0.62 ? SPECIES.PINE : kind < 0.86 ? SPECIES.MAPLE : SPECIES.ASPEN; ink = species === SPECIES.PINE ? 1 : tone < 0.4 ? 2 : tone < 0.7 ? 3 : 0; }
        else if (pick === 2) { species = kind < 0.74 ? SPECIES.PINE : SPECIES.MAPLE; ink = species === SPECIES.PINE ? 1 : 0; scale *= species === SPECIES.PINE ? 1.25 : 0.95; }
        else { species = kind < 0.8 ? SPECIES.PALM : SPECIES.MAPLE; ink = 0; scale *= species === SPECIES.PALM ? 1 : 0.8; }
        out.push({ x, y: height(x, pz) - 0.15, z: pz, scale, yaw, species, ink, lod: a < 26 ? 0 : a < 80 ? 1 : 2 });
      }
    }
  }
  // a few set by hand: palms round the camp at the end
  for (const [d, z, s] of [[19.5, -1613, 1.15], [17, -1630, 0.95], [-11, -1640, 1.05], [-13, -1600, 1.1], [14, -1644, 0.9]]) {
    const [x, pz] = beside(z, d);
    out.push({ x, y: height(x, pz) - 0.1, z: pz, scale: s, yaw: z * 0.7, species: SPECIES.PALM, ink: 0, lod: 0 });
  }
  return out;
}

/** grass, dry seed heads and palmetto by the road. [x, y, z, height, seed, kind] per plant. kind: 0 seed heads, 1 grass, 2 palmetto */
export function plantVerge(quality = 1) {
  const out = [], rand = rng(111526), cell = 0.9 / Math.sqrt(quality);
  for (let z = 30; z > -LEN - 60; z -= cell) {
    const t = along(z), w = country(t);
    for (const side of [-1, 1]) {
      for (let a = HALF + 1.6; a < 24; a += cell * (1 + a / 16)) {
        const d = side * (a + rand() * cell), zz = z + rand() * cell, keep = rand(), pick = rand(), tall = rand(), seed = rand();
        if (keep > 0.62 - a * 0.012) continue;
        const [x, pz] = beside(zz, d);
        if (!clearOf(x, pz, 0.56) || segDist(x, pz, DRIVE[0], DRIVE[1], DRIVE[2], DRIVE[3]) < 3.4) continue;
        if (w[3] > 0.5 && d > 15) continue;                                   // the wet sand
        // frosty grass up north, seed heads in the hills, palmetto under the pines, sea oats on the dunes
        const kind = w[0] > 0.5 ? 1 : w[1] > 0.5 ? (pick < 0.4 ? 0 : 1) : w[2] > 0.5 ? (pick < 0.5 ? 2 : pick < 0.72 ? 0 : 1) : (pick < 0.62 ? 0 : 1);
        const h = kind === 2 ? 0.55 + tall * 0.45 : kind === 0 ? 0.75 + tall * 0.45 : 0.4 + tall * 0.35;
        out.push(x, height(x, pz), pz, h, seed, kind);
      }
    }
  }
  return new Float32Array(out);
}

/** poles along the left of the road through the north: [x, y, z]. the wire stops where the hills start. */
export function poles() {
  const out = [];
  for (let z = 2; z > -390; z -= 46) { const [x, pz] = beside(z, -7.6); out.push([x, height(x, pz), pz]); }
  return out;
}
