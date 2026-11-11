/* same old samsara · the walk · shaders
   Two steps, like pulling a print:
   1. every surface is drawn into two "blocks": PLATE (its flat ink colour) and AUX (which way it faces, which thing it is,
      and any hatching carved into it). The hatching is tied to the world, so it stays put when you walk.
   2. the PRINT pass cuts the key lines where one thing ends and the next begins, draws the sky, lays the colour blocks a hair
      out of register, and prints it all on paper. */

export const INK = {              // palette slots. the numbers are used by mesh.js and by the shaders below
  GOLD: 0, GREEN: 1, PATH: 2, DIRT: 3, GRAVEL: 4, FLOOR: 5,
  LEAF: 6, LEAF_DARK: 7, LEAF_GOLD: 8, LEAF_RUST: 9,
  BARK: 10, BARK_PALE: 11, WATER: 12, WHITE: 13, RUST: 14, WINDOW: 15, PEPPER: 16, WOOD: 17, MOSS: 18,
  FLAME: 19, EMBER: 20, ROAD: 21, STONE: 22, CREAM: 23,
  BEAD0: 24, BEAD1: 25, BEAD2: 26, BEAD3: 27, BEAD4: 28, BEAD5: 29, RAVEN: 30, LAMP: 31,
  COUNT: 32,
  FOLIAGE: 255,                   // "use this tree's own leaf ink" (LEAF + the instance's variant)
};
export const STYLE = { NONE: 0, BARK: 1, CANOPY: 2, PLANK: 3, STONE: 4, CLOTH: 5, NEEDLE: 6, TIN: 7, PALE: 8, PLAIN: 9 };

const COMMON = /* glsl */`
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), f.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), f.x), f.y);
}
float vnoise3(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  float a = mix(mix(hash13(i), hash13(i+vec3(1,0,0)), f.x), mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), f.x), f.y);
  float b = mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), f.x), mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), f.x), f.y);
  return mix(a, b, f.z);
}
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ s += a*vnoise(p); p = p*2.03 + vec2(17.1, -9.7); a *= .5; } return s/.9375; }
float fbm3(vec3 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ s += a*vnoise3(p); p = p*2.03 + vec3(17.1, -9.7, 4.3); a *= .5; } return s/.9375; }
/* evenly spaced lines along c. w is how much of each gap is ink. far away they melt into a flat tone instead of shimmering. */
float lines(float c, float w){
  float fw = fwidth(c);
  float d = abs(fract(c) - .5);
  float l = 1. - smoothstep(w * .5 - fw, w * .5 + fw, d);
  return mix(l, w, smoothstep(.3, .75, fw));
}
/* scattered dabs, like the marks a gouge leaves. p in "one dab per unit" space. */
float dabs(vec2 p, float amount, vec2 stretch){
  vec2 i = floor(p), f = fract(p) - .5;
  float h = hash12(i);
  vec2 j = (vec2(hash12(i + 7.3), hash12(i + 2.9)) - .5) * .5;
  float d = length((f - j) * stretch);
  float fw = fwidth(p.x) + fwidth(p.y);
  float m = (1. - smoothstep(.2 - fw, .2 + fw, d)) * step(h, amount);
  return mix(m, amount * .13, smoothstep(.35, .9, fw));
}
`;

/* what every surface shader shares: the light, the shadow block, the mist, the firelight, and the carved lines */
const SURFACE = /* glsl */`
uniform vec3 uCamPos;
uniform vec3 uLightDir;                 // towards the light
uniform highp sampler2DShadow tShadow;
uniform mat4 uShadowMat;
uniform float uShadowAmt;
uniform vec3 uFogCol;
uniform vec4 uFog;                      // density per metre, extra in the low ground, the level of the low ground, most it can hide
uniform vec4 uGlow[3];                  // little pools of warm light: xyz, reach
uniform vec4 uGlowCol[3];               // rgb, how lit
uniform float uHatch;                   // how much carving shows (fades out at dusk)

float shadowVis(vec3 wp, float ndl){
  if (uShadowAmt <= 0.) return 1.;
  vec4 sp = uShadowMat * vec4(wp, 1.);
  vec3 s = sp.xyz * .5 + .5;
  if (s.x <= 0. || s.y <= 0. || s.x >= 1. || s.y >= 1. || s.z >= 1.) return 1.;
  float v = texture(tShadow, vec3(s.xy, s.z - mix(.0016, .0005, clamp(ndl, 0., 1.))));
  vec2 e = smoothstep(vec2(0.), vec2(.07), s.xy) * smoothstep(vec2(0.), vec2(.07), 1. - s.xy);
  return mix(1., smoothstep(.25, .75, v), e.x * e.y * uShadowAmt);
}
float fogAmt(vec3 wp){
  float d = distance(wp, uCamPos);
  float low = smoothstep(uFog.z + 16., uFog.z, wp.y);
  return min(1. - exp(-d * uFog.x * (1. + uFog.y * low)), uFog.w);
}
vec3 glowPools(vec3 col, vec3 wp, vec3 n){
  for (int i = 0; i < 3; i++){
    if (uGlowCol[i].a <= 0.) continue;
    vec3 L = uGlow[i].xyz - wp;
    float d = length(L) / uGlow[i].w + (vnoise(wp.xz * 1.7 + float(i) * 9.) - .5) * .22;
    float a = (1. - smoothstep(.72, .8, d)) * .42 + (1. - smoothstep(.36, .44, d)) * .4;      // two rings, cut by hand
    a *= .35 + .65 * clamp(dot(n, normalize(L)) * 1.6 + .25, 0., 1.);
    col = mix(col, uGlowCol[i].rgb, a * uGlowCol[i].a);
  }
  return col;
}
`;

