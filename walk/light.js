/* same old samsara · the walk · the light
   One day goes by as you walk. This file holds the inks for each part of the day and where the sun is at each stop.
   Colours are the brand's: cream, pepper, moss, night moss, goldenrod, rust. The only loud ones are the beads. */

import { INK } from "./glsl.js";
import { DEG } from "./m.js";

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, m) => [a[0] * m[0], a[1] * m[1], a[2] * m[2]];

/* every ink in plain daylight: [in the light, in the shade] */
const BASE = [];
const ink = (i, lit, shade) => { BASE[i] = [hex(lit), hex(shade)]; };
ink(INK.GOLD, "#dcab31", "#a8872e");
ink(INK.GREEN, "#8d8d4a", "#5d6136");
ink(INK.PATH, "#bdb574", "#8d8a56");
ink(INK.DIRT, "#cbb68b", "#9c8866");
ink(INK.GRAVEL, "#e7dcc0", "#b6ab92");
ink(INK.FLOOR, "#9a8958", "#625c3b");
ink(INK.LEAF, "#6f7442", "#434629");
ink(INK.LEAF_DARK, "#525c3b", "#33351f");
ink(INK.LEAF_GOLD, "#cfac3c", "#8e7e2f");
ink(INK.LEAF_RUST, "#c1623a", "#853d23");
ink(INK.BARK, "#7d6c56", "#4b4743");
ink(INK.BARK_PALE, "#f0e7cf", "#b5ac96");
ink(INK.WATER, "#d3d9c2", "#8f9f8a");
ink(INK.WHITE, "#fffaf0", "#d6ccb2");
ink(INK.RUST, "#b95b31", "#813e20");
ink(INK.WINDOW, "#5c5b53", "#3d3d37");
ink(INK.PEPPER, "#5b5854", "#34322f");
ink(INK.WOOD, "#b28f60", "#7c6141");
ink(INK.MOSS, "#929c4b", "#5e6a31");
ink(INK.FLAME, "#f4b532", "#f4b532");
ink(INK.EMBER, "#e2702b", "#e2702b");
ink(INK.ROAD, "#a8a293", "#7c776b");
ink(INK.STONE, "#bdb5a2", "#857f72");
ink(INK.CREAM, "#f1e4c2", "#bfb393");
ink(INK.RAVEN, "#3b3936", "#262422");
ink(INK.LAMP, "#e9dfc4", "#e9dfc4");
// the beads: real Toho colours from the pattern legends
["#b8342c", "#ef7d22", "#f2c81f", "#4bae57", "#6f95d3", "#6b4bb0"].forEach((c, k) => ink(INK.BEAD0 + k, c, c));
for (let i = 0; i < INK.COUNT; i++) if (!BASE[i]) BASE[i] = [hex("#ff00ff"), hex("#aa00aa")];

const FIXED = new Set([INK.FLAME, INK.EMBER, INK.LAMP, INK.RAVEN]);
const BEADS = new Set([INK.BEAD0, INK.BEAD0 + 1, INK.BEAD0 + 2, INK.BEAD0 + 3, INK.BEAD0 + 4, INK.BEAD0 + 5]);

/* how each part of the day changes an ink */
const MOODS = [
  /* day    */ (l, s) => [l, s],
  /* dawn   */ (l, s) => [mix(l, hex("#f5dcba"), 0.2), mix(s, hex("#7c7d66"), 0.26)],
  /* golden */ (l, s) => [mix(mul(l, [1.07, 0.93, 0.72]), hex("#dba233"), 0.14), mix(mul(s, [0.84, 0.74, 0.72]), hex("#4a3b2c"), 0.22)],
  /* dusk   */ (l, s) => [mix(s, hex("#3d3f29"), 0.52), mix(s, hex("#2b2d1a"), 0.74)],
  /* night  */ (l, s) => [mix(hex("#33361f"), mul(l, [0.5, 0.52, 0.4]), 0.5), mix(hex("#1c1e10"), s, 0.1)],
];
const BEAD_DIM = [0, 0.05, 0.05, 0.3, 0.5];
const PAL = MOODS.map((fn, m) => BASE.map(([l, s], i) => {
  if (FIXED.has(i)) return [l, s];
  if (BEADS.has(i)) { const c = mix(l, hex("#2a2617"), BEAD_DIM[m]); return [c, c]; }
  return fn(l, s);
}));

/* ---------- the day, stop by stop ---------- */
const BASE_KEY = {
  sunAz: 105, sunEl: 38, lightAz: 105, lightEl: 38, shadow: 0.9,
  w: [1, 0, 0, 0, 0],                                    // day, dawn, golden, dusk, night
  paper: hex("#fff4d9"), key: hex("#474440"), keyAmt: 0.9, hatch: 1,
  band: [...hex("#f2e2b6"), 0.7], band2: [...hex("#f8ecca"), 0.55],
  sunCol: hex("#e3a934"), sunSize: 2.4,
  fogCol: hex("#efe6cc"), fogD: 0.0013, fogLow: 1.2, fogMax: 0.6,
  haze: hex("#dcd3b6"),
  cloud: 0.55, cloudShadeAmt: 0.75, cloudLitAmt: 1, cloudShade: hex("#cfcab0"), cloudLit: hex("#fffaf0"),
  stars: 0, moon: 0, rule: 0.3, fire: 0, lamp: 0, glitter: 0.25, wind: 0.5,
};
const K = (u, o) => ({ ...BASE_KEY, ...o, u });

