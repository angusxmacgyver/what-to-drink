import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/** Quad width in CSS px; the visible stroke is narrower and anti-aliased in the shader. */
const QUAD_W = 5;

const LINE_VERT = /* glsl */ `
  attribute float aAlpha;
  attribute float aHi;
  attribute float aFade;
  attribute float aFill;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vHi;
  varying float vFade;
  varying float vFill;
  void main() {
    vUv = uv;
    vAlpha = aAlpha;
    vHi = aHi;
    vFade = aFade;
    vFill = aFill;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const LINE_FRAG = /* glsl */ `
  uniform float uLineW;
  uniform vec3 uColor;
  uniform vec3 uHiColor;
  uniform float uFillMix;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vHi;
  varying float vFade;
  varying float vFill;
  void main() {
    float d = abs(vUv.x - 0.5) * ${QUAD_W.toFixed(1)};
    float hw = uLineW * 0.5;
    float stroke = 1.0 - smoothstep(hw - 0.45, hw + 0.45, d);
    float base = vFade > 0.001 ? smoothstep(0.0, vFade, vUv.y) : 1.0;
    float along = mix(0.18, 1.0, base);
    vec3 col = mix(uColor, uHiColor, vHi);

    // Amber "pour" rising from the base of the line, with a bright meniscus at its surface.
    float filled = (1.0 - smoothstep(vFill - 0.035, vFill, vUv.y)) * step(0.001, vFill) * uFillMix;
    float surface = exp(-pow((vUv.y - vFill) / 0.022, 2.0)) * (1.0 - smoothstep(0.93, 1.0, vFill)) * step(0.001, vFill) * uFillMix;
    col = mix(col, uHiColor, filled);
    col = mix(col, vec3(1.0, 0.9, 0.72), surface);
    along = mix(along, 1.0, filled);

    float a = stroke * vAlpha * along * (1.0 + vHi * 0.35 + filled * 0.45 + surface * 1.8);
    gl_FragColor = vec4(col * a, a);
  }
`;

const BG_VERT = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BG_FRAG = /* glsl */ `
  uniform vec2 uRes;
  uniform float uPr;
  uniform vec2 uCenter;
  uniform float uR0;
  uniform float uR1;
  uniform float uCore;
  uniform float uTime;
  void main() {
    vec2 p = vec2(gl_FragCoord.x, uRes.y * uPr - gl_FragCoord.y) / uPr;
    float yN = p.y / uRes.y;

    vec3 col = mix(vec3(0.020, 0.019, 0.022), vec3(0.045, 0.031, 0.024), smoothstep(0.1, 1.0, yN));

    float d = length(p - uCenter);
    float outside = max(d - uR0, 0.0);
    float haze = exp(-pow(outside / (uR1 * 1.05), 1.35));
    col += vec3(0.30, 0.17, 0.08) * haze * 0.2 * uCore;

    // The core: a dim amber disc, lit from its upper edge like a dram held to a candle.
    float disc = 1.0 - smoothstep(uR0 - 1.0, uR0 + 1.0, d);
    vec2 q = (p - uCenter) / uR0;
    float lit = clamp(0.5 - q.y * 0.5, 0.0, 1.0);
    float swirl = 0.012 * sin(q.x * 6.0 + uTime * 0.4) * sin(q.y * 5.0 - uTime * 0.3);
    vec3 discCol = mix(vec3(0.035, 0.026, 0.022), vec3(0.15, 0.092, 0.05), pow(lit, 1.8)) + swirl;
    col = mix(col, discCol * (0.6 + 0.4 * uCore), disc);

    float rim = exp(-pow((d - uR0) / 1.4, 2.0)) * smoothstep(0.1, -0.95, q.y);
    col += vec3(0.85, 0.58, 0.32) * rim * 0.22 * uCore;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const DUST_VERT = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  uniform float uPr;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    gl_PointSize = aSize * uPr;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DUST_FRAG = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.0, d);
    a *= a * vAlpha;
    gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * a, a);
  }
`;

const FLASH_FRAG = /* glsl */ `
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p * vec2(1.0, 1.0));
    float core = exp(-d * d * 18.0);
    float halo = exp(-d * 3.2) * 0.35;
    float streak = exp(-abs(p.y) * 60.0) * exp(-abs(p.x) * 2.5) * 0.6;
    float a = (core + halo + streak) * uIntensity;
    gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * a, a);
  }