/* ---------------- things: trees, props, anything with a shape ---------------- */
export const OBJ_VS = /* glsl */`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNor;
layout(location=2) in vec4 aPaint;      // ink, sway, style, glow
layout(location=3) in vec4 iPosScale;   // per tree: where, how big
layout(location=4) in vec4 iRot;        // per tree: cos, sin, leaf ink variant, id
layout(location=5) in float aPart;      // which part of the thing this is, so parts get a key line between them
uniform mat4 uModel, uViewProj;
uniform float uTime;
uniform vec4 uWind;                     // direction xz, strength, gust from walking
uniform vec3 uLit[32], uShade[32];
uniform float uDepthOnly;
out vec3 vWorld, vNor, vObj, vLit, vShade;
out vec4 vInfo;                         // style, glow, id, sway
void main(){
  vec3 p = aPos * iPosScale.w;
  vec3 pr = vec3(iRot.x * p.x + iRot.y * p.z, p.y, -iRot.y * p.x + iRot.x * p.z) + iPosScale.xyz;
  vec4 wp = uModel * vec4(pr, 1.);
  float sway = aPaint.y;
  if (sway < 0.){
    wp.y += sin(uTime * 9. + dot(iPosScale.xz, vec2(1.3, 2.1))) * -sway;
  } else if (sway > 0.){
    float ph = dot(iPosScale.xz, vec2(.37, .61)) + wp.y * .21;
    vec2 push = uWind.xy * (sin(uTime * 1.3 + ph) * .6 + sin(uTime * 2.9 + ph * 1.7) * .4) * uWind.z;
    wp.xz += push * sway;
    wp.y += sin(uTime * 2.3 + ph * 2.1) * sway * uWind.z * .25;
  }
  vec3 n = vec3(iRot.x * aNor.x + iRot.y * aNor.z, aNor.y, -iRot.y * aNor.x + iRot.x * aNor.z);
  vNor = mat3(uModel) * n;
  vWorld = wp.xyz; vObj = p;
  int ink = int(aPaint.x + .5);
  if (ink == 255) ink = 6 + int(iRot.z + .5);
  vLit = uLit[ink]; vShade = uShade[ink];
  vInfo = vec4(aPaint.z, aPaint.w, (iRot.w + aPart) / 255., sway);
  gl_Position = uViewProj * wp;
}`;

