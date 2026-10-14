import { Stage } from "./scene.js";
import { buildEntries, consumePool, describe, entryForBottle, pickBottle } from "./data.js";
import { Sound } from "./audio.js";

const N = 144;
const EXTRA = 8;
const DUST = 70;
const SLOTS = 12;
const TAU = Math.PI * 2;
const SLOT_ANG = TAU / SLOTS;
const PROMPT_ANGLE = 0;
const DASH = N;
const DASH_B = N + 1;
const GHOST0 = N + 2;

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const T = reduceMotion
  ? { intro: 0.6, pour: 0, spin: 1.8, settle: 0.4, collapse: 0.5, shoot: 0.45, cursor: 0.25, reveal: 1.2, leave: 0.35, drink: 2.9, dark: 1.0 }
  : { intro: 1.8, pour: 0.32, spin: 5.8, settle: 0.6, collapse: 1.25, shoot: 0.95, cursor: 0.6, reveal: 2.0, leave: 0.45, drink: 7.4, dark: 2.4 };

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => {
  const x = clamp((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const wrap = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeInOutQuart = (x) => (x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2);
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x) => x * x * x;
const easeOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

/** Normalized spin curve: quick spool-up, then a long, weighted coast to rest. */
const SPIN_LUT = (() => {
  const n = 1024;
  const out = new Float32Array(n + 1);
  let acc = 0;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    acc += (1 - Math.exp(-u * 16)) * Math.pow(1 - u, 2.3);
    out[i] = acc;
  }
  for (let i = 0; i <= n; i++) out[i] /= acc;
  return out;
})();
function spinEase(u) {
  const x = clamp(u) * 1024;
  const i = Math.floor(x);
  if (i >= 1024) return 1;
  const f = x - i;
  return SPIN_LUT[i] * (1 - f) + SPIN_LUT[i + 1] * f;
}

// ---------- DOM ----------

const $ = (id) => document.getElementById(id);
const canvas = $("gl");
const labelsEl = $("labels");
const resultEl = $("result");
const nameEl = $("rName");

const bottles = consumePool();
const entries = buildEntries(bottles);
let decoys = entries;
let previousId = null;
const stage = bottles.length ? new Stage(canvas, N + EXTRA, DUST) : null;
const sound = new Sound();

const slots = Array.from({ length: SLOTS }, () => makeLabel("slot"));
const prompt = makeLabel("slot prompt");
prompt.d.textContent = "Let the wheel decide";

function makeLabel(cls) {
  const el = document.createElement("div");
  el.className = cls;
  const d = document.createElement("span");
  d.className = "d";
  const b = document.createElement("span");
  b.className = "b";
  el.append(d, b);
  labelsEl.append(el);
  return { el, d, b, entry: null, cycle: 0 };
}

// ---------- state ----------

const theta = Float32Array.from({ length: N }, (_, i) => (i / N) * TAU);
const collapseAngles = new Float32Array(N);
const ghosts = Array.from({ length: EXTRA - 2 }, () => ({}));
const dust = Array.from({ length: DUST }, () => ({
  x: (Math.random() * 2 - 1) ** 3,
  speed: 0.04 + Math.random() * 0.1,
  off: Math.random(),
  size: 1.2 + Math.random() * 2.4,
  sway: 4 + Math.random() * 14,
  freq: 0.2 + Math.random() * 0.6,
  ph: Math.random() * TAU,
  bright: 0.3 + Math.random() * 0.7,
}));

const L = { W: 0, H: 0, cx: 0, cyBase: 0, R1: 0, r0: 0, gap: 3, labelR: 0, cyResult: 0 };
const S = {
  phase: "loading",
  t: 0,
  phi: -0.35,
  omega: 0,
  spin: null,
  winner: null,
  winSlot: 0,
  centerIdx: 0,
  shoot: null,
  lastTickIdx: 0,
  shown: false,
  pour: null,
};
const G = { cy: 0, core: 0, fan: 0, hi: 0, dust: 0, prompt: 0, labels: 0, black: 0, bloom: 0.62 };

// ---------- layout ----------

function layout() {
  if (!stage) return;
  const W = window.innerWidth;
  const H = window.innerHeight;
  L.W = W;
  L.H = H;
  L.cx = W / 2;
  L.R1 = clamp(H * 0.5, 190, Math.max(W * 0.75, 560));
  L.r0 = L.R1 * 0.2;
  L.cyBase = H + L.R1 * 0.04;
  L.labelR = L.R1 + clamp(L.R1 * 0.06, 14, 30);
  labelsEl.style.setProperty("--slot-size", `${clamp(L.R1 * 0.042, 14, 22).toFixed(1)}px`);
  stage.resize(W, H);
  if (!G.cy) G.cy = L.cyBase + L.R1 * 0.3;
  if (S.phase === "result" || S.phase === "reveal") measureResult();
}

function measureResult() {
  const rect = nameEl.getBoundingClientRect();
  const fontSize = parseFloat(getComputedStyle(nameEl).fontSize);
  const panel = resultEl.getBoundingClientRect();
  L.cyResult = clamp(panel.bottom + 44 + L.R1, L.cyBase, L.H + L.R1 * 0.7);
  return {
    targetY: rect.top + rect.height / 2,
    textW: rect.width,
    dashH: Math.min(fontSize * 0.82, rect.height * 0.9),
  };
}

// ---------- phases ----------

const BUSY = new Set(["spin", "settle", "collapse", "shoot", "cursor", "reveal", "leave", "drink", "dark"]);
const LIQUID = new Set(["drink", "dark", "enjoy"]);
const POUR_LEN = 7.4;
const POUR_AT = { start: 1.6, end: 4.6 };

function go(phase) {
  S.phase = phase;
  S.t = 0;
  document.body.classList.toggle("can-pour", phase === "idle");
  document.body.classList.toggle("busy", BUSY.has(phase));
  enter[phase]?.();
}

const enter = {
  spin() {
    if (!bottles.length) return;
    const picked = pickBottle(bottles, previousId);
    previousId = picked.id;
    S.winner = entryForBottle(bottles, picked);
    decoys = entries;

    S.winSlot = Math.floor(Math.random() * SLOTS);
    const from = S.phi;
    let to = from + TAU * (reduceMotion ? 1.6 : 4.2 + Math.random() * 0.9);
    const rem = (((to + S.winSlot * SLOT_ANG) % TAU) + TAU) % TAU;
    to += rem > 1e-6 ? TAU - rem : 0;
    S.spin = { from, to };
    S.lastTickIdx = Math.floor(from / SLOT_ANG);
    sound.press();
    navigator.vibrate?.(14);

    for (let k = 0; k < SLOTS; k++) {
      const s = slots[k];
      s.cycle = cycleOf(k, from);
      setSlot(s, randomDecoy());
    }
  },
  collapse() {
    let best = Infinity;
    for (let i = 0; i < N; i++) {
      const a = wrap(theta[i] + S.phi);
      collapseAngles[i] = a;
      if (Math.abs(a) < best) {
        best = Math.abs(a);
        S.centerIdx = i;
      }
    }
  },
  shoot() {
    fillResult(S.winner);
    resultEl.hidden = false;
    resultEl.classList.remove("show", "leaving", "interactive");
    nameEl.style.clipPath = "inset(-20% 50% -20% 50%)";
    nameEl.style.filter = "blur(4px)";
    const m = measureResult();
    S.shoot = {
      ...m,
      top0: G.cy - L.R1,
      bot0: G.cy - (L.r0 + L.gap),
    };
    for (const g of ghosts) {
      g.ox = (Math.random() * 2 - 1) * L.R1 * 0.09;
      g.frac = 0.2 + Math.random() * 0.55;
      g.len = L.R1 * (0.08 + Math.random() * 0.3);
      g.delay = Math.random() * 0.35;
      g.alpha = 0.18 + Math.random() * 0.35;
    }
    sound.whoosh(T.shoot);
  },
  reveal() {
    S.shown = false;
    sound.chime();
    navigator.vibrate?.(12);
  },
  result() {
    nameEl.style.clipPath = "none";
    nameEl.style.filter = "none";
    resultEl.classList.add("show", "interactive");
    const notes = $("rNotes");
    notes.classList.toggle("clamped", notes.scrollHeight > notes.clientHeight + 2);
  },
  leave() {
    resultEl.classList.add("leaving");
    resultEl.classList.remove("interactive");
  },
  drink() {
    resultEl.classList.add("leaving");
    resultEl.classList.remove("interactive");
    document.body.classList.add("immersive");
    const k = T.drink / POUR_LEN;
    sound.pour({ bloom: 0.35 * k, start: 1.85 * k, duration: 3.1 * k });
    navigator.vibrate?.([10, 60, 10, 60, 10]);
  },
  dark() {
    resultEl.hidden = true;
    resultEl.classList.remove("show", "leaving");
  },
  enjoy() {
    const e = S.winner;
    $("enjoySub").textContent = [e.title, e.subtitle].filter(Boolean).join(" · ");
    enjoyEl.hidden = false;
    enjoyEl.classList.remove("leaving");
    requestAnimationFrame(() => enjoyEl.classList.add("show"));
    sound.chime();
  },
};

const enjoyEl = $("enjoy");

function cycleOf(k, phi) {
  return Math.floor((phi + k * SLOT_ANG + Math.PI) / TAU);
}

function randomDecoy() {
  const list = decoys.length ? decoys : entries;
  if (list.length <= 1) return list[0];
  let e;
  do e = list[Math.floor(Math.random() * list.length)];
  while (e.key === S.winner.key);
  return e;
}

function setSlot(s, entry) {
  if (s.entry === entry) return;
  s.entry = entry;
  s.d.textContent = entry?.wheelTitle ?? "";
  s.b.textContent = entry?.wheelSub ?? "";
}

function pour() {
  if (S.phase === "result") go("leave");
}

function returnToPicker() {
  if (history.length > 1) {
    history.back();
    window.setTimeout(() => {
      if (location.pathname.includes("/fancy")) location.assign("/");
    }, 500);
  } else {
    location.assign("/");
  }
}

// ---------- per-frame ----------

const debugClock = new URLSearchParams(location.search).has("debug");
let simTime = 0;
let last = performance.now() / 1000;
function frame(nowMs) {
  requestAnimationFrame(frame);
  const now = nowMs / 1000;
  const dt = Math.min(0.05, Math.max(0.0001, now - last));
  last = now;
  if (!debugClock) step(dt);
  stage.render(simTime);
}

/** Debug hook: advance the simulation deterministically, e.g. __advance(2.5). */
if (debugClock) {
  window.__stage = stage;
  window.__advance = (seconds) => {
    for (let n = Math.round(seconds * 60); n > 0; n--) step(1 / 60);
    return S.phase;
  };
}

function step(dt) {
  simTime += dt;
  const time = simTime;
  S.t += dt;

  const prevPhi = S.phi;
  updatePhase(dt);
  S.omega = lerp(S.omega, (S.phi - prevPhi) / dt, 0.5);
  const speedN = clamp(Math.abs(S.omega) / 18);

  approachTargets(dt, speedN);
  drawLines(time, speedN);
  drawLabels(time, speedN);
  drawDust(time);
  stage.setBackground(L.cx, G.cy, L.r0, L.R1, G.core + (S.pour ? S.pour.flare * 0.9 : 0), time);
  drawLiquid(time);
  stage.setBlack(G.black);
  stage.setBloomStrength(G.bloom);
}

/** The final pour: a stream falls from the top and whisky fills the screen before the fade to black. */
function drawLiquid(time) {
  if (!LIQUID.has(S.phase)) {
    stage.setLiquid(false);
    return;
  }
  const t = (S.phase === "drink" ? S.t : T.drink) * (POUR_LEN / T.drink);
  const fade = S.phase === "drink" ? 0 : S.phase === "dark" ? clamp(S.t / (T.dark * 0.85)) : 1;
  const zoom = 1 + 0.045 * easeInOutCubic(clamp(t / POUR_LEN));
  const height = Math.min(L.H * 0.58, L.W * 1.25) * zoom;
  const y = L.H * 0.45 - height * 0.5;
  const top = (L.H - y) / height;
  const { start, end } = POUR_AT;
  const head = easeInCubic(clamp((t - start) / 0.3));
  const tail = easeInCubic(clamp((t - end) / 0.36));
  const hit = smoothstep(start + 0.25, start + 0.4, t);
  const upright = 4.8;
  const after = t - upright;
  const angle = -0.3 * (easeInOutCubic(clamp((t - 1.15) / 0.6)) - easeInOutCubic(clamp((t - 3.7) / (upright - 3.7))));
  stage.setLiquid(true, {
    x: L.W / 2,
    y,
    height,
    draw: easeInOutCubic(clamp((t - 0.2) / 1.25)),
    level: 0.36 * (1 - Math.pow(1 - clamp((t - start - 0.28) / (end - start)), 1.7)),
    angle,
    rock: 0.03 * Math.sin(t * 4.1) * hit + (after > 0 ? -0.12 * Math.sin(after * 6.5) * Math.exp(-after * 1.4) : 0),
    ripple: hit * (after > 0 ? Math.exp(-after * 1.6) : 1),
    impact: hit * (1 - smoothstep(end + 0.3, end + 0.5, t)),
    stream: t >= start && tail < 1,
    streamHead: top - (top - 0.2) * head,
    streamTail: top - (top - 0.2) * tail,
    streamTop: top,
    glint: t > 5.6 ? (t - 5.6) / 1.0 : -1,
    legs: Math.max(0, t - 5.1) * 0.5,
    fade,
    time,
  });
}

function updatePhase(dt) {
  const t = S.t;
  switch (S.phase) {
    case "intro":
    case "idle":
    case "result":
      S.phi += dt * 0.028;
      if (S.phase === "intro" && t >= T.intro) go("spin");
      break;
    case "spin": {
      const { from, to } = S.spin;
      const st = spinTime();
      const u = clamp(st / T.spin);
      const windup = reduceMotion ? 0 : 0.08 * Math.sin(Math.PI * clamp(st / 0.55));
      S.phi = from + (to - from) * spinEase(u) - windup;
      const idx = Math.floor(S.phi / SLOT_ANG);
      if (idx !== S.lastTickIdx) {
        const speed = clamp(Math.abs(S.omega) / 18);
        sound.tick(1 - speed * 0.6);
        if (speed < 0.25) navigator.vibrate?.(3);
        S.lastTickIdx = idx;
      }
      for (let k = 0; k < SLOTS; k++) {
        const c = cycleOf(k, S.phi);
        if (c !== slots[k].cycle) {
          slots[k].cycle = c;
          setSlot(slots[k], randomDecoy());
        }
      }
      if (u >= 1) {
        S.phi = to;
        go("settle");
      }
      break;
    }
    case "settle":
      if (t >= T.settle) go("collapse");
      break;
    case "collapse":
      if (t >= T.collapse) go("shoot");
      break;
    case "shoot":
      if (t >= T.shoot) go("cursor");
      break;
    case "cursor":
      if (t >= T.cursor) go("reveal");
      break;
    case "reveal":
      S.phi += dt * 0.028;
      if (t >= T.reveal) go("result");
      break;
    case "drink":
      S.phi += dt * 0.028;
      if (t >= T.drink) go("dark");
      break;
    case "dark":
      if (t >= T.dark) go("enjoy");
      break;
    case "leave":
      S.phi += dt * 0.028;
      if (t >= T.leave) {
        resultEl.hidden = true;
        resultEl.classList.remove("show", "leaving");
        refreshCounts();
        go("spin");
      }
      break;
  }
}

function approachTargets(dt, speedN) {
  const p = S.phase;
  const tgt = {
    cy: L.cyBase,
    core: 1,
    fan: 0.9,
    hi: 0,
    dust: 1,
    prompt: 0,
    labels: 0,
    black: 0,
    bloom: 0.62,
  };
  if (p === "loading") Object.assign(tgt, { core: 0, fan: 0, dust: 0 });
  if (p === "idle") tgt.prompt = 1;
  if (p === "spin") {
    const labels = 1 - smoothstep(0.66, 0.86, spinTime() / T.spin);
    Object.assign(tgt, { core: 1 + speedN * 0.45, fan: 1, labels, hi: 0.9 });
  }
  if (p === "settle") Object.assign(tgt, { core: 1.15, fan: 1, hi: 1 });
  if (p === "collapse") Object.assign(tgt, { core: 1.1, fan: 1, labels: 0, hi: 1 });
  if (p === "shoot" || p === "cursor") Object.assign(tgt, { cy: L.cyResult, core: 0.4, dust: 0.35 });
  if (p === "reveal") Object.assign(tgt, { cy: L.cyResult, core: 0.85, fan: 0.6, dust: 0.8 });
  if (p === "result") Object.assign(tgt, { cy: L.cyResult, core: 0.85, fan: 0.6, dust: 0.8 });
  if (p === "leave") Object.assign(tgt, { fan: 1 });
  if (LIQUID.has(p)) Object.assign(tgt, { cy: L.cyResult, core: 0.25, fan: 0, dust: 0.45, bloom: 0.24 });
  if (p === "dark" || p === "enjoy") tgt.black = 1;

  const rates = {
    cy: 2.6,
    core: 3,
    fan: 3,
    hi: 5,
    dust: 1.5,
    prompt: p === "idle" ? 1.6 : 6,
    labels: 4,
    black: p === "dark" ? 1.1 : 1.5,
    bloom: 2,
  };
  for (const k in tgt) G[k] = lerp(G[k], tgt[k], 1 - Math.exp(-dt * rates[k]));
}

/** Seconds of actual rotation; the spin phase opens with the pour before the wheel moves. */
function spinTime() {
  return Math.max(0, S.t - T.pour);
}

/** The opening "pour": a press-and-spring of the wheel, a core flare, and amber rising up each line. */
function pourCurve(t) {
  if (reduceMotion) return { press: 1, flare: 0, fillMix: 1 - smoothstep(0.3, 0.9, t), level: () => 1 };
  const x = t - 0.12;
  const press = t < 0.12 ? 1 - 0.06 * easeOutCubic(t / 0.12) : 1 - 0.06 * Math.cos(x * 15) * Math.exp(-x * 6);
  return {
    press,
    flare: smoothstep(0, 0.06, t) * Math.exp(-t * 3),
    fillMix: 1 - smoothstep(0.9, 1.8, t),
    level: (a) => easeOutCubic(clamp((t - 0.08 - Math.abs(a) * 0.12) / 0.7)),
  };
}

function drawLines(time, speedN) {
  const p = S.phase;
  for (let i = N; i < N + EXTRA; i++) stage.hideLine(i);
  S.pour = p === "spin" ? pourCurve(S.t) : null;
  stage.setFillMix(S.pour ? S.pour.fillMix : 0);

  if (p === "collapse") return drawCollapse();
  if (p === "shoot") return drawShoot();
  if (p === "cursor") return drawCursor();

  let grow = null;
  if (p === "loading") grow = () => 0;
  if (p === "intro") grow = (a) => easeOutCubic(clamp((S.t - Math.abs(a) * 0.28) / 1.1));
  if (p === "reveal") {
    grow = (a) => easeOutCubic(clamp((S.t - 0.3 - Math.abs(a) * 0.25) / 1.2));
    drawSplit();
  }
  drawFan(time, speedN, grow);
}

function drawFan(time, speedN, grow) {
  const { cx, r0, R1, gap } = L;
  const cy = G.cy;
  const start = r0 + gap;
  const pour = S.pour;
  for (let i = 0; i < N; i++) {
    const a = wrap(theta[i] + S.phi);
    const g = grow ? grow(a) : 1;
    if (g <= 0) {
      stage.hideLine(i);
      continue;
    }
    const len = (R1 - start) * g * (pour ? pour.press : 1);
    const hi = G.hi * Math.max(0, 1 - Math.abs(a) / 0.03);
    const alpha = G.fan * Math.min(1, g * 1.6) * (1 + hi * 0.4) * (pour ? 1 + pour.flare * 0.5 : 1);
    const fill = pour ? pour.level(a) : 0;
    stage.setLine(i, cx + Math.sin(a) * start, cy - Math.cos(a) * start, a, len, alpha, hi, 0.35, fill);
  }
}

function drawCollapse() {
  const { cx, r0, R1, gap } = L;
  const cy = G.cy;
  const start = r0 + gap;
  const p = easeInOutCubic(clamp(S.t / T.collapse));
  for (let i = 0; i < N; i++) {
    const a0 = collapseAngles[i];
    const bell = Math.exp(-((a0 / 0.85) ** 2));
    const a = a0 * (1 - p);
    const center = i === S.centerIdx;
    const lenF = center ? 1 : lerp(1, 0.16 + 0.8 * bell, p);
    const alpha = center ? 1.25 : G.fan * lerp(1, 0.3 + 0.7 * bell, p) * (1 - smoothstep(0.55, 0.97, p));
    stage.setLine(i, cx + Math.sin(a) * start, cy - Math.cos(a) * start, a, (R1 - start) * lenF, alpha, center ? 1 : 0, 0.35);
  }
}

function drawShoot() {
  for (let i = 0; i < N; i++) stage.hideLine(i);
  const sh = S.shoot;
  const u = clamp(S.t / T.shoot);
  const topT = sh.targetY - sh.dashH / 2;
  const botT = sh.targetY + sh.dashH / 2;
  const top = lerp(sh.top0, topT, easeInOutCubic(clamp(u / 0.82)));
  const bot = lerp(sh.bot0, botT, easeInOutQuart(clamp((u - 0.12) / 0.88)));
  const fade = 0.9 * Math.sin(Math.PI * u);
  stage.setLine(DASH, L.cx, bot, 0, Math.max(bot - top, 1), 1.3, lerp(1, 0.15, u), fade);

  ghosts.forEach((g, j) => {
    const k = clamp((u - g.delay) / (1 - g.delay));
    if (k <= 0) return;
    const travel = easeOutCubic(k) * g.frac;
    const tip = lerp(sh.bot0 - g.len * 0.3, sh.targetY, travel);
    const len = g.len * (1 - 0.6 * k);
    const x = L.cx + g.ox * (1 - 0.5 * k);
    stage.setLine(GHOST0 + j, x, tip + len, g.ox * 0.0009, len, g.alpha * Math.sin(Math.PI * k), 0, 0.8);
  });
}

function drawCursor() {
  for (let i = 0; i < N; i++) stage.hideLine(i);
  const sh = S.shoot;
  const u = clamp(S.t / T.cursor);
  const alpha = 1.25 * (1 - 0.85 * Math.sin(Math.PI * u) ** 2);
  stage.setLine(DASH, L.cx, sh.targetY + sh.dashH / 2, 0, sh.dashH, alpha, 0.15, 0);
}

function drawSplit() {
  const sh = S.shoot;
  const t = S.t;
  const e = easeOutExpo(clamp(t / 1.0));
  const half = (sh.textW / 2 + 14) * e;
  const alpha = 1.2 * (1 - smoothstep(0.4, 1.25, t));
  const h = sh.dashH * lerp(1, 0.7, e);
  if (alpha > 0.001) {
    stage.setLine(DASH, L.cx - half, sh.targetY + h / 2, 0, h, alpha, 0, 0);
    stage.setLine(DASH_B, L.cx + half, sh.targetY + h / 2, 0, h, alpha, 0, 0);
  }
  const q = (50 * (1 - e)).toFixed(3);
  nameEl.style.clipPath = `inset(-20% ${q}% -20% ${q}%)`;
  nameEl.style.filter = e > 0.98 ? "none" : `blur(${(4 * (1 - e)).toFixed(2)}px)`;
  stage.setFlash(L.cx, sh.targetY, sh.dashH * 3.2, 0.85 * Math.exp(-t * 3.2));
  if (!S.shown && t > 0.45) {
    S.shown = true;
    resultEl.classList.add("show");
  }
}

function drawLabels(time, speedN) {
  const { cx, labelR } = L;
  const cy = G.cy;
  const blur = Math.min(3.5, Math.abs(S.omega) * labelR * 0.00045);

  if (G.labels > 0.003) {
    const dissolve = 1 - G.labels;
    for (let k = 0; k < SLOTS; k++) {
      const s = slots[k];
      const a = wrap(S.phi + k * SLOT_ANG);
      const vis = Math.pow(clamp((Math.cos(a) - 0.3) / 0.7), 1.6);
      const nearTop = Math.max(0, 1 - Math.abs(a) / (SLOT_ANG * 0.6));
      const o = G.labels * vis * (0.5 + 0.5 * nearTop) * (1 - speedN * 0.4);
      placeLabel(s.el, cx, cy, a, labelR + dissolve * 22, o, blur + dissolve * 6);
    }
  } else if (slots[0].el.style.opacity !== "0") {
    for (const s of slots) s.el.style.opacity = "0";
  }

  if (G.prompt > 0.003) {
    const drift = S.spin && S.phase !== "idle" ? S.phi - S.spin.from : 0;
    const a = PROMPT_ANGLE + drift;
    const pulse = 0.82 + 0.18 * Math.sin(time * 1.6);
    placeLabel(prompt.el, cx, cy, a, labelR + 8, G.prompt * pulse, 0);
  } else if (prompt.el.style.opacity !== "0") {
    prompt.el.style.opacity = "0";
  }
}

function placeLabel(el, cx, cy, a, r, opacity, blur) {
  el.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px) rotate(${a.toFixed(4)}rad) translate(-50%, calc(-100% - ${r.toFixed(1)}px))`;
  el.style.opacity = opacity.toFixed(3);
  el.style.filter = blur > 0.08 ? `blur(${blur.toFixed(2)}px)` : "none";
}

function drawDust(time) {
  const { cx, R1, r0 } = L;
  const cy = G.cy;
  const span = R1 * 1.25;
  dust.forEach((d, i) => {
    const f = (time * d.speed + d.off) % 1;
    const y = cy - r0 * 0.6 - f * span;
    const x = cx + d.x * R1 * 1.1 + Math.sin(time * d.freq + d.ph) * d.sway;
    const flicker = 0.75 + 0.25 * Math.sin(time * 3 * d.freq + d.ph * 3);
    const a = G.dust * 0.55 * d.bright * Math.sin(Math.PI * f) * flicker;
    stage.setDust(i, x, y, d.size, a);
  });
}

// ---------- result content ----------

function fillResult(entry) {
  const info = describe(entry);
  $("rEyebrow").textContent = info.eyebrow;
  nameEl.textContent = info.title;
  $("rBottling").textContent = info.subtitle;
  $("rMeta").innerHTML = info.meta.map(escape).join('<span class="dot">·</span>');
  $("rTheme").textContent = info.theme;
  $("rNotes").textContent = info.notes;
  $("rNotes").classList.remove("clamped", "expanded");
  $("rFlavors").innerHTML = info.flavors.map((f) => `<li>${escape(f)}</li>`).join("");
  $("rFind").innerHTML = info.find;
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function refreshCounts() {
  const n = bottles.length;
  $("count").textContent = n ? `${n} ${n === 1 ? "bottle" : "bottles"} in the wheel` : "";
}

// ---------- wiring ----------

canvas.addEventListener("pointerup", () => {
  if (S.phase === "enjoy") returnToPicker();
  else pour();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") returnToPicker();
  if ((e.key === " " || e.key === "Enter") && !e.target.closest?.("button, input, select")) {
    e.preventDefault();
    if (S.phase === "enjoy") returnToPicker();
    else pour();
  }
});
document.querySelectorAll("[data-back], #back").forEach((button) => button.addEventListener("click", returnToPicker));
window.addEventListener("pointerdown", () => sound.unlock(), { once: true });
$("rNotes").addEventListener("click", (e) => {
  const notes = e.currentTarget;
  if (!notes.classList.contains("clamped")) return;
  notes.classList.replace("clamped", "expanded");
  measureResult();
});
$("again").addEventListener("click", () => pour());
$("drink").addEventListener("click", () => {
  if (S.phase !== "result") return;
  sound.unlock();
  go("drink");
});
enjoyEl.addEventListener("click", returnToPicker);
window.addEventListener("resize", layout);

if (!bottles.length) {
  $("empty").hidden = false;
  labelsEl.hidden = true;
  canvas.hidden = true;
} else {
  refreshCounts();
  layout();
  G.cy = L.cyBase;
  go("intro");
  requestAnimationFrame(frame);
}