`;

const LIQUID_FRAG = /* glsl */ `
  uniform vec2 uRes;
  uniform float uPr;
  uniform float uTime;
  uniform vec3 uGlass;
  uniform float uDraw;
  uniform float uLevel;
  uniform float uRock;
  uniform float uRipple;
  uniform float uImpact;
  uniform vec4 uStream;
  uniform float uGlint;
  uniform float uFade;
  uniform float uLegs;
  uniform float uAngle;

  const float TILT = 0.15;
  const float FOOT = 0.035;
  const float RF = 0.2;
  const float FLOOR = 0.25;
  const float CAV = 0.75;
  const float WALL = 0.012;
  const float RMAX = 0.27;
  const float PI = 3.14159265;
  const vec2 PIVOT = vec2(0.0, 0.7);

  float hash1(float x) { return fract(sin(x * 127.1 + 11.7) * 43758.5453); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  // Iterated-warp caustic network (after Dave Hoskins' tileable water caustic).
  float caustic(vec2 uv, float t) {
    vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
    vec2 i = p;
    float c = 1.0;
    for (int n = 0; n < 4; n++) {
      float tt = t * (1.0 - 3.5 / float(n + 1));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005)));
    }
    c = 1.17 - pow(c / 4.0, 1.4);
    return pow(abs(c), 8.0);
  }

  // Glencairn profile, in glass-height units: inner bowl radius by bowl fraction, outer radius by height.
  float innerR(float v) {
    float b = clamp(v / 0.14, 0.0, 1.0);
    float rb = sqrt(max(1.0 - (1.0 - b) * (1.0 - b), 0.0));
    float body = mix(1.0, 0.64, smoothstep(0.18, 0.93, v)) + 0.05 * smoothstep(0.86, 1.0, v);
    return RMAX * rb * body;
  }
  float smax(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (a - b) / k, 0.0, 1.0);
    return mix(b, a, h) + k * h * (1.0 - h);
  }
  float outerR(float u) {
    float base = (0.075 + 0.13 * pow(smoothstep(0.03, 0.3, u), 1.6)) * (1.0 - smoothstep(0.32, 0.5, u));
    float bowl = u > FLOOR ? innerR((u - FLOOR) / CAV) + WALL : 0.0;
    return smax(base, bowl, 0.025);
  }

  float ellipseD(vec2 p, vec2 c, vec2 r) {
    vec2 e = (p - c) / r;
    return abs(dot(e, e) - 1.0) / max(length(2.0 * e / r), 1e-4);
  }
  float lineA(float dpx) { return 1.0 - smoothstep(0.1, 1.3, dpx); }

  void over(inout vec4 acc, vec3 c, float a) {
    acc.rgb = c * a + acc.rgb * (1.0 - a);
    acc.a = a + acc.a * (1.0 - a);
  }

  void main() {
    vec2 p = gl_FragCoord.xy / uPr;
    float H = uGlass.z;
    vec2 qw = (p - uGlass.xy) / H;
    float ca = cos(uAngle);
    float sa = sin(uAngle);
    vec2 qd = qw - PIVOT;
    vec2 q = vec2(qd.x * ca + qd.y * sa, -qd.x * sa + qd.y * ca) + PIVOT;
    float px = 1.0 / H;
    float t = uTime;
    float ax = abs(q.x);
    vec4 acc = vec4(0.0);

    float fill = smoothstep(0.0, 0.1, uLevel);
    float lf = 1.0 - smoothstep(0.3, 1.0, uFade);
    float gf = 1.0 - smoothstep(0.0, 0.55, uFade);
    float ready = smoothstep(0.8, 1.0, uDraw) * gf;
    vec3 lc = vec3(1.0, 0.93, 0.82);
    vec3 hot = vec3(0.92, 0.55, 0.2);

    float amb = smoothstep(0.25, 1.0, uDraw) * gf;
    vec3 bokeh = vec3(0.0);
    for (int i = 0; i < 14; i++) {
      float fi = float(i);
      vec2 c = vec2(hash1(fi * 3.7), 0.15 + 0.85 * hash1(fi * 9.1)) * uRes;
      c += vec2(sin(t * 0.07 + fi), cos(t * 0.05 + fi * 1.3)) * 18.0;
      float r = mix(22.0, 68.0, hash1(fi * 5.3)) * uRes.y / 900.0;
      float d = length(p - c);
      float disc = 1.0 - smoothstep(r - 1.5, r + 1.5, d);
      float rim = smoothstep(r * 0.55, r, d);
      bokeh += mix(vec3(0.9, 0.5, 0.18), vec3(1.0, 0.8, 0.5), hash1(fi * 1.9)) * disc * (0.55 + 0.45 * rim) * mix(0.018, 0.05, hash1(fi * 7.3));
    }
    acc.rgb += bokeh * amb;

    vec2 dv = qw - vec2(0.0, uStream.z + 0.35);
    float bang = atan(dv.x, -dv.y);
    float bdist = length(dv);
    float cone = 1.0 - smoothstep(0.14, 0.3, abs(bang));
    float rays = 0.55 + 0.45 * vnoise(vec2(bang * 24.0, t * 0.12));
    float beam = cone * rays * smoothstep(0.2, 1.0, bdist) * (1.0 - smoothstep(-0.02, -0.12, qw.y) * 0.0) * exp(-max(-qw.y, 0.0) * 10.0);
    acc.rgb += vec3(1.0, 0.86, 0.66) * beam * 0.03 * amb;

    if (qw.y < 0.0 && qw.y > -0.16 && abs(qw.x) < 0.5) {
      vec2 te = vec2(qw.x / 0.36, (qw.y + 0.05) / 0.05);
      float tm = exp(-pow(length(te), 3.0) * 1.1);
      float tcs = caustic(vec2(te.x * 0.3, te.y * 0.1) + 0.3, t * 0.35 + 11.0);
      acc.rgb += vec3(1.0, 0.6, 0.24) * (tcs * 0.5 + 0.08) * tm * 0.3 * fill * lf * (1.0 - smoothstep(0.05, 0.2, abs(uAngle)));
    }

    // Light thrown through the whisky onto the table.
    vec2 pool = vec2(qw.x / 0.36, (qw.y + 0.01) / 0.05);
    acc.rgb += vec3(0.8, 0.4, 0.11) * exp(-dot(pool, pool)) * 0.2 * fill * lf;
    vec2 halo = vec2(q.x / 0.55, (q.y - 0.3) / 0.55);
    acc.rgb += vec3(0.5, 0.24, 0.06) * exp(-dot(halo, halo) * 2.0) * 0.1 * fill * lf;

    if (q.y < 0.0 && q.y > -0.45 && ax < 0.32) {
      float my = -q.y + FOOT * 0.5;
      float mv = (my - FLOOR) / CAV;
      float mi = step(FLOOR, my) * step(my, FLOOR + uLevel * CAV) * (1.0 - smoothstep(-px, px, ax - innerR(clamp(mv, 0.0, 1.0))));
      acc.rgb += vec3(0.55, 0.24, 0.06) * mi * 0.07 * (1.0 - smoothstep(0.0, 0.4, -q.y)) * lf * (1.0 - smoothstep(0.02, 0.1, abs(uAngle)));
    }

    bool box = ax < 0.38 && q.y > -0.06 && q.y < 1.08;
    float uL = FLOOR + uLevel * CAV;
    float slope = -tan(uAngle) + uRock;
    float yIw = PIVOT.y + (uL - PIVOT.y) * ca;
    vec2 gI = vec2((uL - PIVOT.y) * ca * sa, 0.0);
    gI.y = uL + slope * gI.x;

    if (box) {
      float uc = clamp(q.y, FOOT, 1.0);
      float ro = outerR(uc);
      float vq = (q.y - FLOOR) / CAV;
      float riq = innerR(clamp(vq, 0.0, 1.0));
      float inSil = step(FOOT, q.y) * step(q.y, 1.0) * (1.0 - smoothstep(-px, px, ax - ro));
      float inCav = step(FLOOR, q.y) * step(q.y, 1.0) * (1.0 - smoothstep(-px, px, ax - riq));
      float nxo = q.x / max(ro, 1e-3);

      // Solid glass base, lit by the liquid above it.
      float solid = inSil * (1.0 - inCav) * (1.0 - smoothstep(0.34, 0.42, q.y));
      if (solid > 0.0) {
        float bw = asin(clamp(nxo, -0.999, 0.999));
        float lens = caustic(vec2(bw * 0.2, -q.y * 3.0), t * 0.4 + 41.0);
        vec3 bc = mix(vec3(0.05, 0.045, 0.04), vec3(0.6, 0.28, 0.07) * (0.6 + 1.1 * lens), fill * (1.0 - abs(nxo) * 0.55));
        bc += vec3(1.0, 0.75, 0.42) * exp(-pow((q.y - FLOOR + 0.006) / 0.006, 2.0)) * fill * 0.25 * (1.0 - abs(nxo));
        bc += lc * pow(abs(nxo), 8.0) * 0.12;
        over(acc, bc * mix(gf, lf, fill), solid * mix(0.5, 0.75, fill) * smoothstep(0.0, 0.6, uDraw));
      }

      // The dram.
      if (uLevel > 0.002) {
        float rL = innerR(uLevel);
        float cx = uL + slope * q.x + 0.0012 * uRipple * sin(q.x * 90.0 - t * 9.0);
        float k = q.x / max(rL, 1e-4);
        float e = rL * TILT * sqrt(max(1.0 - k * k, 0.0));
        float yF = cx - e;
        float yB = cx + e;

        float bodyM = inCav * (1.0 - smoothstep(-px, px, q.y - yF));
        if (bodyM > 0.0) {
          float nx = clamp(q.x / max(riq, 1e-3), -0.999, 0.999);
          float th = sqrt(1.0 - nx * nx);
          float wx = asin(nx);
          float dz = max(yF - q.y, 0.0);
          float dzn = clamp(dz / max(uL - FLOOR, 0.02), 0.0, 1.0);

          // Backlit absorption: honey near the surface and centre, mahogany in the depths.
          float path = (0.4 + 0.6 * th) * (0.5 + 0.75 * dzn);
          vec3 c = vec3(1.0, 0.87, 0.64) * exp(-vec3(0.85, 2.1, 4.8) * path) * 1.2;

          vec2 cuv = vec2(wx * 0.32 + uRock * 0.4, q.y * 2.2 - t * 0.02);
          float cs = caustic(cuv, t * 0.45 + 23.0);
          c += vec3(1.0, 0.72, 0.36) * cs * 0.42 * (1.0 - 0.55 * dzn) * (0.4 + 0.6 * th);

          float shaft = pow(vnoise(vec2(wx * 4.0 + t * 0.12, t * 0.07)), 3.0);
          c += vec3(1.0, 0.7, 0.35) * shaft * 0.3 * exp(-dz * 6.0) * th;

          float n = vnoise(vec2(wx * 5.0 + t * 0.15, q.y * 10.0 - t * 0.35));
          c *= 0.9 + 0.2 * n;

          float edge = smoothstep(0.72, 0.97, abs(nx));
          c = mix(c, vec3(0.16, 0.05, 0.012), edge * 0.75);
          c += vec3(1.0, 0.72, 0.4) * exp(-pow((abs(nx) - 0.965) / 0.018, 2.0)) * 0.3;
          c += vec3(1.0, 0.78, 0.45) * exp(-pow((nx + 0.62) / 0.06, 2.0)) * 0.12 * (1.0 - dzn);

          float plume = uImpact * exp(-pow((q.x - gI.x) / (0.01 + 0.45 * dz), 2.0)) * exp(-dz * 7.0);
          float streak = vnoise(vec2(q.x * 70.0 + sin(q.y * 30.0 + t * 2.0) * 1.5, q.y * 45.0 + t * 6.0));
          c = mix(c, vec3(0.98, 0.76, 0.48), plume * (0.25 + 0.75 * streak) * 0.42);
          c += vec3(1.0, 0.84, 0.58) * exp(-pow(dz / (1.3 * px), 2.0)) * 0.55;
          c += vec3(0.35, 0.55, 1.0) * exp(-pow((dz - 3.0 * px) / (1.2 * px), 2.0)) * 0.08;

          float a = mix(0.58, 0.93, clamp(dzn * 0.55 + th * 0.35 + edge * 0.3, 0.0, 1.0));
          over(acc, c * lf, bodyM * a * lf);
        }

        float faceM = (1.0 - smoothstep(-px, px, ax - rL)) * (1.0 - smoothstep(-px, px, ax - riq - 0.002)) * step(FLOOR, q.y) * smoothstep(yF - px, yF + px, q.y) * (1.0 - smoothstep(yB - px, yB + px, q.y));
        if (faceM > 0.0) {
          vec2 sp = vec2(k, (q.y - cx) / max(rL * TILT, 1e-4));
          float rr = length(sp);
          vec2 sr = sp - vec2(gI.x / max(rL, 1e-3), 0.0);
          float rq = length(sr);
          float ra = exp(-rq * 2.2) * uRipple * 0.35;
          float h0 = sin(rq * 44.0 - t * 10.0) * ra;
          float hx = sin(length(sr + vec2(0.02, 0.0)) * 44.0 - t * 10.0) * ra;
          float hy = sin(length(sr + vec2(0.0, 0.02)) * 44.0 - t * 10.0) * ra;
          float nz = vnoise(sp * 5.0 + vec2(t * 0.35, -t * 0.2));
          vec2 g = vec2(hx - h0, hy - h0) / 0.02 + (vec2(vnoise(sp * 5.0 + vec2(t * 0.35 + 0.05, -t * 0.2)), vnoise(sp * 5.0 + vec2(t * 0.35, -t * 0.2 + 0.05))) - nz) * 6.0;
          float fres = smoothstep(-1.0, 1.0, sp.y);
          vec3 seen = vec3(0.62, 0.3, 0.075) * (0.85 + 0.3 * (1.0 - rr));
          vec3 refl = vec3(0.95, 0.72, 0.45);
          vec3 fc = mix(seen, refl, fres * 0.55);
          fc += vec3(1.0, 0.75, 0.4) * caustic(sp * 0.35 + vec2(0.0, t * 0.01), t * 0.5 + 7.0) * 0.18 * (1.0 - fres);
          float spec = pow(clamp(0.5 + 0.06 * dot(g, normalize(vec2(-0.6, 0.8))), 0.0, 1.0), 10.0);
          fc += vec3(1.0, 0.9, 0.74) * spec * 0.28;
          fc *= 0.94 + 0.12 * nz;
          float crown = exp(-pow((rq - 0.08 - 0.015 * sin(t * 23.0)) / 0.03, 2.0)) * uImpact;
          fc += vec3(1.0, 0.85, 0.6) * crown * 0.18;
          vec2 sd = sp - vec2(-0.42, 0.42);
          fc += vec3(1.0, 0.9, 0.75) * exp(-dot(sd, sd) * 7.0) * 0.16;
          fc += vec3(1.0, 0.86, 0.62) * exp(-pow((rr - 0.97) / 0.03, 2.0)) * (0.35 + 0.35 * fres);
          over(acc, fc * lf, faceM * mix(0.78, 0.95, fres) * lf);
        }

        // Tears running down the inside of the bowl after the pour.
        float above = q.y - yB;
        if (uLegs > 0.0 && inCav > 0.0 && above > -0.01 && above < 0.16) {
          float appear = min(uLegs * 2.5, 1.0);
          float nx = clamp(q.x / max(riq, 1e-3), -0.999, 0.999);
          float wx = asin(nx);
          float facing = sqrt(1.0 - nx * nx);
          float top = 0.08 + 0.025 * vnoise(vec2(wx * 3.0, 3.0));
          float film = (1.0 - smoothstep(top - 0.03, top, above)) * smoothstep(-0.005, 0.01, above);
          float edge = exp(-pow((above - top) / (2.5 * px), 2.0));
          vec3 tc = vec3(0.85, 0.5, 0.17) * film * 0.035 + vec3(1.0, 0.78, 0.48) * edge * 0.025;

          float lanes = 9.0;
          float li = floor(wx / PI * lanes + 0.5 * lanes);
          for (int j = -1; j <= 1; j++) {
            float lj = li + float(j);
            float h = hash1(lj * 4.7 + 1.3);
            if (h < 0.35) continue;
            float wc = ((lj + 0.5 + (hash1(lj * 2.9) - 0.5) * 0.5) / lanes - 0.5) * PI;
            float fw = cos(wc);
            float dx = (q.x - sin(wc) * riq) * H / fw;
            float ltop = 0.08 + 0.025 * vnoise(vec2(wc * 3.0, 3.0));
            float bpos = ltop * (1.0 - fract(uLegs * (0.1 + 0.12 * h) + h * 3.7));
            float dy = (above - bpos) * H;
            float span = (ltop - bpos) * H;
            float rb = mix(4.6, 6.6, hash1(lj * 6.1));
            float rw = mix(1.4, 2.8, smoothstep(span, 0.0, dy)) * smoothstep(span + 2.0, span - 6.0, dy);
            float w = dy < 0.0 ? sqrt(max(rb * rb - dy * dy, 0.0)) : mix(rb, rw, smoothstep(0.0, rb * 2.6, dy));
            float m = 1.0 - smoothstep(w - 0.8, w + 0.8, abs(dx));
            if (m <= 0.0) continue;
            float n = dx / max(w, 0.5);
            float bulb = 1.0 - smoothstep(rb * 0.4, rb * 2.4, dy);
            float rimShade = smoothstep(0.45, 1.0, abs(n));
            vec2 hp = vec2(dx + rb * 0.35, dy - rb * 0.3) / rb;
            float spec = exp(-dot(hp, hp) * 9.0) * bulb;
            float crescent = exp(-pow((length(vec2(dx, min(dy, 0.0))) - rb * 0.7) / 0.9, 2.0)) * step(dy, 0.0);
            tc += (vec3(0.75, 0.4, 0.12) * (0.03 + 0.09 * rimShade) * (0.5 + 0.5 * bulb)
              + vec3(1.0, 0.9, 0.75) * spec * 0.2
              + vec3(1.0, 0.7, 0.35) * crescent * 0.09) * m * fw;
          }
          acc.rgb += tc * appear * facing * lf;
        }
      }
    }

    // The stream, thinning as it falls.
    if (uStream.w > 0.5 && abs(qw.x) < 0.03) {
      float fall = max(uStream.z - qw.y, 0.0);
      float hw = 0.0095 / sqrt(1.0 + 1.8 * fall);
      float off = (0.0006 * sin(qw.y * 21.0 - t * 13.0) + 0.0003 * sin(qw.y * 57.0 + t * 19.0)) * smoothstep(0.0, 0.8, fall);
      float s = (qw.x - off) / hw;
      float lo = max(uStream.x, yIw - 0.004);
      float cov = (1.0 - smoothstep(1.0 - px / hw, 1.0 + px / hw, abs(s)))
        * smoothstep(lo - px, lo + px, qw.y) * (1.0 - smoothstep(uStream.y - px, uStream.y + px, qw.y));
      vec3 sc = mix(vec3(0.42, 0.19, 0.05), vec3(0.86, 0.5, 0.18), 1.0 - s * s);
      float twist = 0.42 + 0.12 * sin(qw.y * 26.0 + t * 30.0);
      sc += lc * exp(-pow((s + twist) / 0.15, 2.0)) * 0.4;
      sc += lc * exp(-pow((s - 0.55) / 0.1, 2.0)) * 0.08;
      sc *= 0.94 + 0.06 * vnoise(vec2(s * 2.0, qw.y * 90.0 + t * 60.0));
      over(acc, sc * lf, cov * 0.96 * lf);
    }

    // Splash droplets at the point of impact.
    if (uImpact > 0.01 && abs(qw.x) < 0.06 && abs(qw.y - yIw) < 0.05) {
      for (int i = 0; i < 9; i++) {
        float fi = float(i);
        float P = 0.36 + 0.3 * hash1(fi * 7.7);
        float tt = fract(t / P + hash1(fi * 3.1)) * P;
        vec2 v0 = vec2((hash1(fi * 5.3) - 0.5) * 0.24, 0.1 + 0.16 * hash1(fi * 9.1));
        vec2 dp = vec2(0.0, yIw) + v0 * tt - vec2(0.0, 1.6 * tt * tt);
        if (dp.y < yIw - 0.002) continue;
        float r = (1.6 - tt / P) * px;
        float d = length(qw - dp);
        acc.rgb += vec3(1.0, 0.74, 0.42) * (1.0 - smoothstep(r - px, r + px, d)) * uImpact * 0.7 * lf;
      }
    }

    if (uLegs > 0.0 && qw.y > 0.92 && qw.y < 1.8 && abs(qw.x) < 0.4) {
      float y = qw.y - 1.0;
      vec2 wp = vec2(qw.x * 5.0 + sin(y * 4.0 - t * 0.5) * 0.5, y * 2.2 - t * 0.22);
      float f = vnoise(wp * 2.0) * 0.5 + vnoise(wp * 4.1 + 3.0) * 0.3 + vnoise(wp * 8.3 + 7.0) * 0.2;
      float curl = smoothstep(0.5, 0.82, f);
      float spread = 0.07 + max(y, 0.0) * 0.3;
      float m = exp(-pow(qw.x / spread, 2.0)) * smoothstep(-0.04, 0.08, y) * (1.0 - smoothstep(0.2, 0.75, y));
      acc.rgb += vec3(0.95, 0.8, 0.62) * curl * m * 0.07 * min(uLegs * 1.2, 1.0) * lf;
    }

    // The glass, drawn in fine lines like the wheel.
    if (box) {
      float footDraw = clamp(uDraw / 0.22, 0.0, 1.0);
      float wallDraw = clamp((uDraw - 0.12) / 0.72, 0.0, 1.0);
      float rimDraw = clamp((uDraw - 0.8) / 0.2, 0.0, 1.0);
      float head = FOOT + wallDraw * (1.0 - FOOT);

      vec2 fr = vec2(RF, RF * TILT);
      vec2 fe = q / fr;
      float fang = abs(atan(fe.x, -fe.y));
      float footTop = lineA(ellipseD(q, vec2(0.0, FOOT), fr) * H) * step(fang, footDraw * PI);
      float footBot = lineA(ellipseD(q, vec2(0.0, 0.0), fr) * H) * step(q.y, 0.0) * step(fang, footDraw * PI);
      float footSide = lineA(abs(ax - RF) * H) * step(0.0, q.y) * step(q.y, FOOT) * step(1.0, footDraw);
      float backFade = q.y > FOOT ? 0.45 : 1.0;
      acc.rgb += lc * (footTop * 0.45 * backFade + footBot * 0.55 + footSide * 0.5) * gf;

      if (q.y > FOOT && q.y < 1.0) {
        float ro = outerR(q.y);
        float dro = (outerR(q.y + 0.003) - outerR(q.y - 0.003)) / 0.006;
        float reveal = 1.0 - smoothstep(head - 0.004, head, q.y);
        float wall = lineA(abs(ax - ro) / sqrt(1.0 + dro * dro) * H);
        float inner = 0.0;
        if (q.y > FLOOR) {
          float v = (q.y - FLOOR) / CAV;
          float ri = innerR(v);
          float dri = (innerR(v + 0.004) - innerR(max(v - 0.004, 0.0))) / (0.008 * CAV);
          inner = lineA(abs(ax - ri) / sqrt(1.0 + dri * dri) * H);
        }
        float dw = (ax - ro) / sqrt(1.0 + dro * dro) * H;
        vec3 fringe = vec3(1.0, 0.55, 0.3) * lineA(abs(dw - 1.6)) * 0.1 + vec3(0.45, 0.6, 1.0) * lineA(abs(dw + 1.6)) * 0.07;
        acc.rgb += (lc * (wall * 0.5 + inner * 0.13) + fringe * ready) * reveal * gf;

        float nxo = q.x / ro;
        float sil = 1.0 - smoothstep(-px, px, ax - ro);
        float sbV = smoothstep(0.3, 0.42, q.y) * (1.0 - smoothstep(0.86, 0.96, q.y));
        float sb = smoothstep(-0.88, -0.82, nxo) * (1.0 - smoothstep(-0.6, -0.54, nxo)) * (0.35 + 0.65 * smoothstep(-0.54, -0.86, nxo));
        float sbEdge = exp(-pow((nxo + 0.84) / 0.012, 2.0));
        float sbBar = 1.0 - 0.6 * exp(-pow((q.y - 0.62) / 0.008, 2.0));
        float hr = exp(-pow((nxo - 0.78) / 0.03, 2.0)) * smoothstep(0.36, 0.5, q.y) * (1.0 - smoothstep(0.7, 0.84, q.y));
        acc.rgb += lc * ((sb * 0.075 * sbBar + sbEdge * 0.09) * sbV + hr * 0.07) * sil * ready;
        float band = smoothstep(innerR(clamp((q.y - FLOOR) / CAV, 0.0, 1.0)) - 0.006, ro - 0.002, ax) * sil * step(FLOOR, q.y);
        float lit = exp(-abs(q.y - uL) * 10.0) * 0.45 + step(q.y, uL) * 0.3;
        acc.rgb += vec3(0.95, 0.52, 0.16) * band * lit * fill * 0.4 * lf;
        acc.rgb += vec3(0.6, 0.58, 0.55) * (0.012 + 0.07 * pow(abs(nxo), 6.0)) * sil * ready;
        acc.a = max(acc.a, (0.03 + 0.12 * pow(abs(nxo), 6.0)) * sil * ready);
        if (uGlint > 0.0 && uGlint < 1.0) {
          float band = q.x + (q.y - 0.5) * 0.45 - mix(-0.42, 0.42, uGlint);
          float env = smoothstep(0.0, 0.15, uGlint) * (1.0 - smoothstep(0.8, 1.0, uGlint));
          acc.rgb += lc * exp(-band * band / 0.0006) * 0.3 * env * (0.35 + 0.65 * pow(abs(nxo), 2.0)) * sil * gf;
        }
      }

      if (wallDraw > 0.0 && wallDraw < 1.0) {
        float rh = outerR(head);
        float d = length(vec2(ax - rh, q.y - head)) * H;
        acc.rgb += lc * (exp(-d * d / 10.0) * 0.9 + exp(-d * d / 260.0) * 0.18) * gf;
      }

      float rx = outerR(1.0);
      vec2 rr = vec2(rx, rx * TILT);
      vec2 re = (q - vec2(0.0, 1.0)) / rr;
      float rang = abs(atan(re.x, -re.y));
      float rimShow = step(abs(rang - PI * 0.5), rimDraw * PI * 0.5);
      float front = re.y < 0.0 ? 1.0 : 0.5;
      float rim = lineA(ellipseD(q, vec2(0.0, 1.0), rr) * H);
      float rimIn = lineA(ellipseD(q, vec2(0.0, 1.0), rr - vec2(WALL, WALL * TILT)) * H);
      acc.rgb += lc * (rim * 0.55 + rimIn * 0.2) * front * rimShow * gf;
    }

    acc.a = clamp(acc.a, 0.0, 1.0);
    gl_FragColor = acc;
  }
