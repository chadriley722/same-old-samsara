/* pneuma nomads · the road · the world
   The road trip's scene: a made up road south, and home again. It is a drive: you ride along off the rig's rear quarter
   while the truck pulls the fifth wheel down the road. It pulls over at each stop, camps by the water, turns round, drives
   home through the night and turns back in at the gate it left from.
   Drawn by the same print engine as the walk (walk/print.js), in the Pneuma Nomads inks (road/light.js). */

import { m4, v3, lerp, clamp, smooth, DEG, rng } from "../walk/m.js";
import * as land from "./land.js";
import * as shapes from "./shapes.js";
import * as walkShapes from "../walk/mesh.js";
import { INK } from "../walk/glsl.js";
import { lightAt, MOON_DIR } from "./light.js";
import { Printer, NEAR, FAR, rotY, local, angLerp, mTurnZ } from "../walk/print.js";

export const STOP_IDS = ["leave", "vlog", "follow", "gas", "winter", "home"];
const P = land.PLACES, RZ = land.RIG_Z, LAST = STOP_IDS.length - 1;
const SCREEN = 4, POST = 1.8, PUMP = 1.5, CUP = 1.25;       // how much bigger than life the roadside things are
const HITCH = -1.7, NOSE = 3.65, AXLE = 5.4;                // the truck's bed (where the fifth wheel sits), the camper's nose, nose to axles
/* the last leg, 4 to 5, in three parts: turning round at the camp (until TURN), the drive north (until INBOUND), the turn in at the gate */
const TURN = 0.13, INBOUND = 0.92, R_TURN = 6.5, R_GATE = 8, GATE_RUN = 3.6;
/* how the rig sits at each stop: [the truck's turn off the road's own heading, the camper's turn off the truck's]. + is to its left */
const POSE = [[0.3, 0.72], [-0.2, -0.07], [-0.1, -0.04], [-0.12, -0.05], [-0.62, -0.12]];

/** a place by the road, as a world point */
const spot = (name, dy = 0) => { const [d, z] = P[name], p = land.beside(z, d); return [p[0], land.height(p[0], p[1]) + dy, p[1]]; };
const onRoad = (z, d, dy = 0) => { const p = land.roadAt(z, d); return [p[0], p[1] + dy, p[2]]; };
const yawOf = (h) => Math.atan2(-h[1], h[0]);                      // the turn that points a thing's +x along a heading
const facing = (from, to) => Math.atan2(to[0] - from[0], to[2] - from[2]);     // the turn that points a thing's +z from one spot at another
const ease = (f) => f * f * (3 - 2 * f);
/** where a thing ends up after turning from yaw0 to yaw on a circle of radius R, starting at [x, z]. more yaw is a turn to its left */
const arc = (from, yaw0, yaw, R) => [from[0] + R * (Math.sin(yaw) - Math.sin(yaw0)), from[1] + R * (Math.cos(yaw) - Math.cos(yaw0))];

/* ---------- the camera ---------- */
/* at a stop it stands where road/land.js CAM says and looks at `look`: [metres north of the truck, metres right of the centre line, height].
   shift: how far the picture is slid over to leave room for the words (N: on a narrow screen, where the words are underneath). */
const VIEWS = [
  { look: [3, 6.4, 2.1], shift: [0.12, -0.2], shiftN: [0, -0.4] },                          // leaving: the rig swinging out of the gate
  { look: [3, 9.5, 6.4], lookN: [3, 10.5, 7.2], shift: [0.22, 0.04], shiftN: [0, 0.36] },   // the latest vlog: the rig under the big screen
  { look: [3, 5.6, 3.0], shift: [0.24, 0], shiftN: [0, 0.38] },                             // follow along: pulled up at the signpost
  { look: [4.5, 7.6, 3.2], shift: [0.22, 0], shiftN: [0, 0.38] },                           // gas: at the pump, under the cup
  { look: [5.5, 10.75, 2.6], shift: [0.25, -0.04], shiftN: [0, 0.36] },                     // winter: camped by the water
  { look: [-1.5, 6.5, 2.2], shift: [0.22, -0.04], shiftN: [0, 0.34] },                      // home: turning back in at the gate
].map((v, k) => ({ ...v, cam: land.CAM[k] }));
/* out on the road it rides off the rig's rear quarter, so you see the truck and the fifth wheel both: the left quarter going
   south, the right one coming home. it keeps to the east verge both ways (road/land.js plants nothing there). */