export const OBJ_FS = /* glsl */`#version 300 es
precision highp float;
${COMMON}
${SURFACE}
in vec3 vWorld, vNor, vObj, vLit, vShade;
in vec4 vInfo;
uniform mat4 uView;
uniform float uDepthOnly;
layout(location=0) out vec4 oPlate;
layout(location=1) out vec4 oAux;
void main(){
  if (uDepthOnly > .5){ oPlate = vec4(0.); oAux = vec4(0.); return; }
  vec3 n = normalize(vNor);
  if (!gl_FrontFacing) n = -n;
  int style = int(vInfo.x + .5);
  float ndl = dot(n, uLightDir);
  // the light and dark sides are two separate blocks, with a slightly ragged edge between them
  float rag = (vnoise3(vObj * (style == 2 ? 2.6 : 1.2)) - .5) * (style == 2 ? .55 : .12);
  float aa = fwidth(ndl) + .02;
  float lit = smoothstep(.12 - aa, .12 + aa, ndl + rag);
  lit *= shadowVis(vWorld, ndl);
  float own = max(vInfo.y, 0.);                         // how much the thing glows by itself
  lit = max(lit, own);
  vec3 col = mix(vShade, vLit, lit);
  if (vInfo.y > -.5) col = glowPools(col, vWorld, n);   // the raven stays black by the fire
  float fog = fogAmt(vWorld);
  col = mix(col, uFogCol, fog * (1. - own * .6));

  // carving
  float dist = distance(vWorld, uCamPos);
  float near = 1. - smoothstep(20., 60., dist);
  float key = 0.;
  if (style == 1){                                    // bark: lines running up the trunk
    float a = atan(vObj.z, vObj.x);
    key = lines(a * 2.6 + vnoise(vObj.xy * vec2(1.5, .6)) * 1.5, mix(.5, .16, lit)) * .85;
  } else if (style == 2){                             // leaves: rings in the shade, a few dabs in the light
    float c = vObj.y * 2.1 + vnoise3(vObj * .9) * 2.2;
    key = lines(c, .2) * (1. - lit) * .7;
    key = max(key, dabs(vObj.xy * 2.3 + vObj.z * 1.7, .2, vec2(1., 1.9)) * lit * .5);
  } else if (style == 3){                             // boards
    key = lines(vObj.x * 3.1 + vObj.z * 3.1, .1) * .7 + dabs(vObj.xy * vec2(3., 1.2) + vObj.z, .15, vec2(2.4, .6)) * .5;
    key = max(key, lines(vObj.y * 4. + vnoise(vObj.xz) * .6, .3) * (1. - lit) * .7);
  } else if (style == 4){                             // stone
    key = dabs(vObj.xz * 5. + vObj.y * 3., .3, vec2(1.)) * .6 + lines(vObj.y * 5. + vnoise3(vObj * 2.) * 2., .3) * (1. - lit) * .8;
  } else if (style == 5){                             // cloth: a few soft folds
    key = lines(vObj.x * 1.3 + sin(vObj.y * 2.) * .25, .04) * .4 + lines(vObj.y * 2.6, .14) * (1. - lit) * .5;
  } else if (style == 6){                             // needles: short strokes that follow the bough down
    float c = vObj.y * 3.4 + length(vObj.xz) * 2.2 + vnoise3(vObj * 1.4) * 1.6;
    key = lines(c, mix(.34, .1, lit)) * .7;
  } else if (style == 7){                             // roofing tin: ribs
    key = lines(vObj.x * 4.2, .12) * .75;
  } else if (style == 8){                             // aspen bark: pale, with short dark nicks
    key = dabs(vec2(atan(vObj.z, vObj.x) * 1.6, vObj.y * 2.4), .42, vec2(.55, 2.4)) * .9;
  } else if (style == 9){                             // nothing carved
    key = 0.;
  } else {
    key = lines((vObj.x + vObj.z) * 2.3 + vObj.y * 3.4, .15) * (1. - lit) * .6;
  }
  key *= near * (1. - fog) * uHatch * (1. - own);

  vec3 vn = mat3(uView) * n;
  oPlate = vec4(col, 1.);
  oAux = vec4(vn.xy * .5 + .5, vInfo.z, key);
}`;

/* ---------------- the ground, and the ribbons laid on it (trail, road, river) ---------------- */
export const GROUND_VS = /* glsl */`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNor;
layout(location=2) in vec4 aMask;       // ground: meadow, woods, trodden, gravel.  ribbons: side (-1..1), metres along, woods, 0
uniform mat4 uViewProj;
out vec3 vWorld, vNor;
out vec4 vMask;
void main(){
  vWorld = aPos; vNor = aNor; vMask = aMask;
  gl_Position = uViewProj * vec4(aPos, 1.);
}`;

