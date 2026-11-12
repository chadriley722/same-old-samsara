/* pneuma nomads · the road · the world
   The road trip's scene: a made up road south, the rig driving it a little ahead of you, and the things beside it.
   Drawn by the same print engine as the walk (walk/print.js), in the Pneuma Nomads inks (road/light.js). */

import { m4, v3, lerp, clamp, smooth, DEG, rng } from "../walk/m.js";
import * as land from "./land.js";
import * as shapes from "./shapes.js";
import * as walkShapes from "../walk/mesh.js";
import { INK } from "../walk/glsl.js";
import { lightAt, MOON_DIR } from "./light.js";
import { Printer, NEAR, FAR, rotY, local, angDiff, angLerp } from "../walk/print.js";

export const STOP_IDS = ["leave", "vlog", "follow", "fuel", "home"];
const P = land.PLACES, Z = land.STOPS_Z, CAM_D = land.CAM_D;
const LEAD = 29;               // how far ahead of you the truck is
const SCREEN = 4, POST = 1.8, PUMP = 1.5, CUP = 1.25;       // how much bigger than life the roadside things are
const HITCH = -1.7, NOSE = 3.65, AXLE = 5.4;      // the truck's bed (where the fifth wheel sits), the camper's nose, nose to axles

/** a place by the road, as a world point */
const spot = (name, dy = 0) => { const [d, z] = P[name], p = land.beside(z, d); return [p[0], land.height(p[0], p[1]) + dy, p[1]]; };
const onRoad = (z, d, dy = 0) => { const p = land.roadAt(z, d); return [p[0], p[1] + dy, p[2]]; };
const yawOf = (h) => Math.atan2(-h[1], h[0]);                      // the turn that points a thing's +x along a heading
const facing = (from, to) => Math.atan2(to[0] - from[0], to[2] - from[2]);     // the turn that points a thing's +z from one spot at another
const stand = (k) => onRoad(Z[k], CAM_D, land.EYE);                // where the camera is at stop k

/* where the camera looks at each stop, and how far the picture is slid over to leave room for the words */
const VIEWS = [
  { look: onRoad(-48, 6.4, 2.1), shift: [0.12, -0.2], shiftN: [0, -0.4] },                              // leaving: the rig coming out of the gate
  { look: spot("screen", 7.4), shift: [-0.27, 0.04], shiftN: [0, 0.36] },                               // the latest vlog, on the roadside screen
  { look: spot("signpost", 3.7), lookN: spot("signpost", 5.2), shift: [0.27, 0], shiftN: [0, 0.42] },                                 // follow along: the signpost
  { look: onRoad(Z[3] - 16.7, -10.1, 3.6), lookN: spot("pump", 5), shift: [-0.27, 0], shiftN: [0, 0.42] },   // fuel: the cup, the pump and the rig
  { look: v3.lerp(spot("camp", 2.6), spot("chairs", 2.6), 0.5), shift: [0.25, -0.04], shiftN: [0, 0.36] },   // the end: the camp by the water
];

