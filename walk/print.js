/* same old samsara · the print engine
   A small WebGL2 renderer, written for this site. No library. The walk (walk/world.js) and the road (road/roadworld.js) are
   two scenes drawn by it.
   Each frame: (1) a shadow block from where the light is, (2) every surface drawn into two blocks (flat ink, and
   line data), (3) the print pass that cuts the key lines and prints it on paper. See glsl.js.

   A scene is a class that extends Printer and supplies:
     scene(q)                  build the ground, ribbons, trees, plants, props and specks (q: how densely to plant)
     camera(u, head, slide, seen)   set this.view / this.proj / this.vp and return the camera
     lightAt(u, night)         fill this.lit and this.shade, return the light (see walk/light.js for the fields)
     animate(u, time, L, dt, still)   move whatever moves
     pools(L, state)           the little pools of warm light
     extras(o, depthOnly, L, state)   draw whatever is not a plain prop
     specks(mo, L, state)      draw the specks
   and calls this.build() at the end of its constructor. */

import { m4, v3, clamp, smooth, DEG, TAU } from "./m.js";
import { STRIDE } from "./mesh.js";
import { INK, OBJ_VS, OBJ_FS, GROUND_VS, GROUND_FS, PLANT_VS, PLANT_FS, MOTE_VS, MOTE_FS, PRINT_VS, PRINT_FS } from "./glsl.js";

export const NEAR = 0.2, FAR = 900;

/* ---------------- tiny GL helpers ---------------- */
export class Prog {
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

export const rotY = (out, x, y, z, yaw, s = 1) => {
  const c = Math.cos(yaw) * s, n = Math.sin(yaw) * s;
  out[0] = c; out[1] = 0; out[2] = -n; out[3] = 0; out[4] = 0; out[5] = s; out[6] = 0; out[7] = 0;
  out[8] = n; out[9] = 0; out[10] = c; out[11] = 0; out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
  return out;
};
export const local = (p, l) => [p.x + Math.cos(p.yaw) * l[0] + Math.sin(p.yaw) * l[2], p.y + l[1], p.z - Math.sin(p.yaw) * l[0] + Math.cos(p.yaw) * l[2]];
export const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
export const angLerp = (a, b, t) => a + angDiff(a, b) * t;
/* posing a jointed thing (the raven): each of these multiplies a matrix on the right, in place.
   turns follow the right hand rule: tX tips +z down, tY swings +x back toward -z, tZ lifts +x. */
export const mMove = (m, x, y, z) => { m[12] += m[0] * x + m[4] * y + m[8] * z; m[13] += m[1] * x + m[5] * y + m[9] * z; m[14] += m[2] * x + m[6] * y + m[10] * z; return m; };
export const mTurnX = (m, a) => { const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < 3; i++) { const y = m[4 + i], z = m[8 + i]; m[4 + i] = y * c + z * s; m[8 + i] = z * c - y * s; } return m; };
export const mTurnY = (m, a) => { const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < 3; i++) { const x = m[i], z = m[8 + i]; m[i] = x * c - z * s; m[8 + i] = x * s + z * c; } return m; };
export const mTurnZ = (m, a) => { const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < 3; i++) { const x = m[i], y = m[4 + i]; m[i] = x * c + y * s; m[4 + i] = y * c - x * s; } return m; };