export const GROUND_FS = /* glsl */`#version 300 es
precision highp float;
${COMMON}
${SURFACE}
in vec3 vWorld, vNor;
in vec4 vMask;
uniform mat4 uView;
uniform int uKind;                      // 0 ground, 1 footpath, 2 two rut track, 3 road, 4 river
uniform vec3 uLit[32], uShade[32];
uniform float uTime, uDepthOnly;
uniform vec3 uSunDir;
uniform vec4 uSunCol;                   // rgb, how much glitter on the water
layout(location=0) out vec4 oPlate;
layout(location=1) out vec4 oAux;

void main(){
  if (uDepthOnly > .5){ oPlate = vec4(0.); oAux = vec4(0.); return; }
  vec3 n = normalize(vNor);
  vec2 P = vWorld.xz;
  float dist = distance(vWorld, uCamPos);
  float near = 1. - smoothstep(18., 62., dist);
  float ndl = dot(n, uLightDir);
  float aa = fwidth(ndl) + .015;
  float lit = smoothstep(.06 - aa, .06 + aa, ndl + (vnoise(P * .35) - .5) * .1);
  lit *= shadowVis(vWorld, ndl);
  vec3 cl, cs; float key = 0.;
  float id = 0.;

  if (uKind == 0){
    float wob = vnoise(P * .21) - .5;
    float drift = smoothstep(.42, .5, vnoise(P * .085 + vec2(5., -2.)) + wob * .25);       // goldenrod comes in drifts
    cl = mix(uLit[1], uLit[0], drift); cs = mix(uShade[1], uShade[0], drift);
    float trod = smoothstep(.45, .55, vMask.z + wob * .22);
    cl = mix(cl, uLit[2], trod); cs = mix(cs, uShade[2], trod);
    float wood = smoothstep(.44, .56, vMask.y + wob * .3);
    cl = mix(cl, uLit[5], wood); cs = mix(cs, uShade[5], wood);
    float grav = smoothstep(.42, .58, vMask.w + wob * .3);
    cl = mix(cl, uLit[4], grav); cs = mix(cs, uShade[4], grav);
    // carving: the shade is combed along the light, the open ground gets gouge marks
    vec2 ld = normalize(uLightDir.xz + vec2(1e-4));
    // sun flecks on the floor of the woods
    float fleck = wood * smoothstep(.56, .6, vnoise(P * .5 + 3.) + (vnoise(P * 1.9) - .5) * .25) * smoothstep(.2, .5, uLightDir.y) * step(.3, uShadowAmt);
    lit = max(lit, fleck);
    float comb = lines(dot(P, vec2(-ld.y, ld.x)) * 3.1 + vnoise(P * .6) * 1.4, .2) * (1. - lit);
    float marks = dabs(P * mix(2.1, 3.2, wood) + wob, mix(.2, .36, wood) * (1. - trod * .7), vec2(1., 2.2)) * mix(.45, .6, wood);
    marks = max(marks, dabs(P * 6., .3, vec2(1.)) * grav * .5);
    key = max(comb * .55, marks * lit) * near;
  } else if (uKind == 1 || uKind == 2){
    float wood = vMask.z, s = abs(vMask.x);
    vec3 a = mix(uLit[2], uLit[3], wood), b = mix(uShade[2], uShade[3], wood);
    if (uKind == 2){                                   // two ruts worn to dirt, grass up the middle
      float n = (vnoise(P * .9) - .5) * .16;
      float rut = smoothstep(.3, .38, s + n) * (1. - smoothstep(.66, .76, s + n));
      a = mix(mix(uLit[2], uLit[1], .35), uLit[3], rut); b = mix(mix(uShade[2], uShade[1], .35), uShade[3], rut);
      key = dabs(P * 5.5, .2, vec2(1.)) * rut * .45;
    }
    cl = a; cs = b;
    float fleck = wood * smoothstep(.56, .6, vnoise(P * .5 + 3.) + (vnoise(P * 1.9) - .5) * .25) * smoothstep(.2, .5, uLightDir.y) * step(.3, uShadowAmt);
    lit = max(lit, fleck);
    key = max(key, dabs(P * 3.2, .12, vec2(1., 2.)) * .4 * lit);
    vec2 ld = normalize(uLightDir.xz + vec2(1e-4));
    key = max(key, lines(dot(P, vec2(-ld.y, ld.x)) * 3.1 + vnoise(P * .6) * 1.4, .2) * (1. - lit) * .55) * near;
    if (s > .93 - vnoise(P * 1.6) * .22) discard;      // a ragged edge, not a ruler line
  } else if (uKind == 3){
    cl = uLit[21]; cs = uShade[21];
    key = dabs(P * 7., .3, vec2(1.)) * .4 * near;
    id = 3. / 255.;
  } else {
    // the river: pale water, lines that follow the current, the far bank's reflection, sun glitter
    float across = vMask.x, along = vMask.y;
    cl = uLit[12]; cs = uShade[12];
    float refl = smoothstep(-.05, -.5, across + (vnoise(vec2(along * .5, uTime * .3)) - .5) * .35);
    lit = 1. - refl * .85;
    float flow = along * .55 - uTime * .22 + sin(across * 5. + along * .4) * .25;
    float c = across * 7. + sin(flow * 1.7) * .5 + vnoise(vec2(along * .7 - uTime * .35, across * 3.)) * 1.2;
    key = lines(c, .2) * (.35 + .65 * vnoise(vec2(flow * 1.3, across * 4.))) * mix(1., .6, near);
    key *= 1. - smoothstep(60., 200., dist);
    // glitter where the low sun lies on the water
    vec3 v = normalize(uCamPos - vWorld), r = reflect(-uSunDir, vec3(0., 1., 0.));
    float sp = pow(max(dot(v, r), 0.), 26.);
    float spark = step(.62, vnoise(vec2(along * 3.1 - uTime * .9, across * 9.))) * smoothstep(.02, .3, sp);
    vec3 g = mix(cl, uSunCol.rgb, spark * uSunCol.a);
    cl = g; cs = mix(cs, uSunCol.rgb, spark * uSunCol.a);
    key *= 1. - spark * uSunCol.a;
    id = 4. / 255.;
  }

  vec3 col = mix(cs, cl, lit);
  col = glowPools(col, vWorld, n);
  float fog = fogAmt(vWorld);
  col = mix(col, uFogCol, fog);
  key *= (1. - fog) * uHatch;
  vec3 vn = mat3(uView) * n;
  oPlate = vec4(col, 1.);
  oAux = vec4(vn.xy * .5 + .5, id, key);
}`;