export class RoadWorld extends Printer {
  constructor(canvas, opts = {}) {
    super(canvas, opts);
    this.moonDir = MOON_DIR; this.lowGround = land.WATER_Y + 3;
    this.roadLine = 1; this.stripe = new Float32Array(18);
    this.honk = 0;
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
    const eyes = STOP_IDS.map((_, k) => stand(k));
    // the land's gate and mailbox, where the rig has just pulled out
    add(walkShapes.gate(), spot("gate"), yawOf(land.heading(P.gate[1])) + Math.PI);          // its leaf swung open, away from the road
    add(walkShapes.mailbox(), spot("mailbox"), yawOf(land.heading(P.mailbox[1])) + Math.PI);
    // the screen: the engine's film goes on its sheet. it is as big as a drive-in's, with its feet well into the ground
    const scr = spot("screen", 3.1);
    this.screen = add(shapes.roadScreen(), scr, facing(scr, eyes[1]), SCREEN);
    const post = spot("signpost"); add(shapes.signpost(), post, facing(post, eyes[2]) + 0.25, POST);
    const pump = spot("pump"); this.pump = add(shapes.gasPump(), pump, facing(pump, eyes[3]) + 0.3, PUMP);
    const cup = spot("cup"); add(shapes.cupSign(), cup, facing(cup, eyes[3]) - 0.3, CUP);
    // the end of the road: two chairs turned to the water, the sign that points home
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
          const a = [p[0] + c * ax, p[1] + ay, p[2] - s * ax], b = [n[0] + c2 * ax, n[1] + ay, n[2] - s2 * ax], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.55, (a[2] + b[2]) / 2];
          line.add(walkShapes.tube(a, mid, 0.012, 0.012, 3, wire, 4, false)).add(walkShapes.tube(mid, b, 0.012, 0.012, 3, wire, 4, false));
        }
      }
    });
    this.props.push({ mesh: this.mesh(line.build()), model: m4.create(), id: 240, noShadow: true });

    // the rig: the truck and the fifth wheel. they are placed every frame (see animate).
    this.truck = add(walkShapes.truck(), [0, 0, 0]);
    this.camper = add(walkShapes.camper(true), [0, 0, 0]);
    this.trim = add(shapes.rigTrim(), [0, 0, 0], 0, 1, { noShadow: true });
    // a pixel pin over each stop's thing
    const pinGeo = shapes.pixelPin(0.12);
    this.pins = [[scr[0], scr[1] + 12.2, scr[2], 1.7], [post[0], post[1] + 3.5 * POST + 0.7, post[2], 1.3], [pump[0], pump[1] + 2.3 * PUMP + 0.7, pump[2], 1.15], [ch[0] - 0.3, ch[1] + 3.4, ch[2] - 1, 1.1]]
      .map((at, k) => ({ ...add(pinGeo, at, 0, 1, { noShadow: true }), at, k, size: at[3] }));

    const seeds = new Float32Array(16 * 4);
    this.motes = this.moteMesh(seeds);
  }

  /* ---------- the camera ---------- */
  /** u: stop progress (0 = leaving, 4 = the water). head, slide, seen: as in the walk. */
  camera(u, head, slide = 1, seen = 1) {
    const aspect = this.cssW / this.cssH, last = STOP_IDS.length - 1;
    u = clamp(u, 0, last);
    const k = Math.min(Math.floor(u), last - 1), f = u - k, e = f * f * (3 - 2 * f);
    const z = lerp(Z[k], Z[k + 1], e);
    const eye = onRoad(z, CAM_D, land.EYE);
    const narrow = 1 - smooth(0.8, 1.25, aspect);
    // which way you face at a stop: from where you stand there to its thing (not from where you are now, or the thing you just left would drag your head round behind you)
    const look = (i) => { const v = VIEWS[i], t = v.lookN && narrow > 0 ? v3.lerp(v.look, v.lookN, narrow) : v.look; const d = v3.sub(t, stand(i)); return [Math.atan2(d[0], -d[2]), Math.atan2(d[1], Math.hypot(d[0], d[2]))]; };
    const A = look(k), B = look(k + 1);
    // between stops you look down the road, past the rig
    const ahead = onRoad(z - 46, 1.2, 1.6), dx = ahead[0] - eye[0], dz = ahead[2] - eye[2];
    const driveYaw = Math.atan2(dx, -dz), drivePitch = clamp(Math.atan2(ahead[1] - eye[1], Math.hypot(dx, dz)), -0.25, 0.25);
    const ww = Math.pow(Math.sin(Math.PI * f), 2) * 0.94;
    const yaw = angLerp(angLerp(A[0], B[0], e), driveYaw, ww) + head[0];
    const pitch = clamp(lerp(lerp(A[1], B[1], e), drivePitch, ww) + head[1], -1.2, 1.2);
    const fwd = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
    const va = VIEWS[k], vb = VIEWS[k + 1];
    const sh = (v) => [lerp(v.shift[0], v.shiftN[0], narrow), lerp(v.shift[1], v.shiftN[1], narrow)];
    const sa = sh(va), sb = sh(vb), shift = [lerp(sa[0], sb[0], e) * (1 - ww * 0.8) * slide, lerp(sa[1], sb[1], e) * (1 - ww * 0.5) * slide * seen + (1 - seen)];
    const hfov = lerp(46, 80, smooth(0.5, 1.8, aspect)) * DEG;
    const vfov = clamp(2 * Math.atan(Math.tan(hfov / 2) / aspect), 42 * DEG, 82 * DEG);
    m4.lookAt(this.view, eye, v3.add(eye, fwd), [0, 1, 0]);
    m4.perspective(this.proj, vfov, aspect, NEAR, FAR, shift[0], shift[1]);
    m4.mul(this.vp, this.proj, this.view);
    const right = v3.norm(v3.cross(fwd, [0, 1, 0])), up = v3.cross(right, fwd);
    return (this.cam = { eye, fwd, right, up, tanV: Math.tan(vfov / 2), tanH: Math.tan(vfov / 2) * aspect, shift, yaw, z, k, f, e, ww });
  }

  /* ---------- what moves: the rig, and the pins ---------- */
  animate(u, time, L, dt, still) {
    const cam = this.cam;
    // driving: the truck holds the right hand lane a few lengths ahead of you, and the fifth wheel follows its hitch
    const zt = cam.z - LEAD, th = land.heading(zt), ty = yawOf(th), tp = onRoad(zt, land.LANE, 0.07);
    const hitch = local({ x: tp[0], y: tp[1], z: tp[2], yaw: ty }, [HITCH, 0, 0]);
    const ax = onRoad(zt + AXLE - HITCH, land.LANE), cy = Math.atan2(-(hitch[2] - ax[2]), hitch[0] - ax[0]);
    // at each stop it pulls over: in front of the screen, past the signpost, at the pump. at the end it is parked by the
    // water with its nose swung round toward it.
    let T = { x: tp[0], y: tp[1], z: tp[2], yaw: ty }, C = { yaw: cy }, park = 0;
    const k = Math.round(u), near = 1 - smooth(0.05, 0.3, Math.abs(u - k));
    if (near > 0) {
      // [the truck's turn off the road's own heading, the camper's turn off the truck's]: + is to the left
      const [swing, fold] = [[0.3, 0.72], [0.66, -0.22], [0.16, 0.1], [0.2, 0.12], [-0.62, -0.12]][k];
      const name = k === 4 ? "camp" : "park" + k, at = spot(name, 0.05);
      const pyaw = yawOf(land.heading(P[name][1])) + swing;
      park = k === 4 ? smooth(3.5, 3.94, u) : near;
      T = { x: lerp(T.x, at[0], park), y: lerp(T.y, at[1], park), z: lerp(T.z, at[2], park), yaw: angLerp(ty, pyaw, park) };
      C.yaw = angLerp(cy, pyaw + fold, park);
    }
    const h2 = local(T, [HITCH, 0, 0]);
    const cpos = [h2[0] - Math.cos(C.yaw) * NOSE, T.y, h2[2] + Math.sin(C.yaw) * NOSE];
    const bump = still ? 0 : Math.sin(time * 7.1) * 0.012 * (1 - park) * smooth(0, 0.08, Math.abs(Math.sin(Math.PI * cam.f)))      // a little life in the springs while it rolls
                             + this.honk * Math.abs(Math.sin(time * 15)) * 0.24;                                                  // and a hop when you press it
    rotY(this.truck.model, T.x, T.y + bump, T.z, T.yaw, 1);
    rotY(this.camper.model, cpos[0], cpos[1] - 0.1 + bump * 0.6, cpos[2], C.yaw, 1);
    this.trim.model.set(this.camper.model);
    this.rigAt = [T.x, T.y, T.z];
    this.hot.rig = [cpos[0], cpos[1] + 3.2, cpos[2]];
    this.hot.cup = spot("cup", 5.9 * CUP);
    this.hot.post = spot("signpost", 2.4 * POST);
    this.hot.north = spot("north", 3);
    // the pins bob a little, and always face you
    for (const pin of this.pins) {
      const y = pin.at[1] + (still ? 0 : Math.sin(time * 1.4 + pin.k * 1.7) * 0.16);
      rotY(pin.model, pin.at[0], y, pin.at[2], Math.atan2(cam.eye[0] - pin.at[0], cam.eye[2] - pin.at[2]), pin.size);
    }
    this.honk *= Math.exp(-dt * 3);
  }

  /* the pump's globe, and a lantern at the camp */
  pools(L) {
    const pm = this.pump, ch = spot("chairs", 0.9);
    return [[pm.x, pm.y + 2 * PUMP, pm.z, 7, ch[0] - 1.6, ch[1], ch[2] - 0.6, 5.5, 0, 0, 0, 1],
            [0.98, 0.82, 0.5, L.lamp * 0.6, 0.97, 0.74, 0.4, L.lamp * 0.9, 0, 0, 0, 0]];
  }
  extras() {}
  specks() {}
}
export { RoadWorld as World };

/** the things you can press on the road (walk/walk.js asks for these) */
export function hot({ world, say, u }) {
  return [
    { id: "rig", label: "the rig", range: 90, when: () => true, act: () => { world.honk = 1; say(u() > 3.6 ? "parked. finally." : "honk honk.", "rig"); } },
    { id: "post", label: "the signpost", range: 50, when: () => Math.abs(u() - 2) < 0.6, act: () => say("every one of them points somewhere warm.", "post") },
    { id: "cup", label: "the big cup", range: 60, when: () => Math.abs(u() - 3) < 0.6, act: () => say("coffee first. then gas.", "cup") },
    { id: "north", label: "the sign", range: 40, when: () => u() > 3.6, act: () => say("home is back that way. see you in may.", "north") },
  ];
}