const DAWN = {
  sunAz: 40, sunEl: 6.2, lightAz: 40, lightEl: 9, shadow: 0.6, w: [0, 1, 0, 0, 0],
  paper: hex("#fbeedb"), key: hex("#4d4945"), keyAmt: 0.88, hatch: 0.9,
  band: [...hex("#efb07a"), 0.95], band2: [...hex("#f6d5a9"), 0.9], sunCol: hex("#e6993a"), sunSize: 2.8,
  fogCol: hex("#f5e6cf"), fogD: 0.0022, fogLow: 4, fogMax: 0.8, haze: hex("#e9d9c1"),
  cloud: 0.45, cloudShade: hex("#eaaf88"), cloudLit: hex("#fff5e2"), rule: 0.22, glitter: 0.6, wind: 0.35,
};
const NIGHT = {
  sunAz: 345, sunEl: -40, lightAz: 150, lightEl: 36, shadow: 0.5, w: [0, 0, 0, 0, 1],
  paper: hex("#2b2d1a"), key: hex("#f1e6c6"), keyAmt: 0.78, hatch: 0.8,
  band: [...hex("#3c3f27"), 0.9], band2: [...hex("#33361f"), 0.7], sunSize: 0,
  fogCol: hex("#2c2e1b"), fogD: 0.0024, fogLow: 2, fogMax: 0.7, haze: hex("#21230f"),
  cloud: 0.4, cloudShade: hex("#292b18"), cloudLit: hex("#474a30"), cloudShadeAmt: 0.6,
  stars: 1, moon: 1, rule: 0.2, fire: 1, lamp: 1, glitter: 0, wind: 0.3,
};
const FIRST_LIGHT = {                                    // the hour before the sun, on either side of the night
  sunAz: 32, sunEl: -7, lightAz: 36, lightEl: 14, shadow: 0, w: [0, 0.25, 0, 0.45, 0.3],
  paper: hex("#8d8669"), key: hex("#8e8872"), keyAmt: 0.3, hatch: 0.15,
  band: [...hex("#c9774b"), 0.95], band2: [...hex("#b59b6e"), 0.85], sunSize: 0,
  fogCol: hex("#8f8768"), fogD: 0.0036, fogLow: 4, fogMax: 0.85, haze: hex("#6f6a50"),
  cloud: 0.45, cloudShade: hex("#b8684a"), cloudLit: hex("#a39a78"),
  stars: 0.25, moon: 0.45, rule: 0.1, fire: 0.25, lamp: 0.7, glitter: 0, wind: 0.3,
};

/* u is the stop number: 0 gate, 1 films, 2 make, 3 wear, 4 the land, 5 the field guide, 6 follow, 7 say hi, 8 the road.
   The river (the land) gets the golden hour, the woods on the way back up get the sunset, and the walk ends walking east
   down the road, so the last sunrise comes up at the end of it. */