export class Printer {
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
    this.hot = {};                 // things in the picture that can be pressed: name -> where it is
    this.moonDir = [0, 1, 0]; this.lowGround = 0;
  }
  /* ---------- build everything (also runs again if the browser drops the GL context) ---------- */
  build() {
    const gl = this.gl, tier = this.tier;
    this.prog = {
      obj: new Prog(gl, OBJ_VS, OBJ_FS, "obj"), ground: new Prog(gl, GROUND_VS, GROUND_FS, "ground"),
      plant: new Prog(gl, PLANT_VS, PLANT_FS, "plant"), mote: new Prog(gl, MOTE_VS, MOTE_FS, "mote"), print: new Prog(gl, PRINT_VS, PRINT_FS, "print"),
    };
    const q = tier === 2 ? 1 : tier === 1 ? 0.55 : 0.35;      // how much is planted: phones get about half
    this.ribbons = []; this.props = []; this.trees = []; this.plants = [];
    this.scene(q);

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
    // the film on the bedsheet: blank until the thumbnail arrives
    this.blankTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.blankTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    this.filmTex = null;
    if (this.filmImg) this.setFilm(this.filmImg);
    this.fbo = null;
    if (this.w) this.targets();
  }
  /** put a picture on the bedsheet screen (the newest episode's thumbnail) */
  setFilm(img) {
    const gl = this.gl; this.filmImg = img;
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch (_) { gl.deleteTexture(t); return; }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.filmTex = t;
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
  /** where a world point lands on the page, in css pixels. null when it is behind you or off the picture. */
  project(p, margin = 0) {
    const c = m4.project(this.vp, p);
    if (c[3] <= 0.05) return null;
    const x = (c[0] / c[3] * 0.5 + 0.5) * this.cssW, y = (1 - (c[1] / c[3] * 0.5 + 0.5)) * this.cssH;
    if (x < -margin || y < -margin || x > this.cssW + margin || y > this.cssH + margin) return null;
    return [x, y, c[3]];
  }
  /* ---------- one frame ---------- */
  /** state: { u, time, head: [yaw, pitch], night (0..1: the scene's other light, if it has one), gust (0..1.5) } */
  render(state) {
    const gl = this.gl;
    if (gl.isContextLost() || !this.fbo) return;
    const u = state.u, t = Math.floor(state.time * 12) / 12;          // everything that sways is drawn "on twos", like a flip book
    const L = (this.light = this.lightAt(u, state.night || 0));
    let cam = this.camera(u, state.head || [0, 0], state.slide === undefined ? 1 : state.slide, state.seen || 1);
    const P_ = this.prog;
    const dt = state.still ? 1 : clamp(state.time - (this.lastTime === undefined ? state.time : this.lastTime), 0, 0.1);
    this.lastTime = state.time;

    this.animate(u, state.time, L, dt, !!state.still);
    if (state.spy && this.spy) cam = this.spy(state.spy);

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
    p.v3("uSunDir", L.sunDir); p.v3("uMoonDir", this.moonDir);
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
  surface(p, vp, L, t, state, depthOnly) {
    const gl = this.gl;
    p.m("uViewProj", vp); p.m("uView", this.view); p.f("uDepthOnly", depthOnly ? 1 : 0);
    p.v3("uCamPos", this.cam.eye); p.v3("uLightDir", L.lightDir); p.f("uTime", t);
    p.f("uWind", 0.8, 0.6, L.wind * 0.42, state.gust || 0);
    p.a3("uLit", this.lit); p.a3("uShade", this.shade);
    p.m("uShadowMat", this.lightVP); p.f("uShadowAmt", !depthOnly && this.shadowActive ? L.shadow : 0);
    p.v3("uFogCol", L.fogCol); p.f("uFog", L.fogD, L.fogLow, this.lowGround, L.fogMax);
    p.f("uHatch", L.hatch);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, !depthOnly && this.shadowActive ? this.shadowTex : this.noShadowTex);
    p.i("tShadow", 3);
    if (!depthOnly) {
      const pools = this.pools(L, state);                 // up to three little pools of warm light: [xyz + reach] x 3, [rgb + how lit] x 3
      p.a4("uGlow", pools[0]); p.a4("uGlowCol", pools[1]);
    }
  }
  drawWorld(vp, L, t, state, depthOnly) {
    const gl = this.gl, P_ = this.prog;
    gl.disable(gl.CULL_FACE);
    // ground
    const g = P_.ground.use(); this.surface(g, vp, L, t, state, depthOnly);
    g.v3("uSunDir", L.sunDir); g.v4("uSunCol", L.sunCol, L.glitter);
    g.f("uRoadLine", this.roadLine || 0); if (this.stripe) g.a3("uStripe", this.stripe);
    g.i("uKind", 0); gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(this.ground.vao); gl.drawElements(gl.TRIANGLES, this.ground.count, this.ground.type, 0);
    gl.disable(gl.CULL_FACE);
    if (!depthOnly) {
      gl.vertexAttrib3f(1, 0, 1, 0);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
      const rib = (mesh, kind) => { g.i("uKind", kind); gl.bindVertexArray(mesh.vao); gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type, 0); };
      for (const r of this.ribbons) if (!r.flat) rib(r.mesh, r.kind);          // laid on the ground: paths, tracks, roads
      gl.disable(gl.POLYGON_OFFSET_FILL);
      for (const r of this.ribbons) if (r.flat) rib(r.mesh, r.kind);           // level water
    }
    // things
    const o = P_.obj.use(); this.surface(o, vp, L, t, state, depthOnly);
    if (!depthOnly) {
      const c = (i) => [this.lit[i * 3], this.lit[i * 3 + 1], this.lit[i * 3 + 2]], w = c(INK.WHITE), g = c(INK.GOLD);
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, this.filmTex || this.blankTex);
      o.i("tFilm", 4); o.f("uFilm", this.filmTex ? 1 : 0);
      o.a3("uFilmInk", [...w, ...g.map((v, k) => v * 0.55 + w[k] * 0.45), ...c(INK.LEAF), this.shade[INK.RAVEN * 3], this.shade[INK.RAVEN * 3 + 1], this.shade[INK.RAVEN * 3 + 2]]);
    }
    gl.vertexAttrib4f(3, 0, 0, 0, 1);
    for (const p of this.props) {
      if (p.hidden || (depthOnly && p.noShadow)) continue;
      o.m("uModel", p.model); gl.vertexAttrib4f(4, 1, 0, 0, p.id);
      if (p.kick) o.f("uWind", 0.8, 0.6, L.wind * 0.42 + p.kick(), 0);                 // a thing that gets shaken (the beads in the apple tree)
      gl.bindVertexArray(p.mesh.vao); gl.drawElements(gl.TRIANGLES, p.mesh.count, p.mesh.type, 0);
      if (p.kick) o.f("uWind", 0.8, 0.6, L.wind * 0.42, state.gust || 0);
    }
    this.extras(o, depthOnly, L, state);                   // what only this scene has: a raven, geese, a truck on the move
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
    this.specks(mo, L, state);                             // sparks, butterflies, snow
  }
  /** a PNG of what is on the canvas right now (only when made with capture: true) */
  capture() { return new Promise((res) => this.canvas.toBlob(res, "image/png")); }
}
