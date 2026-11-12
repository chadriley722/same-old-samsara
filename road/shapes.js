/* pneuma nomads · the road · shapes
   The things beside the road, built from the same few primitives as the walk (walk/mesh.js). No model files.
   The six colours of the stripe are the BEAD inks here (see road/light.js): brick, clay, mustard, sage, denim, plum. */

import { Geo, box, cyl, tube, plane, blob, paint as P } from "../walk/mesh.js";
import { INK, STYLE } from "../walk/glsl.js";
import { TAU, rng } from "../walk/m.js";

export const STRIPE = [INK.BEAD0, INK.BEAD1, INK.BEAD2, INK.BEAD3, INK.BEAD4, INK.BEAD5];
const flat = (ink) => P(ink, STYLE.PLAIN, 0, 1);            // a sign colour: it keeps its colour in any light

/** a palm: a leaning trunk and a crown of fronds that arch up and out, then hang */
export function palmTree() {
  const g = new Geo(), r = rng(31), bark = P(INK.BARK, STYLE.BARK), leaf = P(INK.FOLIAGE, STYLE.NEEDLE);
  const H = 8.2, lean = 0.9, seg = 6, at = (s) => [lean * s * s, H * s, 0.25 * s * s];
  for (let k = 0; k < seg; k++) g.add(tube(at(k / seg), at((k + 1) / seg), 0.3 - k * 0.022, 0.3 - (k + 1) * 0.022, 6, bark, 0, false));
  const top = at(1);
  g.add(blob(0.42, 0.36, 0.42, 1, bark, 1), { pos: top });
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * TAU + r() * 0.3, len = 3.3 + r() * 0.9, lift = 0.5 + r() * 0.5, ca = Math.cos(a), sa = Math.sin(a), n = 6;
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const s = i / n, out = len * s * (1 - 0.18 * s), y = top[1] + 0.25 + len * (lift * s - 1.05 * s * s), w = 0.62 * Math.sin(Math.PI * (0.12 + 0.88 * s)) * (1 - 0.35 * s);
      const cx = top[0] + ca * out, cz = top[2] + sa * out;
      const row = [g.vert(cx - sa * w, y - 0.12 * w, cz + ca * w, 0, 1, 0, leaf, 2 + (k % 4)), g.vert(cx, y, cz, 0, 1, 0, leaf, 2 + (k % 4)), g.vert(cx + sa * w, y - 0.12 * w, cz - ca * w, 0, 1, 0, leaf, 2 + (k % 4))];
      if (prev) { g.quad(prev[0], prev[1], row[1], row[0]); g.quad(prev[1], prev[2], row[2], row[1]); }
      prev = row;
    }
  }
  g.sway((x, y) => (y > 6.5 ? 0.28 + Math.min(Math.hypot(x - top[0]) * 0.1, 0.5) : (y / H) * 0.12));
  return g;
}

/** a tree with its leaves down: what the north looks like the week you leave */
export function bareTree(lod) {
  const g = new Geo(), r = rng(57 + lod), bark = P(INK.BARK, lod === 2 ? STYLE.PLAIN : STYLE.BARK), sides = lod === 2 ? 3 : lod ? 4 : 6;
  g.add(cyl(0.3, 0.13, 6.4, sides + 1, bark, 0, false));
  const limbs = lod === 2 ? 4 : 7;
  for (let k = 0; k < limbs; k++) {
    const a = (k / limbs) * TAU + r() * 0.8, y0 = 3 + r() * 2.6, len = 2.2 + r() * 1.6, tip = [Math.cos(a) * len, y0 + len * (0.7 + r() * 0.5), Math.sin(a) * len];
    g.add(tube([0, y0, 0], tip, 0.1, 0.03, sides - 1, bark, 1, false));
    if (lod < 2) for (let j = 0; j < 2; j++) {
      const b = a + (j ? 0.7 : -0.6) + r() * 0.3, m = 0.45 + r() * 0.3, from = [tip[0] * m, y0 + (tip[1] - y0) * m, tip[2] * m], l2 = 1.1 + r() * 0.8;
      g.add(tube(from, [from[0] + Math.cos(b) * l2, from[1] + l2 * 0.9, from[2] + Math.sin(b) * l2], 0.045, 0.012, 3, bark, 2, false));
    }
  }
  g.add(tube([0, 6.2, 0], [0.3, 8.6, -0.2], 0.12, 0.02, sides - 1, bark, 1, false));
  g.sway((x, y) => (y > 5 ? (y - 5) * 0.035 : 0));
  return g;
}

