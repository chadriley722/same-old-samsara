/* pneuma nomads · the road · the light
   The inks are the Pneuma Nomads palette: light cream, dark cream, pepper, night, and the sun-faded six (brick, clay,
   mustard, sage, denim, plum). The drive goes from a cold first light in the north to a warm sunset on the water, then
   home through the night, and it ends where it started: first light at the gate, in spring. */

import { INK } from "../walk/glsl.js";
import { DEG } from "../walk/m.js";

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, m) => [a[0] * m[0], a[1] * m[1], a[2] * m[2]];

export const SIX = ["#b8645a", "#c97b4a", "#d8ae55", "#7f9a6a", "#5f84a0", "#87709b"];      // brick, clay, mustard, sage, denim, plum

/* every ink in plain daylight: [in the light, in the shade] */
const BASE = [];
const ink = (i, lit, shade) => { BASE[i] = [hex(lit), hex(shade)]; };
ink(INK.GOLD, "#d8ae55", "#a98a45");          // dry seed heads
ink(INK.GREEN, "#9aaa7c", "#6f8158");         // grass
ink(INK.PATH, "#e6d6b2", "#b7a988");          // the shoulder
ink(INK.DIRT, "#d6c29a", "#a59472");
ink(INK.GRAVEL, "#f3e6c6", "#c8ba95");        // sand
ink(INK.FLOOR, "#bcae90", "#877b62");         // leaf litter, pine straw
ink(INK.LEAF, "#7f9a6a", "#56704a");
ink(INK.LEAF_DARK, "#5c7a55", "#3b523a");
ink(INK.LEAF_GOLD, "#d8ae55", "#a17f3a");
ink(INK.LEAF_RUST, "#c97b4a", "#935633");
ink(INK.BARK, "#80705f", "#514840");
ink(INK.BARK_PALE, "#eadfc4", "#b4a88e");
ink(INK.WATER, "#b9cdd6", "#7e9db0");
ink(INK.WHITE, "#fffaf0", "#d9cfb6");
ink(INK.RUST, "#8f4a42", "#6d3832");          // dark brick: the stripe on the camper, the shadow side of the pin
ink(INK.WINDOW, "#5e5c58", "#3c3b38");
ink(INK.PEPPER, "#514f4c", "#2e2d2b");
ink(INK.WOOD, "#b79769", "#806646");
ink(INK.MOSS, "#86a070", "#587251");          // palmetto
ink(INK.FLAME, "#d8ae55", "#d8ae55");
ink(INK.EMBER, "#d48a7f", "#d48a7f");         // the highlight on the pin
ink(INK.ROAD, "#96938c", "#6f6c66");
ink(INK.STONE, "#cdc6b6", "#938d80");         // the truck
ink(INK.CREAM, "#fff4d9", "#d2c6a5");
ink(INK.RAVEN, "#2e2d2b", "#232220");
ink(INK.LAMP, "#fff0c4", "#fff0c4");
SIX.forEach((c, k) => ink(INK.BEAD0 + k, c, c));
for (let i = 0; i < INK.COUNT; i++) if (!BASE[i]) BASE[i] = [hex("#ff00ff"), hex("#aa00aa")];

const FIXED = new Set([INK.FLAME, INK.EMBER, INK.LAMP, INK.RAVEN]);
const STRIPE = new Set([0, 1, 2, 3, 4, 5].map((k) => INK.BEAD0 + k));

/* how each part of the day changes an ink */
const MOODS = [
  /* day    */ (l, s) => [l, s],
  /* dawn   */ (l, s) => [mix(l, hex("#ebe6da"), 0.24), mix(s, hex("#74808a"), 0.3)],
  /* golden */ (l, s) => [mix(mul(l, [1.06, 0.94, 0.76]), hex("#d8ae55"), 0.13), mix(mul(s, [0.86, 0.76, 0.74]), hex("#5a4038"), 0.2)],
  /* dusk   */ (l, s) => [mix(s, hex("#5b4f63"), 0.45), mix(s, hex("#2e2d2b"), 0.7)],
  /* night  */ (l, s) => [mix(hex("#3a3836"), mul(l, [0.5, 0.5, 0.48]), 0.5), mix(hex("#232220"), s, 0.1)],
  /* spring */ (l, s) => [mix(l, hex("#f1ead6"), 0.14), mix(s, hex("#70807c"), 0.2)],
];
/* what a few inks turn into by spring: the dry gold and rust come back green */
const SPRING = { [INK.GOLD]: ["#b9c78c", "#869b6b"], [INK.GREEN]: ["#a5bf86", "#74915f"], [INK.FLOOR]: ["#b7b190", "#837d64"],
                 [INK.LEAF]: ["#96b47a", "#668651"], [INK.LEAF_GOLD]: ["#c6d292", "#90a66b"], [INK.LEAF_RUST]: ["#b6c98c", "#819a65"] };