/* ---------------- goldenrod, grass, fern: thousands of little cut shapes that turn to face you ---------------- */
export const PLANT_VS = /* glsl */`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;        // x across and y up, in plant heights. z: 0 stem and leaf, 1 plume
layout(location=3) in vec4 iPos;        // xyz, height
layout(location=4) in vec2 iSeed;       // random, kind (0 goldenrod, 1 grass, 2 fern)
uniform mat4 uViewProj;
uniform vec3 uCamPos;
uniform float uTime;
uniform vec4 uWind;
uniform vec3 uLit[32], uShade[32];
out vec3 vWorld, vCol;
void main(){
  float r = iSeed.x, kind = iSeed.y;
  vec2 toCam = normalize(uCamPos.xz - iPos.xz + vec2(1e-4));
  vec2 right = vec2(toCam.y, -toCam.x) * (r > .5 ? 1. : -1.);
  float h = iPos.w, y = aPos.y;
  vec2 size = kind < 1.5 ? vec2(1.) : vec2(1.8, .6);            // ferns are low and wide
  vec3 p = iPos.xyz + vec3(right.x, 0., right.y) * (aPos.x * size.x * h) + vec3(0., y * size.y * h, 0.);
  // wind, and the meadow parting as you walk through it
  float ph = r * 6.283 + dot(iPos.xz, vec2(.31, .47));
  vec2 push = uWind.xy * (sin(uTime * 1.6 + ph) * .65 + sin(uTime * 3.7 + ph * 1.3) * .35) * uWind.z * 1.3;
  vec2 away = iPos.xz - uCamPos.xz; float ad = length(away);
  push += (away / max(ad, .2)) * uWind.w * smoothstep(5., .8, ad) * .5;
  p.xz += push * y * y * h;
  vWorld = p;
  float tone = step(.5, fract(r * 7.31));
  int ink = kind < .5 ? (aPos.z > .5 ? 0 : 1) : kind < 1.5 ? 1 : 18;
  vCol = aPos.z > .5 ? mix(uLit[ink], uShade[ink], tone * .55) : mix(uLit[ink], uShade[ink], .3 + tone * .5);
  gl_Position = uViewProj * vec4(p, 1.);
}`;

export const PLANT_FS = /* glsl */`#version 300 es
precision highp float;
${COMMON}
${SURFACE}
in vec3 vWorld, vCol;
layout(location=0) out vec4 oPlate;
layout(location=1) out vec4 oAux;
void main(){
  float lit = shadowVis(vWorld, 1.);
  vec3 col = mix(vCol * vec3(.66, .68, .62), vCol, lit * .8 + .2);
  col = glowPools(col, vWorld, vec3(0., 1., 0.));
  col = mix(col, uFogCol, fogAmt(vWorld));
  oPlate = vec4(col, 1.);
  oAux = vec4(.5, .5, 1. / 255., 0.);   // id 1: plants take no key line
}`;