/** the pixel pin, as a thing in the world: each pixel of the mark is a little block. it stands on its point at y = 0. */
export function pixelPin(px = 0.1) {
  const rows = ["...#####...", ".##h#####d.", "##h######dd", "##h#ooo##dd", "###ooooo#dd", "###ooooo#dd", "###ooooo#dd",
                "####ooo##dd", ".########d.", ".#######dd.", "..######d..", "...####d...", "....##d....", ".....d....."];
  const ink = { "#": flat(INK.BEAD0), h: flat(INK.EMBER), d: flat(INK.RUST), o: flat(INK.CREAM) }, part = { "#": 1, h: 2, d: 3, o: 4 };
  const g = new Geo();
  rows.forEach((row, j) => [...row].forEach((c, i) => {
    if (ink[c]) g.add(box(px, px, px * 0.7, ink[c], part[c]), { pos: [(i - 5) * px, (rows.length - 0.5 - j) * px, 0] });
  }));
  return g;
}

/** the roadside screen: a sheet with the latest road video on it (the engine's film), on two tall posts.
    It is built at the size the film style expects and made big by its model matrix. Its feet are at y = -FEET. */
export const SCREEN_FEET = 1.75;
export function roadScreen() {
  const g = new Geo(), wood = P(INK.WOOD, STYLE.PLANK), dark = P(INK.PEPPER, STYLE.PLAIN);
  for (const x of [-1.25, 1.25]) g.add(box(0.13, 2.6 + SCREEN_FEET, 0.13, wood, 1), { pos: [x, (2.6 - SCREEN_FEET) / 2, -0.1] });
  for (const x of [-1.25, 1.25]) g.add(tube([x, -SCREEN_FEET, -0.9], [x, 1.2, -0.12], 0.035, 0.035, 4, wood, 1, false));      // braces at the back
  g.add(box(3.62, 2.26, 0.07, dark, 2), { pos: [0, 1.62, -0.035] });                                    // the board behind the sheet
  g.add(plane(3.4, 2.05, P(INK.WHITE, STYLE.FILM), 3, 1, 1), { pos: [0, 1.62, 0.006] });
  // six small lamps along the top, one in each colour of the stripe
  STRIPE.forEach((c, k) => g.add(box(0.2, 0.07, 0.1, flat(c), 4 + k), { pos: [-1.4 + k * 0.56, 2.8, 0.02] }));
  return g;
}

/** a signpost with four boards pointing four ways */
export function signpost() {
  const g = new Geo(), wood = P(INK.WOOD, STYLE.PLANK);
  g.add(cyl(0.085, 0.07, 3.5, 6, wood, 1), { pos: [0, 0, 0] });
  [[INK.BEAD0, 0.5, 3.05, 1], [INK.BEAD2, 2.3, 2.62, -1], [INK.BEAD3, -0.7, 2.19, 1], [INK.BEAD4, 3.6, 1.76, -1]].forEach(([c, yaw, y, dir], k) => {
    const b = new Geo();
    b.add(box(1.15, 0.28, 0.035, flat(c), 2 + k), { pos: [dir * 0.62, 0, 0] });
    b.add(box(0.2, 0.2, 0.035, flat(c), 2 + k), { pos: [dir * 1.195, 0, 0], roll: Math.PI / 4 });      // the point
    b.add(box(0.5, 0.045, 0.04, flat(INK.CREAM), 6), { pos: [dir * 0.55, 0, 0.004] });                 // a line of "writing"
    g.add(b, { pos: [0, y, 0.06], yaw });
  });
  return g;
}

/** an old pump with a lit globe on top */
export function gasPump() {
  const g = new Geo(), body = flat(INK.BEAD0), dark = P(INK.PEPPER, STYLE.PLAIN);
  g.add(box(0.78, 0.16, 0.56, dark, 1), { pos: [0, 0.08, 0] });
  g.add(box(0.62, 1.5, 0.42, body, 2), { pos: [0, 0.91, 0] });
  g.add(box(0.44, 0.44, 0.02, flat(INK.CREAM), 3), { pos: [0, 1.26, 0.215] });                          // the dial
  g.add(box(0.3, 0.035, 0.022, dark, 4), { pos: [0, 1.26, 0.222], roll: 0.6 });
  g.add(box(0.44, 0.16, 0.02, flat(INK.BEAD2), 5), { pos: [0, 0.78, 0.215] });
  g.add(cyl(0.11, 0.11, 0.14, 8, dark, 1), { pos: [0, 1.66, 0] });
  g.add(blob(0.25, 0.25, 0.25, 2, P(INK.LAMP, STYLE.PLAIN, 0, 1), 6), { pos: [0, 2.02, 0] });          // the globe
  g.add(tube([0.31, 1.45, 0], [0.47, 1.0, 0.1], 0.02, 0.02, 4, dark, 4, false));
  g.add(tube([0.47, 1.0, 0.1], [0.36, 0.52, 0.02], 0.02, 0.02, 4, dark, 4, false));
  g.add(box(0.06, 0.2, 0.08, dark, 4), { pos: [0.35, 0.62, 0.02], roll: 0.5 });
  return g;
}