const CHASE_S = { cam: [15.9, -8.5, 3.5], look: [4.6, 1.8, 1.9], shift: [0.2, 0], shiftN: [0, 0.3] };
const CHASE_N = { cam: [-15.9, -12.1, 3.5], look: [-4.6, -1.8, 1.9], shift: [0, 0], shiftN: [0, 0.3] };

/* ---------- the rig ---------- */
/** rolling down its lane at z. dir: 1 heading south, -1 heading north. off: metres out of the lane, to the right of the centre line */
function lane(z, dir, off = 0) {
  const yaw = yawOf(land.heading(z)) + (dir < 0 ? Math.PI : 0), d = land.LANE * dir + off, p = onRoad(z, d, 0.07);
  const hitch = local({ x: p[0], y: p[1], z: p[2], yaw }, [HITCH, 0, 0]), ax = onRoad(z + (AXLE - HITCH) * dir, d);
  return { x: p[0], y: p[1], z: p[2], yaw, cyaw: Math.atan2(-(hitch[2] - ax[2]), hitch[0] - ax[0]), park: 0 };
}
/** where the truck is and which way it and the fifth wheel point, at stop-progress u: { x, y, z, yaw, cyaw, park }.
    (y is only roughly the ground there. settle() is what sets the rig down on its wheels.) */
export function rigAt(u) {
  if (u <= 4) {
    // heading south. it eases away from each stop and up to the next, and pulls over where it stops
    const k = Math.min(Math.floor(u), 3), r = lane(lerp(RZ[k], RZ[k + 1], ease(u - k)), 1);
    const n = Math.round(u), park = n === 4 ? smooth(3.45, 3.95, u) : 1 - smooth(0.04, 0.3, Math.abs(u - n));
    if (park > 0) {
      const name = n === 4 ? "camp" : "park" + n, at = spot(name, 0.05), pyaw = yawOf(land.heading(P[name][1])) + POSE[n][0];
      r.x = lerp(r.x, at[0], park); r.y = lerp(r.y, at[1], park); r.z = lerp(r.z, at[2], park);
      r.cyaw = angLerp(r.cyaw, pyaw + POSE[n][1], park); r.yaw = angLerp(r.yaw, pyaw, park); r.park = park;
    }
    return r;
  }
  const f = u - 4, camp = spot("camp", 0.05), south = yawOf(land.heading(P.camp[1])), y0 = south + POSE[4][0], yN = south + Math.PI;
  const end = arc([camp[0], camp[2]], y0, yN, R_TURN);                      // where the turn leaves it: on the road, facing north
  if (f < TURN) {
    // turning round: one long left hand arc off the sand and back onto the road. the fifth wheel cuts the corner behind it
    const p = ease(f / TURN), yaw = y0 + (yN - y0) * p, [x, z] = arc([camp[0], camp[2]], y0, yaw, R_TURN);
    return { x, y: land.height(x, z) + 0.05, z, yaw, cyaw: yaw + POSE[4][1] * (1 - p) - 0.8 * Math.sin(Math.PI * p), park: 1 - p };
  }
  const zIn = P.gate[1] - R_GATE;                                           // where it starts the turn in at the gate
  if (f < INBOUND) {
    // the drive home. it settles into its lane over the first stretch
    const g = (f - TURN) / (INBOUND - TURN), off = (land.lateral(end[0], end[1]) + land.LANE) * (1 - smooth(0, 0.05, g));
    return lane(lerp(end[1], zIn, ease(g)), -1, off);
  }
  // turning in: a quarter turn to the left across the road, then straight at the gate. it stops with the truck's nose in the gateway
  const g = ease((f - INBOUND) / (1 - INBOUND)), from = lane(zIn, -1), run = R_GATE * Math.PI / 2, s = g * (run + GATE_RUN);
  const yaw = from.yaw + Math.min(s, run) / R_GATE, on = arc([from.x, from.z], from.yaw, yaw, R_GATE), past = Math.max(s - run, 0);
  const x = on[0] + Math.cos(yaw) * past, z = on[1] - Math.sin(yaw) * past;
  return { x, y: land.height(x, z) + 0.05, z, yaw, cyaw: yaw - 0.8 * smooth(0, 0.45, g) * (1 - 0.22 * smooth(0.7, 1, g)), park: smooth(0.7, 1, g) };
}