const DAY_WALK = [
  K(0, DAWN),
  K(1, { sunAz: 62, sunEl: 20, lightAz: 62, lightEl: 20, w: [0.62, 0.38, 0, 0, 0], paper: hex("#fff2d9"),
         band: [...hex("#f4d09c"), 0.8], band2: [...hex("#f9e6c2"), 0.7], sunCol: hex("#e7ab3c"),
         fogCol: hex("#f6ecd6"), fogD: 0.0022, fogLow: 3, fogMax: 0.75, haze: hex("#e6dcc0"), cloud: 0.5, cloudShade: hex("#dccfb0"), wind: 0.45 }),
  K(2, {}),
  K(3, { sunAz: 170, sunEl: 54, lightAz: 170, lightEl: 54, wind: 0.6 }),
  K(3.5, { sunAz: 226, sunEl: 36, lightAz: 226, lightEl: 36, w: [0.8, 0, 0.2, 0, 0], sunCol: hex("#e3a434") }),          // the afternoon, going down through the woods
  K(4, { sunAz: 271, sunEl: 8, lightAz: 271, lightEl: 11, shadow: 0.8, w: [0, 0, 1, 0, 0], paper: hex("#fdeac4"),
         band: [...hex("#e8a044"), 0.95], band2: [...hex("#f3cb84"), 0.9], sunCol: hex("#df882b"), sunSize: 3.0,
         fogCol: hex("#f0d6a4"), fogD: 0.0024, fogLow: 2, fogMax: 0.72, haze: hex("#d8b987"),
         cloud: 0.5, cloudShade: hex("#d08a4b"), cloudLit: hex("#fff0cf"), rule: 0.18, glitter: 1, wind: 0.4 }),
  K(5, { sunAz: 277, sunEl: 1.5, lightAz: 277, lightEl: 10, shadow: 0.5, w: [0, 0, 0.68, 0.32, 0], paper: hex("#e9cf9c"),            // sunset, in the woods
         key: hex("#403d38"), keyAmt: 0.78, hatch: 0.65,
         band: [...hex("#d9772f"), 1], band2: [...hex("#eeb85a"), 0.95], sunCol: hex("#d9702a"), sunSize: 3.2,
         fogCol: hex("#d9bd87"), fogD: 0.0027, fogLow: 2, fogMax: 0.68, haze: hex("#b79a67"),
         cloud: 0.5, cloudShade: hex("#b56a3a"), cloudLit: hex("#f7d9a3"), rule: 0.14, fire: 0.3, lamp: 0.25, glitter: 0.3, wind: 0.35 }),
  K(5.6, { sunAz: 282, sunEl: -4, lightAz: 282, lightEl: 14, shadow: 0, w: [0, 0, 0.1, 0.9, 0], paper: hex("#a59b6b"),
           key: hex("#3a3834"), keyAmt: 0.45, hatch: 0.2,
           band: [...hex("#bb5830"), 1], band2: [...hex("#dba636"), 0.95], sunSize: 0,
           fogCol: hex("#8e855a"), fogD: 0.003, fogLow: 2, fogMax: 0.62, haze: hex("#5e5a3c"),
           cloud: 0.5, cloudShade: hex("#8a4a2c"), cloudLit: hex("#cf9349"), rule: 0.1, fire: 0.7, lamp: 0.6, glitter: 0, wind: 0.3 }),
  K(6, { ...NIGHT, sunAz: 292, sunEl: -14, shadow: 0.15, w: [0, 0, 0, 0.2, 0.8], paper: hex("#393a22"), key: hex("#b5ac8e"), keyAmt: 0.5, hatch: 0.45,
         band: [...hex("#7c4a2a"), 0.8], band2: [...hex("#4b4b2b"), 0.7], stars: 0.55, moon: 0.5 }),
  K(7, NIGHT),
  K(7.45, { ...FIRST_LIGHT, sunAz: 425, lightAz: 62 }),
  K(8, { ...DAWN, sunAz: 430, sunEl: 8.5, lightAz: 70 }),
];
/* when the site is in its night colours the walk starts and ends in the dark instead of at sunrise */
const NIGHT_WALK = [
  K(0, { ...NIGHT, sunAz: -15 }),
  K(0.6, { ...FIRST_LIGHT, lightAz: 36 }),
  ...DAY_WALK.slice(1, DAY_WALK.length - 2),          // the same day, up to the night at the mailbox
  K(8, { ...NIGHT, sunAz: 345 }),
];

const lerp = (a, b, t) => a + (b - a) * t;
function blend(a, b, t) {
  const o = {};
  for (const k in a) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], t)) : lerp(a[k], b[k], t);
  return o;
}
function sample(keys, u) {
  if (u <= keys[0].u) return keys[0];
  for (let i = 1; i < keys.length; i++) if (u <= keys[i].u) return blend(keys[i - 1], keys[i], (u - keys[i - 1].u) / (keys[i].u - keys[i - 1].u));
  return keys[keys.length - 1];
}
const dir = (az, el) => [Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), -Math.cos(az * DEG) * Math.cos(el * DEG)];

export const MOON_DIR = dir(153, 17);

/** the light at stop-progress u. nightStart 0..1 blends in the walk that begins in the dark. */
export function lightAt(u, nightStart, lit, shade) {
  let s = sample(DAY_WALK, u);
  s = nightStart > 0.001 ? blend(s, sample(NIGHT_WALK, u), nightStart) : { ...s };     // a copy: the tables themselves are never changed
  // the inks: a weighted mix of the five moods
  const w = s.w, sum = w[0] + w[1] + w[2] + w[3] + w[4] || 1;
  for (let i = 0; i < INK.COUNT; i++) {
    for (let c = 0; c < 3; c++) {
      let l = 0, d = 0;
      for (let m = 0; m < 5; m++) { l += PAL[m][i][0][c] * w[m]; d += PAL[m][i][1][c] * w[m]; }
      lit[i * 3 + c] = l / sum; shade[i * 3 + c] = d / sum;
    }
  }
  // lamps and windows come on as it gets dark
  const lampOn = hex("#ffd568"), winOn = hex("#f3c35c");
  for (let c = 0; c < 3; c++) {
    lit[INK.LAMP * 3 + c] = shade[INK.LAMP * 3 + c] = lerp(lit[INK.LAMP * 3 + c], lampOn[c], s.lamp);
    lit[INK.WINDOW * 3 + c] = lerp(lit[INK.WINDOW * 3 + c], winOn[c], s.lamp);
    shade[INK.WINDOW * 3 + c] = lerp(shade[INK.WINDOW * 3 + c], winOn[c], s.lamp);
  }
  s.sunDir = dir(s.sunAz, s.sunEl);
  s.lightDir = dir(s.lightAz, s.lightEl);
  return s;
}