`;

const FINISH_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float uTime;
  uniform float uBlack;
  uniform vec2 uRes;
  varying vec2 vUv;
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    vec2 v = vUv - 0.5;
    v.x *= uRes.x / uRes.y;
    float vig = smoothstep(1.15, 0.25, length(v));
    c *= mix(0.5, 1.0, vig);
    float frameSeed = floor(fract(uTime * 0.37) * 512.0);
    float n = hash(gl_FragCoord.xy + vec2(frameSeed * 7.0, frameSeed * 13.0)) - 0.5;
    c += n * 0.022;
    c *= 1.0 - uBlack;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const SIMPLE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export class Stage {
  constructor(canvas, lineCount, dustCount) {
    this.lineCount = lineCount;
    this.dustCount = dustCount;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x050404, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);

    this.bg = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: BG_VERT,
        fragmentShader: BG_FRAG,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uRes: { value: new THREE.Vector2(1, 1) },
          uPr: { value: 1 },
          uCenter: { value: new THREE.Vector2() },
          uR0: { value: 80 },
          uR1: { value: 400 },
          uCore: { value: 1 },
          uTime: { value: 0 },
        },
      })
    );
    this.bg.frustumCulled = false;
    this.bg.renderOrder = -10;
    this.scene.add(this.bg);

    const lineGeo = new THREE.PlaneGeometry(1, 1);
    lineGeo.translate(0, 0.5, 0);
    this.aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(lineCount), 1);
    this.aHi = new THREE.InstancedBufferAttribute(new Float32Array(lineCount), 1);
    this.aFade = new THREE.InstancedBufferAttribute(new Float32Array(lineCount), 1);
    this.aFill = new THREE.InstancedBufferAttribute(new Float32Array(lineCount), 1);
    for (const a of [this.aAlpha, this.aHi, this.aFade, this.aFill]) a.setUsage(THREE.DynamicDrawUsage);
    lineGeo.setAttribute("aAlpha", this.aAlpha);
    lineGeo.setAttribute("aHi", this.aHi);
    lineGeo.setAttribute("aFade", this.aFade);
    lineGeo.setAttribute("aFill", this.aFill);

    this.lineMat = new THREE.ShaderMaterial({
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uLineW: { value: 1.3 },
        uColor: { value: new THREE.Color(0.93, 0.89, 0.82) },
        uHiColor: { value: new THREE.Color(1.0, 0.66, 0.3) },
        uFillMix: { value: 0 },
      },
    });
    this.lines = new THREE.InstancedMesh(lineGeo, this.lineMat, lineCount);
    this.lines.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);

    const dustGeo = new THREE.BufferGeometry();
    this.dustPos = new THREE.BufferAttribute(new Float32Array(dustCount * 3), 3);
    this.dustAlpha = new THREE.BufferAttribute(new Float32Array(dustCount), 1);
    this.dustSize = new THREE.BufferAttribute(new Float32Array(dustCount), 1);
    for (const a of [this.dustPos, this.dustAlpha, this.dustSize]) a.setUsage(THREE.DynamicDrawUsage);
    dustGeo.setAttribute("position", this.dustPos);
    dustGeo.setAttribute("aAlpha", this.dustAlpha);
    dustGeo.setAttribute("aSize", this.dustSize);
    this.dustMat = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uPr: { value: 1 } },
    });
    this.dust = new THREE.Points(dustGeo, this.dustMat);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);

    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader: SIMPLE_VERT,
        fragmentShader: FLASH_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uIntensity: { value: 0 } },
      })
    );
    this.flash.frustumCulled = false;
    this.flash.visible = false;
    this.scene.add(this.flash);

    this.liquid = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: BG_VERT,
        fragmentShader: LIQUID_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uRes: { value: new THREE.Vector2(1, 1) },
          uPr: { value: 1 },
          uTime: { value: 0 },
          uGlass: { value: new THREE.Vector3(0, 0, 1) },
          uDraw: { value: 0 },
          uLevel: { value: 0 },
          uRock: { value: 0 },
          uRipple: { value: 0 },
          uImpact: { value: 0 },
          uStream: { value: new THREE.Vector4(0, 0, 0, 0) },
          uGlint: { value: -1 },
          uFade: { value: 0 },
          uLegs: { value: 0 },
          uAngle: { value: 0 },
        },
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      })
    );
    this.liquid.frustumCulled = false;
    this.liquid.renderOrder = 10;
    this.liquid.visible = false;
    this.scene.add(this.liquid);

    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.62, 0.42, 0.16);
    this.composer.addPass(this.bloom);
    this.finish = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uBlack: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: SIMPLE_VERT,
      fragmentShader: FINISH_FRAG,
    });
    this.composer.addPass(this.finish);
  }

  resize(w, h) {
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w;
    this.h = h;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.camera.left = 0;
    this.camera.right = w;
    this.camera.top = 0;
    this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
    this.bg.material.uniforms.uRes.value.set(w, h);
    this.bg.material.uniforms.uPr.value = pr;
    this.dustMat.uniforms.uPr.value = pr;
    this.liquid.material.uniforms.uRes.value.set(w, h);
    this.liquid.material.uniforms.uPr.value = pr;
    this.finish.uniforms.uRes.value.set(w * pr, h * pr);
    this.lineMat.uniforms.uLineW.value = pr >= 2 ? 1.15 : 1.35;
  }

  /** Places line i in screen space (y down): base point, clockwise angle from 12 o'clock, length. */
  setLine(i, bx, by, angle, len, alpha, hi = 0, fade = 0, fill = 0) {
    const m = this.lines.instanceMatrix.array;
    const o = i * 16;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const l = Math.max(len, 0.0001);
    m[o] = c * QUAD_W;
    m[o + 1] = -s * QUAD_W;
    m[o + 2] = 0;
    m[o + 3] = 0;
    m[o + 4] = s * l;
    m[o + 5] = c * l;
    m[o + 6] = 0;
    m[o + 7] = 0;
    m[o + 8] = 0;
    m[o + 9] = 0;
    m[o + 10] = 1;
    m[o + 11] = 0;
    m[o + 12] = bx;
    m[o + 13] = -by;
    m[o + 14] = 0;
    m[o + 15] = 1;
    this.aAlpha.array[i] = len > 0.01 ? alpha : 0;
    this.aHi.array[i] = hi;
    this.aFade.array[i] = fade;
    this.aFill.array[i] = fill;
  }

  setFillMix(v) {
    this.lineMat.uniforms.uFillMix.value = v;
  }

  /**
   * The pour scene. Glass is placed by its foot centre (CSS px, y up from the bottom) and height in px;
   * level is the filled fraction of the bowl; stream head/tail/top are in glass-height units.
   */
  setLiquid(on, l = {}) {
    this.liquid.visible = on;
    if (!on) return;
    const u = this.liquid.material.uniforms;
    u.uGlass.value.set(l.x, l.y, l.height);
    u.uDraw.value = l.draw;
    u.uLevel.value = l.level;
    u.uRock.value = l.rock;
    u.uRipple.value = l.ripple;
    u.uImpact.value = l.impact;
    u.uStream.value.set(l.streamHead, l.streamTail, l.streamTop, l.stream ? 1 : 0);
    u.uGlint.value = l.glint;
    u.uFade.value = l.fade;
    u.uLegs.value = l.legs;
    u.uAngle.value = l.angle;
    u.uTime.value = l.time;
  }

  setBlack(v) {
    this.finish.uniforms.uBlack.value = v;
  }

  setBloomStrength(v) {
    this.bloom.strength = v;
  }

  hideLine(i) {
    this.aAlpha.array[i] = 0;
  }

  setDust(i, x, y, size, alpha) {
    this.dustPos.array[i * 3] = x;
    this.dustPos.array[i * 3 + 1] = -y;
    this.dustSize.array[i] = size;
    this.dustAlpha.array[i] = alpha;
  }

  setBackground(cx, cy, r0, r1, core, time) {
    const u = this.bg.material.uniforms;
    u.uCenter.value.set(cx, cy);
    u.uR0.value = r0;
    u.uR1.value = r1;
    u.uCore.value = core;
    u.uTime.value = time;
  }

  setFlash(x, y, size, intensity) {
    this.flash.visible = intensity > 0.002;
    this.flash.position.set(x, -y, 0);
    this.flash.scale.set(size * 2.4, size, 1);
    this.flash.material.uniforms.uIntensity.value = intensity;
  }

  render(time) {
    this.lines.instanceMatrix.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
    this.aHi.needsUpdate = true;
    this.aFade.needsUpdate = true;
    this.aFill.needsUpdate = true;
    this.dustPos.needsUpdate = true;
    this.dustAlpha.needsUpdate = true;
    this.dustSize.needsUpdate = true;
    this.finish.uniforms.uTime.value = time;
    this.composer.render();
  }
}