/* ---------- setting the rig down on the road ---------- */
const FRONT = 1.85, REAR = -1.9;                 // the truck's axles, ahead of and behind its middle (walk/mesh.js truck())
const AXLES = 1.725, BACK = NOSE + AXLES;        // the camper's axles behind its own middle, and behind the hitch (walk/mesh.js camper())
/** how high the surface is under a wheel at [x, z]: the road's own ribbon where the wheel is on the road, the ground where it is off it */
export function surface(x, z) {
  const d = land.lateral(x, z), off = smooth(land.HALF, land.HALF + 0.35, Math.abs(d));
  return lerp(land.roadY(z - land.heading(z)[0] * d) + 0.07, land.height(x, z) + 0.01, off);
}
/** the rig, set down on its wheels: the truck on its two axles, the fifth wheel on its own axles and on the hitch in the truck's bed.
    so on a hill both of them tip with the road, and neither one sinks into it or hangs over it. each is [x, y, z, yaw, tip]. */
export function settle(rig) {
  // an axle sits on whichever of its two wheels is on the higher ground (one can be on the road and the other on the shoulder)
  const axle = (x, z, yaw, half) => { const sx = Math.sin(yaw) * half, sz = Math.cos(yaw) * half; return Math.max(surface(x + sx, z + sz), surface(x - sx, z - sz)); };
  const F = [Math.cos(rig.yaw), -Math.sin(rig.yaw)];
  const yF = axle(rig.x + F[0] * FRONT, rig.z + F[1] * FRONT, rig.yaw, 0.9), yR = axle(rig.x + F[0] * REAR, rig.z + F[1] * REAR, rig.yaw, 0.9);
  const tip = Math.atan2(yF - yR, FRONT - REAR), y = yR + (yF - yR) * (-REAR / (FRONT - REAR));
  const hx = rig.x + F[0] * HITCH, hz = rig.z + F[1] * HITCH, hy = y + HITCH * Math.sin(tip);            // the hitch rides up and down with the truck's bed
  const C = [Math.cos(rig.cyaw), -Math.sin(rig.cyaw)], ya = axle(hx - C[0] * BACK, hz - C[1] * BACK, rig.cyaw, 1.13);
  return { truck: [rig.x, y, rig.z, rig.yaw, tip], camper: [hx - C[0] * NOSE, ya + (hy - ya) * (AXLES / BACK), hz - C[1] * NOSE, rig.cyaw, Math.atan2(hy - ya, BACK)] };
}

export class RoadWorld extends Printer {
  constructor(canvas, opts = {}) {
    super(canvas, opts);
    this.moonDir = MOON_DIR; this.lowGround = land.WATER_Y + 3;
    this.roadLine = 1; this.stripe = new Float32Array(18);
    this.honk = 0; this.at = 0;
    this.build();
  }
  lightAt(u) { return lightAt(u, this.lit, this.shade, this.stripe); }

