/* same old samsara · the walk · the world
   A small WebGL2 renderer written for this one page. No library.
   Each frame: (1) a shadow block from where the light is, (2) every surface drawn into two blocks (flat ink, and
   line data), (3) the print pass that cuts the key lines and prints it on paper. See glsl.js. */

import { m4, v3, lerp, clamp, smooth, DEG, TAU, rng } from "./m.js";
import * as land from "./land.js";
import * as shapes from "./mesh.js";
import { STRIDE } from "./mesh.js";
import { INK, OBJ_VS, OBJ_FS, GROUND_VS, GROUND_FS, PLANT_VS, PLANT_FS, MOTE_VS, MOTE_FS, PRINT_VS, PRINT_FS } from "./glsl.js";
import { lightAt, MOON_DIR } from "./light.js";

export const STOP_IDS = ["gate", "films", "make", "jewelry", "field-guide", "land", "follow", "say-hi", "road"];
const NEAR = 0.2, FAR = 900;
const P = land.PLACES;
const at = (x, z, dy = 0) => [x, land.height(x, z) + dy, z];

/* where the camera looks at each stop, and how far the picture is slid over to leave room for the words.
   side: which side the card sits on (wide screens). on narrow screens the card is underneath and the picture slides up. */
const VIEWS = [
  { look: at(19, 82, 1.3), lookN: at(24, 82, 1.3), shift: [0.1, -0.22], shiftN: [0, -0.24] },
  { look: at(P.screen[0], P.screen[1], 1.55), shift: [0.27, 0], shiftN: [0, 0.42] },
  { look: at(11.4, 19.2, 1.8), shift: [-0.27, 0], shiftN: [0, 0.42] },
  { look: at(P.apple[0], P.apple[1], 2.9), shift: [0.27, 0.04], shiftN: [0, 0.42] },
  { look: at(-26.6, -99.6, 0.75), shift: [-0.27, 0], shiftN: [0, 0.42] },
  { look: at(-42, land.riverZ(-42) + 2, 2.6), shift: [0.25, -0.04], shiftN: [0, 0.36] },
  { look: at(P.fire[0], P.fire[1], 1.0), shift: [-0.27, 0.02], shiftN: [0, 0.42] },
  { look: at(P.mailbox[0], P.mailbox[1], 1.2), shift: [0.27, 0.02], shiftN: [0, 0.42] },
  { look: at(46, 105, 1.5), lookN: at(40, 100, 1.5), shift: [-0.22, -0.08], shiftN: [0, 0.3] },
];
const STOP_S = STOP_IDS.map((id) => land.trail.stops[id]);

/* ---------------- tiny GL helpers ---------------- */
class Prog {
  constructor(gl, vs, fs, name) {
    this.gl = gl; this.loc = new Map();
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(name + " shader: " + gl.getShaderInfoLog(s));
      return s;
    };
    const p = (this.p = gl.createProgram());
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(name + " link: " + gl.getProgramInfoLog(p));
  }
  use() { this.gl.useProgram(this.p); return this; }
  l(n) { let x = this.loc.get(n); if (x === undefined) { x = this.gl.getUniformLocation(this.p, n); this.loc.set(n, x); } return x; }
  f(n, a, b, c, d) {
    const l = this.l(n), gl = this.gl; if (!l) return;
    if (d !== undefined) gl.uniform4f(l, a, b, c, d); else if (c !== undefined) gl.uniform3f(l, a, b, c); else if (b !== undefined) gl.uniform2f(l, a, b); else gl.uniform1f(l, a);
  }
  i(n, v) { const l = this.l(n); if (l) this.gl.uniform1i(l, v); }
  v3(n, a) { const l = this.l(n); if (l) this.gl.uniform3f(l, a[0], a[1], a[2]); }
  v4(n, a, w) { const l = this.l(n); if (l) this.gl.uniform4f(l, a[0], a[1], a[2], w === undefined ? a[3] : w); }
  m(n, a) { const l = this.l(n); if (l) this.gl.uniformMatrix4fv(l, false, a); }
  a3(n, a) { const l = this.l(n); if (l) this.gl.uniform3fv(l, a); }
  a4(n, a) { const l = this.l(n); if (l) this.gl.uniform4fv(l, a); }
}

const rotY = (out, x, y, z, yaw, s = 1) => {
  const c = Math.cos(yaw) * s, n = Math.sin(yaw) * s;
  out[0] = c; out[1] = 0; out[2] = -n; out[3] = 0; out[4] = 0; out[5] = s; out[6] = 0; out[7] = 0;
  out[8] = n; out[9] = 0; out[10] = c; out[11] = 0; out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
  return out;
};
const local = (p, l) => [p.x + Math.cos(p.yaw) * l[0] + Math.sin(p.yaw) * l[2], p.y + l[1], p.z - Math.sin(p.yaw) * l[0] + Math.cos(p.yaw) * l[2]];
const angLerp = (a, b, t) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return a + d * t; };