/* ---------------- sparks, monarchs, falling leaves: specks that follow a rule, no state kept ---------------- */
export const MOTE_VS = /* glsl */`#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=3) in vec4 iSeed;       // four randoms
uniform mat4 uViewProj;
uniform vec3 uCamRight, uCamUp, uOrigin;
uniform vec4 uSpec;                     // kind, time, amount, size
out vec2 vUv; out float vLife;
void main(){
  float kind = uSpec.x, t = uSpec.y;
  vec3 p; float size = uSpec.w; float life;
  if (kind < .5){                        // sparks off the fire
    life = fract(t * (.22 + iSeed.x * .2) + iSeed.y);
    float a = iSeed.z * 6.283;
    p = uOrigin + vec3(cos(a) * (.15 + life * .7 * iSeed.w), .3 + life * (1.6 + iSeed.x * 2.2), sin(a) * (.15 + life * .7 * iSeed.w));
    p.x += sin(life * 9. + iSeed.y * 30.) * .12;
    size *= (1. - life) * step(iSeed.w, uSpec.z);
  } else {                               // monarchs over the goldenrod
    life = 1.;
    float a = t * (.25 + iSeed.x * .2) + iSeed.y * 6.283;
    vec2 c = (iSeed.zw - .5) * 2.;
    p = uOrigin + vec3(c.x * 16. + cos(a) * 2.4, 1.5 + sin(a * 2.3 + iSeed.x * 9.) * .5 + iSeed.w * .8, c.y * 16. + sin(a * 1.3) * 2.4);
    size *= .55 + .45 * abs(sin(t * 11. + iSeed.y * 40.));      // wings open and shut
    size *= step(iSeed.x, uSpec.z);
  }
  vLife = life; vUv = aCorner;
  p += (uCamRight * aCorner.x + uCamUp * aCorner.y * (kind < .5 ? 1. : .7)) * size;
  gl_Position = uViewProj * vec4(p, 1.);
}`;
export const MOTE_FS = /* glsl */`#version 300 es
precision highp float;
in vec2 vUv; in float vLife;
uniform vec3 uMoteCol;
uniform vec4 uSpec;
layout(location=0) out vec4 oPlate;
layout(location=1) out vec4 oAux;
void main(){
  float d = uSpec.x < .5 ? length(vUv) : max(abs(vUv.x) * .8 + abs(vUv.y) * .5, abs(vUv.y) * 1.1);
  if (d > 1.) discard;
  oPlate = vec4(uMoteCol, 1.);
  oAux = vec4(.5, .5, 1. / 255., uSpec.x < .5 ? 0. : step(.72, d) * .9 + step(abs(vUv.x), .12) * .9);
}`;

/* ---------------- the print ---------------- */
export const PRINT_VS = /* glsl */`#version 300 es
precision highp float;
out vec2 vUv;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p; gl_Position = vec4(p * 2. - 1., 0., 1.);
}`;