  scene(q) {
    const tier = this.tier;
    // the strip of country, the road down the middle of it, the water at the end
    const G = land.buildGround(tier === 2 ? 3.5 : tier === 1 ? 4.5 : 6);
    this.ground = this.groundMesh(G.pos, G.nor, G.mask, G.idx);
    const ribbon = (pts, hw, lift, flat) => {
      const r = land.buildRibbon(pts, hw, lift, flat), n = r.pos.length / 3, mask = new Float32Array(n * 4);
      for (let k = 0; k < n; k++) { mask[k * 4] = r.uv[k * 2]; mask[k * 4 + 1] = r.uv[k * 2 + 1]; }
      return this.groundMesh(r.pos, null, mask, r.idx);
    };
    this.ribbons.push({ mesh: ribbon(land.roadPoints(), land.HALF, 0.07), kind: 3 }, { mesh: ribbon(land.waterPoints(), 150, 0, land.WATER_Y), kind: 4, flat: true });

    // trees: one mesh per kind and distance, drawn many times
    const trees = land.plantTrees(q), rand = rng(7);
    for (let sp = 0; sp < 5; sp++) for (let lod = 0; lod < 3; lod++) {
      const list = trees.filter((t) => t.species === sp && t.lod === lod);
      if (!list.length) continue;
      const data = new Float32Array(list.length * 8);
      list.forEach((t, k) => data.set([t.x, t.y, t.z, t.scale, Math.cos(t.yaw), Math.sin(t.yaw), t.ink, 8 + ((rand() * 28) | 0) * 8], k * 8));
      const geo = sp === land.SPECIES.PALM ? shapes.palmTree() : sp === land.SPECIES.BARE ? shapes.bareTree(lod) : walkShapes.buildTree(sp, lod);
      const mesh = this.mesh(geo.build());
      this.instances(mesh, data);
      this.trees.push({ mesh, lod, cull: sp < 2 });
    }
    // what grows on the verge
    const plants = land.plantVerge(q), heads = [], blades = [];
    for (let k = 0; k < plants.length; k += 6) (plants[k + 5] === 0 ? heads : blades).push(plants[k], plants[k + 1], plants[k + 2], plants[k + 3], plants[k + 4], plants[k + 5]);
    this.plants.push(this.plantMesh(new Float32Array(heads), 0), this.plantMesh(new Float32Array(blades), 1));

    // things by the road
    let nextId = 16;
    const add = (geo, pos, yaw = 0, s = 1, extra = {}) => {
      const p = { mesh: this.mesh(geo.build()), model: rotY(m4.create(), pos[0], pos[1], pos[2], yaw, s), id: nextId, x: pos[0], y: pos[1], z: pos[2], yaw, s, ...extra };
      nextId = nextId >= 232 ? 16 : nextId + 8;
      this.props.push(p); return p;
    };
    const eyes = STOP_IDS.map((_, k) => onRoad(RZ[k] + land.CAM[k][0], land.CAM[k][1], land.CAM[k][2]));       // where the camera stands at each stop
    // the land's gate and mailbox: where the trip starts, and where it ends
    const gate = spot("gate");
    add(walkShapes.gate(), gate, yawOf(land.heading(P.gate[1])) + Math.PI);                   // its leaf swung open, away from the road
    add(walkShapes.mailbox(), spot("mailbox"), yawOf(land.heading(P.mailbox[1])) + Math.PI);
    // the screen: the engine's film goes on its sheet. it is as big as a drive-in's, with its feet well into the ground
    const scr = spot("screen", 3.1);
    this.screen = add(shapes.roadScreen(), scr, facing(scr, eyes[1]), SCREEN);
    const post = spot("signpost"); add(shapes.signpost(), post, facing(post, eyes[2]) + 0.25, POST);
    const pump = spot("pump"); this.pump = add(shapes.gasPump(), pump, facing(pump, eyes[3]) + 0.3, PUMP);
    const cup = spot("cup"); add(shapes.cupSign(), cup, facing(cup, eyes[3]) - 0.3, CUP);
    // the camp: two chairs turned to the water, the sign that points home
    const sea = land.beside(P.chairs[1] - 6, 90), west = [sea[0], 0, sea[1]];
    const ch = spot("chairs"), seat = (ink, dx, dz) => { const at = [ch[0] + dx, ch[1], ch[2] + dz]; return add(walkShapes.chair(ink), at, facing(at, west), 1.25); };
    seat(INK.BEAD4, 0, 0); seat(INK.BEAD2, -0.5, -1.9);
    const north = spot("north"); add(shapes.northSign(), north, facing(north, eyes[4]), 1.3);
    // the wire that follows the road out of the north
    const poles = land.poles(), line = new walkShapes.Geo(), wire = [INK.PEPPER, 0, 9, 0];
    poles.forEach((p, k) => {
      const yaw = yawOf(land.heading(p[2])) + Math.PI / 2, c = Math.cos(yaw), s = Math.sin(yaw);
      line.add(shapes.pole(), { pos: p, yaw });
      const n = poles[k + 1];
      if (n) {
        const y2 = yawOf(land.heading(n[2])) + Math.PI / 2, c2 = Math.cos(y2), s2 = Math.sin(y2);
        for (const [ax, ay] of shapes.POLE_WIRE) {
          const a = [p[0] + c * ax, p[1] + ay, p[2] - s * ax], b = [n[0] + c2 * ax, n[1] + ay, n[2] - s2 * ax], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.55 * (Math.hypot(b[0] - a[0], b[2] - a[2]) / 46) ** 2, (a[2] + b[2]) / 2];      // a longer span hangs lower
          line.add(walkShapes.tube(a, mid, 0.012, 0.012, 3, wire, 4, false)).add(walkShapes.tube(mid, b, 0.012, 0.012, 3, wire, 4, false));
        }
      }
    });
    this.props.push({ mesh: this.mesh(line.build()), model: m4.create(), id: 240, noShadow: true });