export class World {
  /** tier: 2 desktop, 1 phone, 0 weak. throws if WebGL2 is not there. */
  constructor(canvas, { tier = 2, capture = false } = {}) {
    this.canvas = canvas; this.tier = tier;
    const gl = (this.gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false,
      powerPreference: "high-performance", preserveDrawingBuffer: capture }));
    if (!gl) throw new Error("no webgl2");
    this.lit = new Float32Array(INK.COUNT * 3); this.shade = new Float32Array(INK.COUNT * 3);
    this.view = m4.create(); this.proj = m4.create(); this.vp = m4.create(); this.lightVP = m4.create(); this.tmp = m4.create();
    this.ident = m4.create();
    this.w = this.h = 0; this.scale = 1;
    this.pull = 0;                 // changes the ink grain; bumped when the print is "pulled" again
    this.fireKick = 0; this.beadKick = 0; this.flag = 0; this.ravenHop = 0;
    this.hot = {};
    this.build();
  }

  /* ---------- build everything (also runs again if the browser drops the GL context) ---------- */
  build() {
    const gl = this.gl, tier = this.tier;
    this.prog = {
      obj: new Prog(gl, OBJ_VS, OBJ_FS, "obj"), ground: new Prog(gl, GROUND_VS, GROUND_FS, "ground"),
      plant: new Prog(gl, PLANT_VS, PLANT_FS, "plant"), mote: new Prog(gl, MOTE_VS, MOTE_FS, "mote"), print: new Prog(gl, PRINT_VS, PRINT_FS, "print"),
    };
    const q = tier === 2 ? 1 : tier === 1 ? 0.62 : 0.4;

    // the ground and the ribbons on it
    const G = land.buildGround(tier === 2 ? 220 : tier === 1 ? 180 : 150);
    this.ground = this.groundMesh(G.pos, G.nor, G.mask, G.idx);
    const ribbon = (pts, hw, lift, flat) => {
      const r = land.buildRibbon(pts, hw, lift, flat), n = r.pos.length / 3, mask = new Float32Array(n * 4);
      for (let k = 0; k < n; k++) { mask[k * 4] = r.uv[k * 2]; mask[k * 4 + 1] = r.uv[k * 2 + 1]; mask[k * 4 + 2] = flat === null || flat === undefined ? land.woodsAmt(r.pos[k * 3], r.pos[k * 3 + 2]) : 0; }
      return this.groundMesh(r.pos, null, mask, r.idx);
    };
    const tp = land.trailRibbonPoints(), cut = Math.round((land.trail.stops.make + 14) / 2), back = Math.round((land.trail.stops["say-hi"] - 50) / 2);
    this.track = ribbon(tp.slice(0, cut + 1).concat(), 1.45, 0.06);
    this.path = ribbon(tp.slice(cut, back + 1), 0.82, 0.06);
    this.track2 = ribbon(tp.slice(back), 1.45, 0.06);
    this.road = ribbon(land.roadPoints(), 3.1, 0.07);
    this.river = ribbon(land.riverPoints(), 8.2, 0, land.WATER_Y);

    // trees: one mesh per kind and distance, drawn many times
    const trees = land.plantTrees(q);
    trees.push({ x: P.camTree[0], y: land.height(P.camTree[0], P.camTree[1]) - 0.1, z: P.camTree[1], scale: 1.15, yaw: 1, species: 2, ink: 1, lod: 0 });
    if (tier < 2) for (const t of trees) if (t.lod === 0 && land.trailDist(t.x, t.z) > 9) t.lod = 1;
    this.trees = [];
    const rand = rng(7);
    for (let sp = 0; sp < 3; sp++) for (let lod = 0; lod < 3; lod++) {
      const list = trees.filter((t) => t.species === sp && t.lod === lod);
      if (!list.length) continue;
      const data = new Float32Array(list.length * 8);
      list.forEach((t, k) => data.set([t.x, t.y, t.z, t.scale, Math.cos(t.yaw), Math.sin(t.yaw), t.ink, 8 + ((rand() * 28) | 0) * 8], k * 8));
      const mesh = this.mesh(shapes.buildTree(sp, lod).build());
      this.instances(mesh, data);
      this.trees.push({ mesh, lod, cull: sp !== 2 });
    }

    // goldenrod, grass, fern
    const plants = land.plantMeadow(q), gold = [], green = [];
    for (let k = 0; k < plants.length; k += 6) (plants[k + 5] === 0 ? gold : green).push(plants[k], plants[k + 1], plants[k + 2], plants[k + 3], plants[k + 4], plants[k + 5]);
    this.plants = [this.plantMesh(new Float32Array(gold), 0), this.plantMesh(new Float32Array(green), 1)];

    // things
    this.props = [];
    let nextId = 16;
    const put = (geo, x, z, yaw = 0, dy = 0, extra = {}) => {
      const p = { mesh: this.mesh(geo.build()), model: rotY(m4.create(), x, land.height(x, z) + dy, z, yaw), id: nextId, x, z, yaw, y: land.height(x, z) + dy, ...extra };
      nextId = nextId >= 240 ? 16 : nextId + 8;
      this.props.push(p); return p;
    };
    put(shapes.gate(), 0, 118);
    this.mailbox = put(shapes.mailbox(), P.mailbox[0], P.mailbox[1], 0);
    this.flagProp = put(shapes.mailboxFlag(), P.mailbox[0], P.mailbox[1], 0);
    const scr = put(shapes.screen(), P.screen[0], P.screen[1], Math.atan2(-9 - P.screen[0], 72.2 - P.screen[1]));
    put(shapes.tripod(), P.tripod[0], P.tripod[1], 2.3);
    const camperYaw = 0.965;       // the door and the awning face the morning sun, and the trail
    this.camper = put(shapes.camper(), P.camper[0], P.camper[1], camperYaw);
    put(shapes.table(), P.table[0], P.table[1], camperYaw);
    put(shapes.chair(INK.RUST), P.table[0] + 0.45, P.table[1] + 0.95, camperYaw + 3.0);
    put(shapes.chair(INK.LEAF_DARK), P.table[0] + 1.0, P.table[1] - 1.15, camperYaw - 1.45);
    put(shapes.truck(), P.truck[0], P.truck[1], 0.4);
    put(shapes.fireRing(), P.fire[0], P.fire[1]);
    this.chairA = put(shapes.chair(INK.LEAF_DARK), P.fire[0] + 1.8, P.fire[1] + 1.25, -1.2);
    put(shapes.chair(INK.RUST), P.fire[0] + 2.0, P.fire[1] - 1.1, -1.85);
    this.flames = put(shapes.flames(), P.fire[0], P.fire[1], 0, 0, { dynamic: true });
    this.apple = put(shapes.appleTree(), P.apple[0], P.apple[1], 0.4, -0.1);
    this.beads = put(shapes.beadStrands(), P.apple[0], P.apple[1], 0.4, -0.1, { noShadow: true });
    put(shapes.shed(), P.shed[0], P.shed[1], -1.3);
    this.log = put(shapes.mossyLog(), P.log[0], P.log[1], 0.55);
    const camDir = Math.atan2(-19 - P.camTree[0], -97.2 - P.camTree[1]);
    put(shapes.trailCam(), P.camTree[0] + Math.sin(camDir) * 0.36, P.camTree[1] + Math.cos(camDir) * 0.36, camDir, 1.05);
    this.raccoon = put(shapes.raccoon(), P.camTree[0] + Math.sin(camDir + 1.35) * 0.62, P.camTree[1] + Math.cos(camDir + 1.35) * 0.62, camDir - 0.5, 0, { dynamic: true });
    this.rocks = put(shapes.riverRocks(), P.riverRock[0], P.riverRock[1], 0.2, 0.25);
    put(shapes.stakes(), P.stakes[0], P.stakes[1], 0.5);
    // a fence along the front, either side of the gate
    const posts = land.fencePosts(), fence = new shapes.Geo(), wire = [INK.PEPPER, 0, 9, 0];
    posts.forEach((p, k) => {
      fence.add(shapes.fencePost(), { pos: p, yaw: k });
      const n = posts[k + 1];
      if (n && Math.abs(n[0] - p[0]) < 4) for (const h of [0.55, 1.0]) fence.add(shapes.tube([p[0], p[1] + h, p[2]], [n[0], n[1] + h, n[2]], 0.009, 0.009, 3, wire, 2, false));
    });
    this.props.push({ mesh: this.mesh(fence.build()), model: m4.create(), id: 248 });
    // the raven, and the geese
    this.raven = { perch: this.mesh(shapes.ravenBody().build()), fly: this.mesh(new shapes.Geo().add(shapes.ravenBody()).add(shapes.ravenWing(1), { pos: [0.07, 0.05, 0.03] }).add(shapes.ravenWing(-1), { pos: [-0.07, 0.05, 0.03] }).build()), model: m4.create(), pos: [0, 0, 0] };
    const goose = new shapes.Geo().add(shapes.goose()).add(shapes.gooseWing(1)).add(shapes.gooseWing(-1));
    this.geese = this.mesh(goose.build());
    const gd = new Float32Array(9 * 8);
    for (let k = 0; k < 9; k++) { const s = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2); gd.set([s * 1.9, Math.abs(s) * 0.25, -Math.abs(s) * 2.3, 1.5, 1, 0, 0, 0], k * 8); }
    this.instances(this.geese, gd);
    this.geeseModel = m4.create();

    // where the raven waits at each stop
    this.perches = [
      [1.9, land.height(1.9, 118) + 2.62, 118],
      local(scr, [-1.85, 2.9, 0]),
      local(this.camper, [-4.55, 3.7, 0.95]),
      [P.apple[0] + 0.2, land.height(P.apple[0], P.apple[1]) + 5.45, P.apple[1] + 0.1],
      local(this.log, [2.1, 0.74, 0]),
      [P.riverRock[0] - 3.2, land.WATER_Y + 0.95, P.riverRock[1] - 0.6],
      local(this.chairA, [0.05, 1.06, -0.3]),
      [P.mailbox[0], this.mailbox.y + 1.5, P.mailbox[1] - 0.12],
      at(30, 112, 9),
    ];
    this.lampAt = local(this.camper, [-1.1, 1.7, 2.7]);

    // specks: sparks off the fire, monarchs over the goldenrod
    const seeds = new Float32Array(64 * 4), r2 = rng(3);
    for (let k = 0; k < seeds.length; k++) seeds[k] = r2();
    this.motes = this.moteMesh(seeds);

    // the shadow block
    const sres = (this.shadowRes = tier === 2 ? 2048 : tier === 1 ? 1024 : 0);
    const depthTex = (res) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, res, res, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      return t;
    };
    this.noShadowTex = depthTex(1);
    if (sres) {
      this.shadowTex = depthTex(sres);
      this.shadowFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
      gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { this.shadowRes = 0; }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    this.fbo = null;
    if (this.w) this.targets();
  }

  mesh(geo) {
    const gl = this.gl, vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, geo.data, gl.STATIC_DRAW);
    const B = STRIDE * 4;
    [[0, 3, 0], [1, 3, 12], [2, 4, 24], [5, 1, 40]].forEach(([loc, n, off]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, B, off); });
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: geo.count, type: geo.idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, n: 0 };
  }
  instances(mesh, data) {
    const gl = this.gl; gl.bindVertexArray(mesh.vao);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(4, 1);
    gl.bindVertexArray(null); mesh.n = data.length / 8;
  }
  groundMesh(pos, nor, mask, idx) {
    const gl = this.gl, vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = (loc, data, n) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); };
    buf(0, pos, 3); if (nor) buf(1, nor, 3); buf(2, mask, 4);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: idx.length, type: gl.UNSIGNED_INT };
  }
  plantMesh(data, which) {
    const gl = this.gl, vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    // cut shapes, made of "kites": a point, a width half way, a point. x and y are in plant heights, z marks the plume.
    const v = [], ix = [];
    const kite = (c0, c1, c2, w, part) => {
      const dx = c2[0] - c0[0], dy = c2[1] - c0[1], l = Math.hypot(dx, dy), nx = (-dy / l) * w, ny = (dx / l) * w, b = v.length / 3;
      v.push(c0[0], c0[1], part, c1[0] + nx, c1[1] + ny, part, c1[0] - nx, c1[1] - ny, part, c2[0], c2[1], part);
      ix.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    };
    if (which === 0) {             // goldenrod: a stem, two leaves, four arching sprays
      kite([0, 0], [0.015, 0.3], [0.03, 0.62], 0.013, 0);
      kite([0.008, 0.2], [-0.07, 0.27], [-0.15, 0.3], 0.02, 0);
      kite([0.015, 0.33], [0.08, 0.4], [0.15, 0.42], 0.018, 0);
      kite([0.03, 0.56], [0.07, 0.78], [0.17, 0.99], 0.05, 1);
      kite([0.025, 0.54], [-0.09, 0.7], [-0.22, 0.76], 0.04, 1);
      kite([0.035, 0.5], [0.16, 0.62], [0.3, 0.64], 0.036, 1);
      kite([0.03, 0.6], [-0.02, 0.83], [-0.06, 0.95], 0.033, 1);
    } else {                       // grass and fern: four blades from one root
      for (const [a, l] of [[-0.62, 1], [-0.16, 0.9], [0.26, 1], [0.72, 0.8]])
        kite([0, 0], [Math.sin(a * 0.7) * 0.55 * l, Math.cos(a * 0.7) * 0.55 * l], [Math.sin(a * 1.5) * l, Math.cos(a * 1.5) * l], 0.02, 0);
    }
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 24, 0); gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 24, 16); gl.vertexAttribDivisor(4, 1);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ix), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: ix.length, n: data.length / 6 };
  }
  moteMesh(seeds) {
    const gl = this.gl, vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);
    return { vao, n: seeds.length / 4 };
  }

  /* ---------- size ---------- */
  resize(cssW, cssH, scale) {
    const w = Math.max(2, Math.round(cssW * scale)), h = Math.max(2, Math.round(cssH * scale));
    this.cssW = cssW; this.cssH = cssH; this.scale = scale;
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h; this.canvas.width = w; this.canvas.height = h;
    this.targets();
  }
  targets() {
    const gl = this.gl, w = this.w, h = this.h;
    if (this.fbo) { gl.deleteFramebuffer(this.fbo); gl.deleteTexture(this.tPlate); gl.deleteTexture(this.tAux); gl.deleteTexture(this.tDepth); }
    const tex = (internal, format, type, filter) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.tPlate = tex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
    this.tAux = tex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
    this.tDepth = tex(gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);
    this.fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tPlate, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.tAux, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.tDepth, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("framebuffer incomplete");
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /* ---------- the camera ---------- */
  /** u: stop progress (0 = the gate, 8 = the road). head: [yaw, pitch] a small look-around, in radians. */
  camera(u, head, slide = 1) {
    const aspect = this.cssW / this.cssH, last = STOP_IDS.length - 1;
    u = clamp(u, 0, last);
    const k = Math.min(Math.floor(u), last - 1), f = u - k, e = f * f * (3 - 2 * f);
    const s = lerp(STOP_S[k], STOP_S[k + 1], e);
    const g = land.trailAt(s), eye = [g[0], g[1] + land.EYE, g[2]];
    const narrow = 1 - smooth(0.8, 1.25, aspect);
    const look = (i) => { const v = VIEWS[i], t = v.lookN && narrow > 0 ? v3.lerp(v.look, v.lookN, narrow) : v.look; const d = v3.sub(t, eye); return [Math.atan2(d[0], -d[2]), Math.atan2(d[1], Math.hypot(d[0], d[2]))]; };
    const A = look(k), B = look(k + 1);
    // between stops you look where you are going
    const ahead = land.trailAt(Math.min(s + 18, land.trail.n - 1)), far = Math.hypot(ahead[0] - g[0], ahead[2] - g[2]);
    const walkYaw = far > 1 ? Math.atan2(ahead[0] - g[0], -(ahead[2] - g[2])) : A[0];
    const ww = Math.pow(Math.sin(Math.PI * f), 2) * clamp((STOP_S[k + 1] - STOP_S[k]) / 70, 0, 1) * 0.92;
    let yaw = angLerp(angLerp(A[0], B[0], e), walkYaw, ww) + head[0];
    let pitch = lerp(lerp(A[1], B[1], e), -0.035, ww) + head[1];
    pitch = clamp(pitch, -1.2, 1.2);
    const fwd = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
    const va = VIEWS[k], vb = VIEWS[k + 1];
    const sh = (v) => [lerp(v.shift[0], v.shiftN[0], narrow), lerp(v.shift[1], v.shiftN[1], narrow)];
    const sa = sh(va), sb = sh(vb), shift = [lerp(sa[0], sb[0], e) * (1 - ww * 0.8) * slide, lerp(sa[1], sb[1], e) * (1 - ww * 0.5) * slide];
    const hfov = lerp(46, 80, smooth(0.5, 1.8, aspect)) * DEG;
    const vfov = clamp(2 * Math.atan(Math.tan(hfov / 2) / aspect), 42 * DEG, 82 * DEG);
    m4.lookAt(this.view, eye, v3.add(eye, fwd), [0, 1, 0]);
    m4.perspective(this.proj, vfov, aspect, NEAR, FAR, shift[0], shift[1]);
    m4.mul(this.vp, this.proj, this.view);
    const right = v3.norm(v3.cross(fwd, [0, 1, 0])), up = v3.cross(right, fwd);
    return (this.cam = { eye, fwd, right, up, tanV: Math.tan(vfov / 2), tanH: Math.tan(vfov / 2) * aspect, shift, yaw, s, k, f, e, ww });
  }

  /** where a world point lands on the page, in css pixels. null when it is behind you or off the picture. */
  project(p, margin = 0) {
    const c = m4.project(this.vp, p);
    if (c[3] <= 0.05) return null;
    const x = (c[0] / c[3] * 0.5 + 0.5) * this.cssW, y = (1 - (c[1] / c[3] * 0.5 + 0.5)) * this.cssH;
    if (x < -margin || y < -margin || x > this.cssW + margin || y > this.cssH + margin) return null;
    return [x, y, c[3]];
  }

  /* ---------- one frame ---------- */
  /** state: { u, time, head: [yaw, pitch], night (0..1: the walk that starts in the dark), gust (0..1.5) } */
  render(state) {
    const gl = this.gl;
    if (gl.isContextLost() || !this.fbo) return;
    const u = state.u, t = Math.floor(state.time * 12) / 12;          // everything that sways is drawn "on twos", like a flip book
    const L = (this.light = lightAt(u, state.night || 0, this.lit, this.shade));
    const cam = this.camera(u, state.head || [0, 0], state.slide === undefined ? 1 : state.slide);
    const P_ = this.prog;

    this.animate(u, state.time, L);

    // --- the shadow block ---
    const shadowOn = this.shadowRes > 0 && L.shadow > 0.02;
    if (shadowOn) {
      const S = 64, ld = L.lightDir;
      const flat = v3.norm([cam.fwd[0], 0, cam.fwd[2]]);
      let c = [cam.eye[0] + flat[0] * 36, cam.eye[1] - 1, cam.eye[2] + flat[2] * 36];
      const up = Math.abs(ld[1]) > 0.98 ? [0, 0, 1] : [0, 1, 0];
      const rx = v3.norm(v3.cross(up, ld)), ry = v3.cross(ld, rx), texel = (2 * S) / this.shadowRes;
      const dx = v3.dot(c, rx), dy = v3.dot(c, ry);
      c = v3.add(c, v3.add(v3.scale(rx, Math.round(dx / texel) * texel - dx), v3.scale(ry, Math.round(dy / texel) * texel - dy)));
      m4.lookAt(this.tmp, v3.add(c, v3.scale(ld, 300)), c, up);
      m4.ortho(this.lightVP, -S, S, -S, S, 1, 620);
      m4.mul(this.lightVP, this.lightVP.slice(), this.tmp);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
      gl.viewport(0, 0, this.shadowRes, this.shadowRes);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.6, 3);
      this.drawWorld(this.lightVP, L, t, state, true);
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }

    // --- the two blocks ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.w, this.h);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]); gl.clearBufferfv(gl.COLOR, 1, [0.5, 0.5, 0, 0]);
    gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
    this.shadowActive = shadowOn;
    this.drawWorld(this.vp, L, t, state, false);

    // --- the print ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    const p = P_.print.use();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tPlate);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tAux);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.tDepth);
    p.i("tPlate", 0); p.i("tAux", 1); p.i("tDepth", 2);
    p.f("uRes", this.w, this.h); p.f("uLine", Math.max(1, 1.15 * this.scale)); p.f("uNF", NEAR, FAR);
    p.v3("uPaper", L.paper); p.v3("uKey", L.key); p.f("uKeyAmt", L.keyAmt);
    p.f("uReg", 0.9 * this.scale, -0.55 * this.scale); p.f("uPull", this.pull);
    p.v3("uCamRight", cam.right); p.v3("uCamUp", cam.up); p.v3("uCamFwd", cam.fwd);
    p.f("uLens", cam.tanH, cam.tanV, cam.shift[0], cam.shift[1]);
    p.v3("uSunDir", L.sunDir); p.v3("uMoonDir", MOON_DIR);
    p.v4("uSunCol", L.sunCol, L.sunSize * DEG);
    p.v4("uBandCol", L.band); p.v4("uBand2Col", L.band2);
    const clear = (1 - smooth(0.25, 0.9, u)) * (this.cssW / this.cssH < 0.9 ? 0.6 : 0.3);      // fewer clouds behind the words on the first screen
    p.f("uCloud", L.cloud * (1 - clear), state.time * 0.004, L.cloudShadeAmt, L.cloudLitAmt);
    p.v3("uCloudShade", L.cloudShade); p.v3("uCloudLit", L.cloudLit); p.v3("uHaze", L.haze);
    p.f("uNight", L.stars, L.moon, state.moonPhase === undefined ? 0.5 : state.moonPhase, L.rule);
    p.f("uTime", t);
    gl.bindVertexArray(null);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* the things that move on their own: the raven, the fire, the flag, the geese */
  animate(u, time, L) {
    const k = clamp(Math.floor(u), 0, STOP_IDS.length - 2), f = u - k;
    // the raven leaves a little after you do, and is there before you arrive
    const a = this.perches[k], b = this.perches[k + 1], ft = smooth(0.1, 0.62, f), R = this.raven;
    const dist = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const arc = Math.sin(Math.PI * ft) * (3 + dist * 0.07);
    const pos = [lerp(a[0], b[0], ft), lerp(a[1], b[1], ft) + arc, lerp(a[2], b[2], ft)];
    R.flying = ft > 0.001 && ft < 0.999;
    if (k + 1 === STOP_IDS.length - 1 && ft >= 0.999) { R.flying = true; const c = time * 0.35; pos[0] += Math.cos(c) * 7; pos[2] += Math.sin(c) * 7; R.yaw = Math.atan2(-Math.sin(c), Math.cos(c)); }
    else if (R.flying) R.yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
    else { const c = this.cam; R.yaw = c ? Math.atan2(c.eye[0] - pos[0], c.eye[2] - pos[2]) + 0.7 : 0; }
    this.ravenHop *= 0.9;
    pos[1] += Math.abs(Math.sin(time * 14)) * this.ravenHop * 0.25;
    R.pos = pos;
    rotY(R.model, pos[0], pos[1] + (R.flying ? 0 : 0.2), pos[2], R.yaw, 1.7);
    this.hot.raven = [pos[0], pos[1] + 0.15, pos[2]];
    // fire
    this.fireKick *= 0.965; this.beadKick *= 0.97;
    this.fire = clamp(L.fire + this.fireKick, 0, 1.6);
    const fl = this.flames, fs = 0.5 + this.fire * 0.7;
    rotY(fl.model, fl.x, fl.y, fl.z, time * 0.3, 1); fl.model[5] = fs; fl.hidden = this.fire < 0.03;
    this.hot.fire = [fl.x, fl.y + 0.7, fl.z];
    // the mailbox flag goes up when you get there
    const want = smooth(6.55, 6.95, u) * (1 - smooth(7.6, 7.95, u) * 0);
    this.flag += (want - this.flag) * 0.12;
    const m = this.flagProp.model, ang = (1 - this.flag) * -1.5708, c = Math.cos(ang), s = Math.sin(ang);
    m.set([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, this.mailbox.x + 0.112, this.mailbox.y + 1.19, this.mailbox.z + 0.22, 1]);
    this.hot.mailbox = [this.mailbox.x, this.mailbox.y + 1.25, this.mailbox.z + 0.1];
    this.hot.apple = [this.apple.x, this.apple.y + 2.6, this.apple.z];
    this.hot.cam = [P.camTree[0], land.height(P.camTree[0], P.camTree[1]) + 1.05, P.camTree[1]];
    // the raccoon looks round the trunk when you stop at the trail cam
    const peek = smooth(3.72, 3.95, u) * (1 - smooth(4.12, 4.4, u));
    this.raccoon.hidden = peek < 0.02;
    if (!this.raccoon.hidden) { const r = this.raccoon; rotY(r.model, r.x, r.y - (1 - peek) * 0.5, r.z, r.yaw + (1 - peek) * 0.9, 1.25); }
    // geese going south at the end of the day
    const gt = (u - 4.75) / 1.1;
    this.geeseOn = gt > 0 && gt < 1;
    if (this.geeseOn) rotY(this.geeseModel, lerp(-190, 150, gt), land.WATER_Y + 78 + Math.sin(gt * 9) * 2, lerp(-330, -40, gt), Math.atan2(340, 290), 1);
  }

  surface(p, vp, L, t, state, depthOnly) {
    const gl = this.gl;
    p.m("uViewProj", vp); p.m("uView", this.view); p.f("uDepthOnly", depthOnly ? 1 : 0);
    p.v3("uCamPos", this.cam.eye); p.v3("uLightDir", L.lightDir); p.f("uTime", t);
    p.f("uWind", 0.8, 0.6, L.wind * 0.42, state.gust || 0);
    p.a3("uLit", this.lit); p.a3("uShade", this.shade);
    p.m("uShadowMat", this.lightVP); p.f("uShadowAmt", !depthOnly && this.shadowActive ? L.shadow : 0);
    p.v3("uFogCol", L.fogCol); p.f("uFog", L.fogD, L.fogLow, land.WATER_Y + 4, L.fogMax);
    p.f("uHatch", L.hatch);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, !depthOnly && this.shadowActive ? this.shadowTex : this.noShadowTex);
    p.i("tShadow", 3);
    if (!depthOnly) {
      const fy = land.height(P.fire[0], P.fire[1]), flick = 0.85 + 0.15 * Math.sin(state.time * 13) * Math.sin(state.time * 7.3);
      const mb = this.mailbox;
      const la = this.lampAt;
      p.a4("uGlow", [P.fire[0], fy + 0.6, P.fire[1], 7.5 + this.fire * 3, la[0], la[1], la[2], 6.5, mb.x, mb.y + 0.8, mb.z - 0.3, 3.4]);
      p.a4("uGlowCol", [0.96, 0.62, 0.2, clamp(this.fire, 0, 1) * flick * 0.9, 0.97, 0.78, 0.38, L.lamp * 0.7, 0.98, 0.8, 0.4, L.lamp * 0.8]);
    }
  }

  drawWorld(vp, L, t, state, depthOnly) {
    const gl = this.gl, P_ = this.prog;
    gl.disable(gl.CULL_FACE);
    // ground
    const g = P_.ground.use(); this.surface(g, vp, L, t, state, depthOnly);
    g.v3("uSunDir", L.sunDir); g.v4("uSunCol", L.sunCol, L.glitter);
    g.i("uKind", 0); gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(this.ground.vao); gl.drawElements(gl.TRIANGLES, this.ground.count, this.ground.type, 0);
    gl.disable(gl.CULL_FACE);
    if (!depthOnly) {
      gl.vertexAttrib3f(1, 0, 1, 0);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
      const rib = (mesh, kind) => { g.i("uKind", kind); gl.bindVertexArray(mesh.vao); gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type, 0); };
      rib(this.track, 2); rib(this.track2, 2); rib(this.path, 1); rib(this.road, 3);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      rib(this.river, 4);
    }
    // things
    const o = P_.obj.use(); this.surface(o, vp, L, t, state, depthOnly);
    gl.vertexAttrib4f(3, 0, 0, 0, 1);
    for (const p of this.props) {
      if (p.hidden || (depthOnly && p.noShadow)) continue;
      o.m("uModel", p.model); gl.vertexAttrib4f(4, 1, 0, 0, p.id);
      if (p === this.beads) o.f("uWind", 0.8, 0.6, L.wind * 0.42 + this.beadKick * 1.1, 0);
      gl.bindVertexArray(p.mesh.vao); gl.drawElements(gl.TRIANGLES, p.mesh.count, p.mesh.type, 0);
      if (p === this.beads) o.f("uWind", 0.8, 0.6, L.wind * 0.42, state.gust || 0);
    }
    const R = this.raven, rm = R.flying ? R.fly : R.perch;
    o.m("uModel", R.model); gl.vertexAttrib4f(4, 1, 0, 0, 232);
    gl.bindVertexArray(rm.vao); gl.drawElements(gl.TRIANGLES, rm.count, rm.type, 0);
    if (this.geeseOn && !depthOnly) {
      o.m("uModel", this.geeseModel);
      gl.bindVertexArray(this.geese.vao); gl.drawElementsInstanced(gl.TRIANGLES, this.geese.count, this.geese.type, 0, this.geese.n);
    }
    o.m("uModel", this.ident);
    for (const tr of this.trees) {
      if (depthOnly && tr.lod === 2) continue;
      if (tr.cull) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(tr.mesh.vao); gl.drawElementsInstanced(gl.TRIANGLES, tr.mesh.count, tr.mesh.type, 0, tr.mesh.n);
    }
    gl.disable(gl.CULL_FACE);
    if (depthOnly) return;
    // the meadow
    const pl = P_.plant.use(); this.surface(pl, vp, L, t, state, false);
    for (const m of this.plants) { gl.bindVertexArray(m.vao); gl.drawElementsInstanced(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0, m.n); }
    // specks
    const mo = P_.mote.use();
    mo.m("uViewProj", vp); mo.v3("uCamRight", this.cam.right); mo.v3("uCamUp", this.cam.up);
    gl.bindVertexArray(this.motes.vao);
    if (this.fire > 0.03) {
      mo.v3("uOrigin", [P.fire[0], land.height(P.fire[0], P.fire[1]) + 0.3, P.fire[1]]);
      mo.f("uSpec", 0, state.time, clamp(this.fire * 0.8, 0, 1), 0.035); mo.f("uMoteCol", 0.97, 0.72, 0.22);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.motes.n);
    }
    const fly = clamp(L.w[0] * 1.4 + L.w[2] * 0.6, 0, 1);
    if (fly > 0.05) {
      mo.f("uSpec", 1, state.time, fly, 0.11); mo.f("uMoteCol", 0.83, 0.42, 0.14);
      for (const [x, z] of [[-10, 62], [8, -4], [44, 70]]) { mo.v3("uOrigin", at(x, z, 0)); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 10); }
    }
  }

  /** a PNG of what is on the canvas right now (only when made with capture: true) */
  capture() { return new Promise((res) => this.canvas.toBlob(res, "image/png")); }
}