const STRIPE_DIM = [0, 0.04, 0.03, 0.22, 0.45, 0.03];
const PAL = MOODS.map((fn, m) => BASE.map(([l, s], i) => {
  if (FIXED.has(i)) return [l, s];
  if (STRIPE.has(i)) { const c = mix(l, hex("#2e2d2b"), STRIPE_DIM[m]); return [c, c]; }
  return m === 5 && SPRING[i] ? fn(hex(SPRING[i][0]), hex(SPRING[i][1])) : fn(l, s);
}));

/* ---------- the drive, stop by stop ---------- */
/* directions: 0 is straight down the road (south), 90 is to your right (west), -90 to your left (east) */
const BASE_KEY = {
  sunAz: -8, sunEl: 54, lightAz: -8, lightEl: 54, shadow: 0.9,
  w: [1, 0, 0, 0, 0, 0],                                 // day, dawn, golden, dusk, night, spring
  paper: hex("#fff4d9"), key: hex("#514f4c"), keyAmt: 0.9, hatch: 1,
  band: [...hex("#f0e2bc"), 0.7], band2: [...hex("#f7ecce"), 0.55],
  sunCol: hex("#dfb055"), sunSize: 2.4,
  fogCol: hex("#efe6cc"), fogD: 0.0013, fogLow: 1.2, fogMax: 0.6,
  haze: hex("#dcd3b6"),
  cloud: 0.5, cloudShadeAmt: 0.75, cloudLitAmt: 1, cloudShade: hex("#cfc8b2"), cloudLit: hex("#fffaf0"),
  stars: 0, moon: 0, rule: 0.3, fire: 0, lamp: 0, glitter: 0.25, wind: 0.5,
};
const K = (u, o) => ({ ...BASE_KEY, ...o, u });
/* the cold first light you leave in, and come home in */
const FIRST = { sunAz: -72, sunEl: 5.5, lightAz: -72, lightEl: 10, shadow: 0.55, paper: hex("#f6eedd"), keyAmt: 0.88, hatch: 0.9,
  band: [...hex("#e6b7a2"), 0.9], band2: [...hex("#ecdfd0"), 0.8], sunCol: hex("#d98e5a"), sunSize: 2.7,
  fogCol: hex("#e9e6dc"), fogD: 0.0025, fogLow: 3, fogMax: 0.8, haze: hex("#d6d8d4"),
  cloud: 0.45, cloudShade: hex("#cbbfc0"), cloudLit: hex("#fffaf0"), rule: 0.22, glitter: 0, wind: 0.4 };
/* the night you drive home through: cream lines on the night ink, the moon out over the road ahead */
const NIGHT = { sunAz: 150, sunEl: -40, lightAz: 150, lightEl: 34, shadow: 0.5, w: [0, 0, 0, 0, 1, 0],
  paper: hex("#2e2d2b"), key: hex("#ecdcb8"), keyAmt: 0.78, hatch: 0.8,
  band: [...hex("#423f44"), 0.9], band2: [...hex("#373537"), 0.7], sunSize: 0,
  fogCol: hex("#2f2e2c"), fogD: 0.0024, fogLow: 2, fogMax: 0.7, haze: hex("#232220"),
  cloud: 0.4, cloudShade: hex("#2b2a29"), cloudLit: hex("#4b4947"), cloudShadeAmt: 0.6,
  stars: 1, moon: 1, rule: 0.2, lamp: 1, glitter: 0, wind: 0.3 };