    // the rig: the truck and the fifth wheel. they are placed every frame (see animate).
    this.truck = add(walkShapes.truck(), [0, 0, 0]);
    this.camper = add(walkShapes.camper(true), [0, 0, 0]);
    this.trim = add(shapes.rigTrim(), [0, 0, 0], 0, 1, { noShadow: true });
    // a pixel pin over each stop's thing, and over the gate
    const pinGeo = shapes.pixelPin(0.12);
    this.pins = [[scr[0], scr[1] + 12.2, scr[2], 1.7], [post[0], post[1] + 3.5 * POST + 0.7, post[2], 1.3], [pump[0], pump[1] + 2.3 * PUMP + 0.7, pump[2], 1.15],
                 [ch[0] - 0.3, ch[1] + 3.4, ch[2] - 1, 1.1], [gate[0], gate[1] + 3.3, gate[2], 1.1]]
      .map((at, k) => ({ ...add(pinGeo, at, 0, 1, { noShadow: true }), at, k, size: at[3] }));

    const seeds = new Float32Array(16 * 4);
    this.motes = this.moteMesh(seeds);
  }

  /** u: stop progress (0 = leaving, 4 = the water, 5 = home again). head, slide, seen: as in the walk. */
  camera(u, head, slide = 1, seen = 1) {
    const aspect = this.cssW / this.cssH;
    u = clamp(u, 0, LAST);
    const rig = (this.rig = rigAt(u)), n = Math.round(u), V = VIEWS[n], C = u > 4 ? CHASE_N : CHASE_S;
    // how much this is the stop's own view: 1 at the stop, 0 out on the road. leaving the camp it lets go fast, to get round
    // behind the rig before the rig has turned round. and it comes across the road to the gate late, once it is past the poles
    const w = u > 4 && n === 4 ? 1 - smooth(0.015, TURN, u - 4) : n === 5 ? 1 - smooth(0.03, 0.2, 5 - u) : 1 - smooth(0.06, 0.4, Math.abs(u - n));
    const narrow = 1 - smooth(0.8, 1.25, aspect);
    const mix = (a, b) => [lerp(a[0], b[0], w), lerp(a[1], b[1], w), lerp(a[2], b[2], w)];
    const cm = mix(C.cam, V.cam), lk = mix(C.look, V.lookN && narrow > 0 ? v3.lerp(V.look, V.lookN, narrow) : V.look);
    const eye = onRoad(rig.z + cm[0], cm[1], cm[2]), to = v3.sub(onRoad(rig.z + lk[0], lk[1], lk[2]), eye);
    const yaw = Math.atan2(to[0], -to[2]) + head[0], pitch = clamp(Math.atan2(to[1], Math.hypot(to[0], to[2])) + head[1], -1.2, 1.2);
    const fwd = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
    const sh = (v) => [lerp(v.shift[0], v.shiftN[0], narrow), lerp(v.shift[1], v.shiftN[1], narrow)];
    const sc = sh(C), sv = sh(V), shift = [lerp(sc[0], sv[0], w) * slide, lerp(sc[1], sv[1], w) * slide * seen + (1 - seen)];
    const hfov = lerp(46, 80, smooth(0.5, 1.8, aspect)) * DEG;
    const vfov = clamp(2 * Math.atan(Math.tan(hfov / 2) / aspect), 42 * DEG, 82 * DEG);
    m4.lookAt(this.view, eye, v3.add(eye, fwd), [0, 1, 0]);
    m4.perspective(this.proj, vfov, aspect, NEAR, FAR, shift[0], shift[1]);
    m4.mul(this.vp, this.proj, this.view);
    const right = v3.norm(v3.cross(fwd, [0, 1, 0])), up = v3.cross(right, fwd);
    return (this.cam = { eye, fwd, right, up, tanV: Math.tan(vfov / 2), tanH: Math.tan(vfov / 2) * aspect, shift, yaw, f: u - Math.floor(u) });
  }

  /* ---------- what moves: the rig, and the pins ---------- */
  animate(u, time, L, dt, still) {
    const rig = this.rig, cam = this.cam;
    this.at = u;
    // both of them are set down on their wheels, so they tip with the road on the hills
    const { truck: T, camper: K } = settle(rig), cpos = [K[0], K[1], K[2]];
    const bump = still ? 0 : Math.sin(time * 7.1) * 0.012 * (1 - rig.park) * smooth(0, 0.08, Math.abs(Math.sin(Math.PI * cam.f)))      // a little life in the springs while it rolls
                             + this.honk * Math.abs(Math.sin(time * 15)) * 0.24;                                                  // and a hop when you press it
    mTurnZ(rotY(this.truck.model, T[0], T[1] + bump, T[2], T[3], 1), T[4]);
    mTurnZ(rotY(this.camper.model, K[0], K[1] + bump * 0.6, K[2], K[3], 1), K[4]);
    this.trim.model.set(this.camper.model);
    this.beam = [rig.x + Math.cos(rig.yaw) * 8, T[1] + 0.6, rig.z - Math.sin(rig.yaw) * 8];        // where the headlights land
    this.hot.rig = [cpos[0], cpos[1] + 3.2, cpos[2]];
    this.hot.cup = spot("cup", 5.9 * CUP);
    this.hot.post = spot("signpost", 2.4 * POST);
    this.hot.north = spot("north", 3);
    this.hot.mailbox = spot("mailbox", 1.25);
    // the pins bob a little, and always face you
    for (const pin of this.pins) {
      const y = pin.at[1] + (still ? 0 : Math.sin(time * 1.4 + pin.k * 1.7) * 0.16);
      rotY(pin.model, pin.at[0], y, pin.at[2], Math.atan2(cam.eye[0] - pin.at[0], cam.eye[2] - pin.at[2]), pin.size);
    }
    this.honk *= Math.exp(-dt * 3);
  }

  /* the pump's globe, a lantern at the camp while the rig is there, and the headlights */
  pools(L) {
    const pm = this.pump, ch = spot("chairs", 0.9), b = this.beam, camped = smooth(3.6, 4, this.at) * (1 - smooth(4.02, 4.12, this.at));
    return [[pm.x, pm.y + 2 * PUMP, pm.z, 7, ch[0] - 1.6, ch[1], ch[2] - 0.6, 5.5, b[0], b[1], b[2], 11],
            [0.98, 0.82, 0.5, L.lamp * 0.6, 0.97, 0.74, 0.4, L.lamp * 0.9 * camped, 1, 0.9, 0.62, L.lamp * 0.8 * (1 - camped)]];
  }
  extras() {}
  specks() {}
}
export { RoadWorld as World };

/** the things you can press on the road (walk/walk.js asks for these) */
export function hot({ world, say, u }) {
  return [
    { id: "rig", label: "the rig", range: 90, when: () => true,
      act: () => { world.honk = 1; say(u() > 4.94 ? "home." : u() > 4.2 ? "honk. quietly. it's the middle of the night." : u() > 3.6 ? "parked. finally." : "honk honk.", "rig"); } },
    { id: "post", label: "the signpost", range: 50, when: () => Math.abs(u() - 2) < 0.6, act: () => say("every one of them points somewhere warm.", "post") },
    { id: "cup", label: "the big cup", range: 60, when: () => Math.abs(u() - 3) < 0.6, act: () => say("coffee first. then gas.", "cup") },
    { id: "north", label: "the sign", range: 60, when: () => u() > 3.6 && u() < 4.1, act: () => say("home is back that way. see you in may.", "north") },
    { id: "mailbox", label: "the mailbox", range: 45, when: () => u() < 0.35 || u() > 4.8, act: () => say(u() < 1 ? "hold our mail till may." : "six months of mail. mostly seed catalogs.", "mailbox") },
  ];
}
