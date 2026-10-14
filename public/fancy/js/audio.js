/** Small synthesized sound palette: wheel ticks, a whoosh, and a glass chime. */
export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.lastTick = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  get ready() {
    return this.enabled && this.ctx && this.ctx.state !== "closed";
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 1.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  tick(intensity = 1) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    if (t - this.lastTick < 0.028) return;
    this.lastTick = t;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 700;
    o.type = "triangle";
    o.frequency.setValueAtTime(2600, t);
    o.frequency.exponentialRampToValueAtTime(1100, t + 0.025);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09 * intensity + 0.0002, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.06);
  }

  /** A soft, weighty latch-release click for the moment the wheel is set free. */
  press() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(150, t);
    thump.frequency.exponentialRampToValueAtTime(62, t + 0.16);
    thumpGain.gain.setValueAtTime(0.0001, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.28, t + 0.006);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    thump.connect(thumpGain).connect(this.master);
    thump.start(t);
    thump.stop(t + 0.24);

    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = "triangle";
    click.frequency.setValueAtTime(1800, t);
    click.frequency.exponentialRampToValueAtTime(700, t + 0.02);
    clickGain.gain.setValueAtTime(0.0001, t);
    clickGain.gain.exponentialRampToValueAtTime(0.07, t + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    click.connect(clickGain).connect(this.master);
    click.start(t);
    click.stop(t + 0.05);
  }

  /** Dry path plus a small, warm room reverb; everything in the pour scene runs through it. */
  room() {
    if (this.roomIn) return this.roomIn;
    const ctx = this.ctx;
    this.roomIn = ctx.createGain();
    const warm = ctx.createBiquadFilter();
    warm.type = "lowpass";
    warm.frequency.value = 4800;
    const verb = ctx.createConvolver();
    verb.buffer = this.makeRoom(1.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.26;
    this.roomIn.connect(warm).connect(this.master);
    this.roomIn.connect(verb).connect(wet).connect(this.master);
    return this.roomIn;
  }

  makeRoom(seconds) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        lp += 0.3 * (Math.random() * 2 - 1 - lp);
        d[i] = lp * Math.pow(1 - i / len, 3.4) * Math.min(1, i / (rate * 0.006));
      }
    }
    return buf;
  }

  /** A soft sine voice with a quick attack and an exponential tail. */
  note(out, at, f, { gain = 0.05, attack = 0.006, decay = 0.6, pan = 0, type = "sine" } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    let node = o.connect(g);
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(out);
    o.start(at);
    o.stop(at + attack + decay + 0.05);
  }

  /** A deep, gentle swell for the glass appearing. */
  bloom(out, at) {
    this.note(out, at, 73.4, { gain: 0.16, attack: 0.08, decay: 1.6 });
    this.note(out, at, 146.8, { gain: 0.07, attack: 0.06, decay: 1.3 });
    this.note(out, at + 0.01, 587.3, { gain: 0.018, attack: 0.01, decay: 1.1 });
  }

  /**
   * An abstract pour, timed in seconds from now: a warm two-note pad that swells and opens as the glass
   * fills, a tone gliding up an octave beneath it, and soft pentatonic droplets, slowing to a few at the end.
   */
  pour({ bloom = null, start = 0.4, duration = 3 } = {}) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this.room();
    if (bloom != null) this.bloom(out, now + bloom);
    const t0 = now + start;
    const t1 = t0 + duration;
    const rnd = (a, b) => a + Math.random() * (b - a);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(260, t0);
    lp.frequency.exponentialRampToValueAtTime(1200, t1);
    lp.frequency.exponentialRampToValueAtTime(300, t1 + 1.6);
    const pad = ctx.createGain();
    pad.gain.setValueAtTime(0.0001, t0);
    pad.gain.exponentialRampToValueAtTime(0.11, t0 + 0.7);
    pad.gain.setValueAtTime(0.11, t1 - 0.2);
    pad.gain.exponentialRampToValueAtTime(0.0001, t1 + 1.8);
    lp.connect(pad).connect(out);
    const voices = [
      [146.83, "triangle", 1],
      [147.4, "triangle", 0.8],
      [220.0, "sine", 0.7],
      [293.66, "sine", 0.35],
    ];
    for (const [f, type, level] of voices) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.value = level;
      const vib = ctx.createOscillator();
      const vibDepth = ctx.createGain();
      vib.frequency.value = rnd(0.18, 0.35);
      vibDepth.gain.value = f * 0.003;
      vib.connect(vibDepth).connect(o.frequency);
      o.connect(g).connect(lp);
      o.start(t0);
      vib.start(t0);
      o.stop(t1 + 1.9);
      vib.stop(t1 + 1.9);
    }

    const rise = ctx.createOscillator();
    const rg = ctx.createGain();
    rise.type = "sine";
    rise.frequency.setValueAtTime(220, t0);
    rise.frequency.exponentialRampToValueAtTime(440, t1);
    rg.gain.setValueAtTime(0.0001, t0);
    rg.gain.exponentialRampToValueAtTime(0.035, t0 + 0.9);
    rg.gain.setValueAtTime(0.035, t1 - 0.3);
    rg.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.9);
    rise.connect(rg).connect(out);
    rise.start(t0);
    rise.stop(t1 + 1);

    const scale = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99, 880.0];
    let last = -1;
    for (let x = t0 + 0.15; x < t1 - 0.1; x += rnd(0.14, 0.34)) {
      const fill = (x - t0) / duration;
      const lo = Math.floor(fill * 3);
      let i;
      do i = lo + Math.floor(Math.random() * 5);
      while (i === last);
      last = i;
      this.note(out, x, scale[Math.min(i, scale.length - 1)], {
        gain: rnd(0.018, 0.034),
        attack: 0.01,
        decay: rnd(0.5, 0.9),
        pan: rnd(-0.45, 0.45),
      });
    }
    [0.35, 0.85, 1.55].forEach((d, k) =>
      this.note(out, t1 + d, scale[6 - k * 2], { gain: 0.03 - k * 0.006, attack: 0.012, decay: 1.2, pan: rnd(-0.2, 0.2) })
    );
  }

  whoosh(duration = 0.9) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(220, t);
    bp.frequency.exponentialRampToValueAtTime(3200, t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + duration * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.12);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.2);
  }

  chime() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const base = 1046.5;
    const partials = [
      [1, 0.16, 2.6],
      [2.01, 0.06, 1.8],
      [2.76, 0.07, 1.4],
      [5.4, 0.025, 0.7],
    ];
    for (const [ratio, gain, decay] of partials) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = base * ratio;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
    const low = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    low.type = "sine";
    low.frequency.value = 130.8;
    lg.gain.setValueAtTime(0.0001, t);
    lg.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
    lg.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    low.connect(lg).connect(this.master);
    low.start(t);
    low.stop(t + 2.5);
  }
}