/** a coffee cup the size of a shed, up on a pole */
export function cupSign() {
  const g = new Geo(), dark = P(INK.PEPPER, STYLE.PLAIN), cup = flat(INK.CREAM);
  g.add(cyl(0.11, 0.09, 5.2, 6, dark, 1), { pos: [0, 0, 0] });
  g.add(cyl(0.72, 0.92, 1.35, 14, cup, 2), { pos: [0, 5.2, 0] });
  g.add(cyl(0.735, 0.775, 0.2, 14, flat(INK.BEAD2), 3, false), { pos: [0, 5.62, 0] });                  // a mustard band
  g.add(cyl(0.86, 0.86, 0.03, 14, flat(INK.BEAD1), 4), { pos: [0, 6.5, 0] });                           // the coffee
  for (const [a, b] of [[[0.86, 6.25, 0], [1.32, 6.2, 0]], [[1.32, 6.2, 0], [1.34, 5.72, 0]], [[1.34, 5.72, 0], [0.8, 5.56, 0]]]) g.add(tube(a, b, 0.07, 0.07, 5, cup, 5, false));   // the handle
  for (const x of [-0.3, 0.12, 0.45]) for (let k = 0; k < 3; k++)                                         // steam
    g.add(tube([x + (k % 2 ? 0.12 : 0), 6.75 + k * 0.42, 0], [x + (k % 2 ? 0 : 0.12), 7.12 + k * 0.42, 0], 0.03, 0.03, 4, P(INK.WHITE, STYLE.PLAIN, 0.3, 1), 6, false));
  return g;
}

/** the sign at the end of the road that points back the way you came */
export function northSign() {
  const g = new Geo(), dark = P(INK.PEPPER, STYLE.PLAIN);
  for (const x of [-0.72, 0.72]) g.add(box(0.08, 2.9, 0.08, dark, 1), { pos: [x, 1.45, -0.05] });
  g.add(box(1.9, 1.3, 0.05, flat(INK.BEAD3), 2), { pos: [0, 2.3, 0] });
  g.add(box(1.76, 1.16, 0.012, flat(INK.CREAM), 3), { pos: [0, 2.3, 0.028] });
  g.add(box(1.68, 1.08, 0.012, flat(INK.BEAD3), 2), { pos: [0, 2.3, 0.034] });
  // a little house in pixels, and under it an arrow that points back at you: home is behind you
  const px = 0.085, cream = flat(INK.CREAM), rows = ["...#...", "..###..", ".#####.", "#######", ".#####.", ".##.##.", ".##.##."];
  rows.forEach((row, j) => [...row].forEach((c, i) => { if (c === "#") g.add(box(px, px, 0.012, cream, 4), { pos: [(i - 3) * px - 0.42, 2.58 - j * px, 0.042] }); }));
  const arrow = ["..#..", "..#..", "..#..", "#.#.#", ".###.", "..#.."];
  arrow.forEach((row, j) => [...row].forEach((c, i) => { if (c === "#") g.add(box(px, px, 0.012, cream, 5), { pos: [(i - 2) * px + 0.42, 2.54 - j * px, 0.042] }); }));
  return g;
}

/** what's on the back of the fifth wheel: a ladder, and the thin six colour stripe. built in the camper's own space
    (walk/mesh.js camper(): its back wall is at x = -4.9), so it is drawn with the camper's model matrix. */
export function rigTrim() {
  const g = new Geo(), dark = P(INK.PEPPER, STYLE.PLAIN);
  for (const z of [0.72, 1.06]) g.add(tube([-4.93, 1.05, z], [-4.93, 3.55, z], 0.018, 0.018, 4, dark, 1, false));
  for (let k = 0; k < 6; k++) g.add(tube([-4.93, 1.3 + k * 0.4, 0.72], [-4.93, 1.3 + k * 0.4, 1.06], 0.014, 0.014, 4, dark, 1, false));
  STRIPE.forEach((c, k) => g.add(box(0.012, 0.05, 1.9, flat(c), 2 + k), { pos: [-4.915, 1.78 - k * 0.052, -0.2] }));
  return g;
}

/** a pole with a cross arm, for the wire that follows the road out of the north */
export function pole() {
  const g = new Geo(), wood = P(INK.WOOD, STYLE.PLANK);
  g.add(cyl(0.13, 0.09, 8.2, 6, wood, 1), { pos: [0, 0, 0] });
  g.add(box(1.8, 0.1, 0.1, wood, 2), { pos: [0, 7.55, 0] });
  for (const x of [-0.78, 0.78]) g.add(cyl(0.04, 0.04, 0.14, 5, P(INK.CREAM, STYLE.PLAIN), 3), { pos: [x, 7.6, 0] });
  return g;
}
export const POLE_WIRE = [[-0.78, 7.74], [0.78, 7.74]];       // where the two wires leave a pole: [x along the arm, height]