const DRIVE = [
  // 0: leaving, at first light. cold, a little frost, the sun just up on your left
  K(0, { ...FIRST, w: [0, 1, 0, 0, 0, 0] }),
  // 1: the morning, in the hills. the far ranges go blue
  K(1, { sunAz: -44, sunEl: 27, lightAz: -44, lightEl: 27, w: [0.78, 0.22, 0, 0, 0, 0],
         band: [...hex("#e3dcc6"), 0.75], band2: [...hex("#eee8d3"), 0.55],
         fogCol: hex("#cfd8d8"), fogD: 0.0021, fogLow: 1.5, fogMax: 0.74, haze: hex("#bfcbd0"), cloud: 0.55, wind: 0.5 }),
  // 2: midday on the pine flats
  K(2, {}),
  // 3: the long light of the afternoon, the sun coming round to your right
  K(3, { sunAz: 54, sunEl: 17, lightAz: 54, lightEl: 17, shadow: 0.85, w: [0.3, 0, 0.7, 0, 0, 0], paper: hex("#fdebc8"),
         band: [...hex("#e6a45c"), 0.9], band2: [...hex("#f2cf94"), 0.8], sunCol: hex("#dc9a40"), sunSize: 2.8,
         fogCol: hex("#f0d9ac"), fogD: 0.0018, fogLow: 2, fogMax: 0.68, haze: hex("#dcc08f"),
         cloudShade: hex("#d19a62"), cloudLit: hex("#fff2d2"), rule: 0.2, glitter: 0.5, wind: 0.45 }),
  // 4: the far end of the road. the sun going down into the water
  K(4, { sunAz: 43, sunEl: 2.6, lightAz: 58, lightEl: 9, shadow: 0.5, w: [0, 0, 0.72, 0.28, 0, 0], paper: hex("#f3d7a8"),
         key: hex("#45413d"), keyAmt: 0.82, hatch: 0.7,
         band: [...hex("#c96a4a"), 1], band2: [...hex("#e3a85a"), 0.95], sunCol: hex("#d8744a"), sunSize: 3.4,
         fogCol: hex("#dcb98a"), fogD: 0.0026, fogLow: 2, fogMax: 0.7, haze: hex("#b3908a"),
         cloud: 0.5, cloudShade: hex("#a5708a"), cloudLit: hex("#f8dcae"), rule: 0.14, lamp: 0.55, glitter: 1, stars: 0.1, wind: 0.35 }),
  // the way home (4 to 5). dusk while the rig turns round, then north through the night with the lights on
  K(4.14, { sunAz: 47, sunEl: -5, lightAz: 60, lightEl: 12, shadow: 0, w: [0, 0, 0.1, 0.9, 0, 0], paper: hex("#a48a86"), key: hex("#3f3b39"), keyAmt: 0.6, hatch: 0.4,
            band: [...hex("#b0604a"), 1], band2: [...hex("#8f6e7e"), 0.9], sunSize: 0,
            fogCol: hex("#8f7b78"), fogD: 0.003, fogLow: 2, fogMax: 0.78, haze: hex("#6f5f66"),
            cloud: 0.45, cloudShade: hex("#6f5a6e"), cloudLit: hex("#c79a86"), rule: 0.1, lamp: 0.9, glitter: 0.3, stars: 0.35, moon: 0.4, wind: 0.3 }),
  K(4.3, NIGHT),
  K(4.68, NIGHT),
  // the hour before the sun
  K(4.86, { sunAz: -76, sunEl: -6, lightAz: -70, lightEl: 14, shadow: 0, w: [0, 0.2, 0, 0.3, 0.3, 0.2], paper: hex("#8f8a7c"), key: hex("#8a857a"), keyAmt: 0.32, hatch: 0.18,
            band: [...hex("#c98a6a"), 0.95], band2: [...hex("#b9a58c"), 0.85], sunSize: 0,
            fogCol: hex("#908b7e"), fogD: 0.0034, fogLow: 4, fogMax: 0.85, haze: hex("#6e6a62"),
            cloud: 0.45, cloudShade: hex("#b87a62"), cloudLit: hex("#a8a08c"), stars: 0.25, moon: 0.4, rule: 0.1, lamp: 0.7, glitter: 0, wind: 0.3 }),
  // 5: home. the same first light you left in, and the green coming back
  K(5, { ...FIRST, w: [0, 0.4, 0, 0, 0, 0.6] }),
];

const lerp = (a, b, t) => a + (b - a) * t;
function blend(a, b, t) {
  const o = {};
  for (const k in a) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], t)) : lerp(a[k], b[k], t);
  return o;
}
function sample(keys, u) {
  if (u <= keys[0].u) return { ...keys[0] };
  for (let i = 1; i < keys.length; i++) if (u <= keys[i].u) return blend(keys[i - 1], keys[i], (u - keys[i - 1].u) / (keys[i].u - keys[i - 1].u));
  return { ...keys[keys.length - 1] };
}
const dir = (az, el) => [Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), -Math.cos(az * DEG) * Math.cos(el * DEG)];

export const MOON_DIR = dir(150, 26);            // up over the road ahead of you on the way home

/** the light at stop-progress u. fills lit and shade, and stripe (6 x rgb: the six colours as they look in this light). */
export function lightAt(u, lit, shade, stripe) {
  const s = sample(DRIVE, u);
  const w = s.w, sum = w[0] + w[1] + w[2] + w[3] + w[4] + w[5] || 1;
  for (let i = 0; i < INK.COUNT; i++) {
    for (let c = 0; c < 3; c++) {
      let l = 0, d = 0;
      for (let m = 0; m < 6; m++) { l += PAL[m][i][0][c] * w[m]; d += PAL[m][i][1][c] * w[m]; }
      lit[i * 3 + c] = l / sum; shade[i * 3 + c] = d / sum;
    }
  }
  // lamps and windows come on as it gets dark
  const lampOn = hex("#ffd98a"), winOn = hex("#f0c873");
  for (let c = 0; c < 3; c++) {
    lit[INK.LAMP * 3 + c] = shade[INK.LAMP * 3 + c] = lerp(lit[INK.LAMP * 3 + c], lampOn[c], s.lamp);
    lit[INK.WINDOW * 3 + c] = lerp(lit[INK.WINDOW * 3 + c], winOn[c], s.lamp);
    shade[INK.WINDOW * 3 + c] = lerp(shade[INK.WINDOW * 3 + c], winOn[c], s.lamp);
  }
  // the dashes down the middle of the road: the six, mixed well back into the road so they stay quiet
  for (let k = 0; k < 6; k++) for (let c = 0; c < 3; c++) stripe[k * 3 + c] = lerp(lit[INK.ROAD * 3 + c], lit[(INK.BEAD0 + k) * 3 + c], 0.78);
  s.sunDir = dir(s.sunAz, s.sunEl);
  s.lightDir = dir(s.lightAz, s.lightEl);
  return s;
}