export const PRINT_FS = /* glsl */`#version 300 es
precision highp float;
${COMMON}
in vec2 vUv;
out vec4 o;
uniform sampler2D tPlate, tAux;
uniform highp sampler2D tDepth;
uniform vec2 uRes;
uniform float uLine;                    // key line weight, in pixels
uniform vec2 uNF;                       // near, far
uniform vec3 uPaper, uKey;
uniform float uKeyAmt;
uniform vec2 uReg;                      // how far the colour blocks sit off the key block, pixels
uniform float uPull;                    // changes the ink grain each time the print is "pulled" again
// the sky
uniform vec3 uCamRight, uCamUp, uCamFwd;
uniform vec4 uLens;                     // tan(half fov) x, y, shift x, y
uniform vec3 uSunDir, uMoonDir;
uniform vec4 uSunCol;                   // rgb, size (radians)
uniform vec4 uBandCol;                  // the glow along the horizon: rgb, amount
uniform vec4 uBand2Col;                 // the higher, fainter band: rgb, amount
uniform vec4 uCloud;                    // amount, drift, shade amount, lit amount
uniform vec3 uCloudShade, uCloudLit, uHaze;
uniform vec4 uNight;                    // stars, moon, moon phase (0..1), sky ruling
uniform float uTime;

float lin(float d){ float z = d * 2. - 1.; return 2. * uNF.x * uNF.y / (uNF.y + uNF.x - z * (uNF.y - uNF.x)); }

/* a line of even width along the zero of f */
float contour(float f, float w){ return 1. - smoothstep(w - 1., w, abs(f) / max(fwidth(f), 1e-5)); }

vec4 sky(vec3 rd, vec2 fc){
  // returns colour in rgb and key ink in a
  float el = asin(clamp(rd.y, -1., 1.));
  float az = atan(rd.x, -rd.z);
  vec3 col = uPaper; float key = 0.;
  float sunAz = atan(uSunDir.x, -uSunDir.z);
  float toSun = cos(az - sunAz) * .5 + .5;

  // glow along the horizon, in two cut bands that lift toward the sun
  vec2 ring = vec2(cos(az), sin(az));
  float wave = (vnoise(ring * 4. + 1.3) - .5) * .035 + (vnoise(ring * 13. + 4.1) - .5) * .012;
  float lift = mix(.55, 1.5, toSun * toSun);
  float b1 = 1. - smoothstep(-.004, .004, el - (.10 * lift + wave));
  float b2 = 1. - smoothstep(-.004, .004, el - (.22 * lift + wave * 1.7));
  col = mix(col, uBand2Col.rgb, b2 * uBand2Col.a);
  col = mix(col, uBandCol.rgb, b1 * uBandCol.a);

  // engraved ruling high in the sky
  float rule = lines(el * 46. + wave * 30., mix(.0, .34, smoothstep(.45, 1.35, el)));
  key = max(key, rule * uNight.w);

  // stars
  if (uNight.x > 0.){
    vec2 g = vec2(az * 26. * max(cos(el), .35), el * 26.);
    vec2 i = floor(g), f = fract(g) - .5;
    float h = hash12(i);
    vec2 j = (vec2(hash12(i + 3.1), hash12(i + 8.7)) - .5) * .6;
    vec2 d = abs(f - j);
    float big = step(.985, h);
    float s = step(.9, h) * (1. - smoothstep(.0, .06 + big * .05, max(d.x, d.y)));
    s = max(s, big * (1. - smoothstep(.0, .025, min(d.x, d.y))) * (1. - smoothstep(.1, .32, max(d.x, d.y))));
    float tw = .6 + .4 * sin(uTime * (1. + h * 3.) + h * 40.);
    col = mix(col, uKey, s * uNight.x * tw * smoothstep(.02, .12, el));
  }

  // clouds: cut shapes with flat bottoms, a shaded belly and a key line
  if (uCloud.x > 0.){
    vec3 cp = vec3(cos(az + uCloud.y) * 2.4, sin(az + uCloud.y) * 2.4, el * 11.);
    float n = fbm3(cp + vec3(0., 0., 3.));
    float bandMask = smoothstep(.07, .2, el) * (1. - smoothstep(.55, .8, el));
    float shape = n - (.93 - uCloud.x * .62) + (bandMask - 1.) * .5;
    float body = smoothstep(0., fwidth(shape) * 1.5, shape);
    float belly = smoothstep(0., .02, shape) * (1. - smoothstep(.02, .12, shape - (fbm3(cp * 2.2 + 9.) - .5) * .08));
    vec3 cc = mix(uCloudLit, uCloudShade, belly * uCloud.z);
    col = mix(col, cc, body * uCloud.w);
    key = max(key, contour(shape, 1.3 * uLine) * .8 * step(.001, uCloud.w));
    key = max(key, lines(el * 110., .22) * belly * body * .55);
  }

  // the sun: a flat disc, a key ring, and short cut rays
  float sd = acos(clamp(dot(rd, uSunDir), -1., 1.));
  float R = uSunCol.a;
  if (R > 0. && sd < R * 3.2){
    vec3 sx = normalize(cross(uSunDir, vec3(0., 1., 0.))), sy = cross(sx, uSunDir);
    float ang = atan(dot(rd, sy), dot(rd, sx));
    float disc = 1. - smoothstep(R - .0015, R + .0015, sd);
    float ray = step(.5, fract(ang * 16. / 6.2832 + .25)) ;
    float longRay = step(.5, fract(ang * 8. / 6.2832 + .125));
    float rays = ray * smoothstep(R * 1.32, R * 1.36, sd) * (1. - smoothstep(R * mix(1.75, 2.35, longRay), R * mix(1.8, 2.4, longRay), sd));
    col = mix(col, uSunCol.rgb, max(disc, rays * .9));
    key = max(key, (1. - smoothstep(.0012, .0026, abs(sd - R))) * .9);
  }
  // the moon, in tonight's phase
  float md = acos(clamp(dot(rd, uMoonDir), -1., 1.));
  float MR = .052;
  if (uNight.y > 0. && md < MR * 1.4){
    vec3 mx = normalize(cross(uMoonDir, vec3(0., 1., 0.))), my = cross(mx, uMoonDir);
    vec2 q = vec2(dot(rd, mx), dot(rd, my)) / MR;
    float inside = 1. - smoothstep(.97, 1.03, length(q));
    float ph = uNight.z;                               // 0 new, .5 full, 1 new
    float k = cos(ph * 6.2832);                        // terminator
    float edge = sqrt(max(1. - q.y * q.y, 0.)) * k;
    float litSide = ph < .5 ? step(edge, -q.x) : step(edge, q.x);
    litSide = ph < .5 ? smoothstep(-.04, .04, -q.x - edge) : smoothstep(-.04, .04, q.x - edge);
    col = mix(col, mix(col, uKey, .12 + .88 * litSide), inside * uNight.y);
    key = max(key, 0.);
  }
  return vec4(col, key);
}

void main(){
  vec2 px = 1. / uRes, fc = vUv * uRes;
  // the block was cut by hand, so nothing is quite straight
  vec2 wob = vec2(vnoise(fc / (38. * uLine)), vnoise(fc / (38. * uLine) + 31.7)) - .5;
  vec2 uv = vUv + wob * 2.2 * uLine * px;

  float dc = texture(tDepth, uv).r;
  float zc = lin(dc);
  vec4 ac = texture(tAux, uv);
  float idc = ac.b * 255.;
  bool plant = abs(idc - 1.) < .5;

  // the key block: a line wherever depth jumps, a surface turns sharply, or one thing ends and another starts
  float lw = uLine * (.8 + .5 * vnoise(fc / (90. * uLine) + 5.)) * mix(1.1, .6, smoothstep(25., 240., zc));
  float sd = 0., sn = 0., si = 0., wsum = 0., zmin = zc;
  vec3 nc = vec3(ac.rg * 2. - 1., 0.); nc.z = sqrt(max(1. - dot(nc.xy, nc.xy), 0.));
  for (int i = 0; i < 8; i++){
    float a = float(i) * .7853982;
    vec2 off = vec2(cos(a), sin(a)) * lw * ((i & 1) == 0 ? 1. : .72) * px;
    vec4 at = texture(tAux, uv + off);
    float dt = texture(tDepth, uv + off).r;
    float idt = at.b * 255.;
    float w = abs(idt - 1.) < .5 ? 0. : 1.;
    sd += (dt - dc) * w;
    vec2 nt = at.rg * 2. - 1.;
    sn += (1. - dot(nt, nc.xy) - sqrt(max(1. - dot(nt, nt), 0.)) * nc.z) * w * step(dt, .99999);
    si += step(.5, abs(idt - idc)) * w;
    wsum += w;
    zmin = min(zmin, lin(dt));
  }
  float edge = 0.;
  if (!plant && wsum > 0.){
    float eD = smoothstep(.006, .02, abs(sd / wsum) * zc / uNF.x);
    float eN = smoothstep(.16, .5, sn / wsum) * step(dc, .99999);
    float eI = smoothstep(.1, .45, si / wsum);
    edge = max(max(eD, eN), eI);
    edge *= mix(1., .42, smoothstep(40., 260., zmin));
  }

  // the colour blocks, a hair out of register
  vec4 pl = texture(tPlate, uv + uReg * px);
  vec3 col; float key = max(edge, ac.a);
  if (pl.a < .999 || dc >= .99999){
    vec2 ndc = uv * 2. - 1.;
    vec3 rd = normalize(uCamFwd + uCamRight * ((ndc.x - uLens.z) * uLens.x) + uCamUp * ((ndc.y - uLens.w) * uLens.y));
    vec4 s = sky(rd, fc);
    // past the last hill: flat haze, so the world has no edge
    float below = 1. - smoothstep(-.004, .004, asin(clamp(rd.y, -1., 1.)) - (.012 + (vnoise(normalize(rd.xz + vec2(1e-5)) * 7. + 2.) - .5) * .02));
    s.rgb = mix(s.rgb, uHaze, below); s.a *= 1. - below;
    col = mix(s.rgb, pl.rgb, pl.a);
    key = max(key, s.a * (1. - pl.a));
  } else col = pl.rgb;

  // ink sits unevenly on paper
  float mott = vnoise(fc / 19. + uPull) * .6 + vnoise(fc / 4.3 + uPull * 3.) * .4;
  float skip = smoothstep(.8, .98, vnoise(fc / 2.3 + uPull * 7.) * .7 + hash12(floor(fc / 1.5) + uPull) * .45);
  col = mix(uPaper, col, .9 + .1 * mott - skip * .16);
  col = mix(col, uKey, key * uKeyAmt * (1. - skip * .3) * (.86 + .14 * mott));
  // paper tooth
  col *= 1. - .035 * (hash12(fc + 3.3) - .5) - .03 * (vnoise(fc / 1.7) - .5);
  o = vec4(col, 1.);
}`;
