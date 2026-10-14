export class Sound {
  constructor() {
    this.context = null;
    this.lastTick = 0;
  }

  unlock() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") void this.context.resume();
  }

  tone(frequency, duration, gain = 0.05, type = "sine", delay = 0) {
    if (!this.context) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  tick(intensity = 1) {
    if (!this.context || this.context.currentTime - this.lastTick < 0.04) return;
    this.lastTick = this.context.currentTime;
    this.tone(1500, 0.045, 0.035 * intensity, "triangle");
  }

  release() {
    this.tone(90, 0.32, 0.16);
    this.tone(820, 0.08, 0.045, "triangle");
  }

  chime() {
    this.tone(1046.5, 1.5, 0.1);
    this.tone(2098, 0.8, 0.035, "sine", 0.015);
    this.tone(130.8, 1.8, 0.08);
  }

  pour() {
    this.tone(146.8, 2.8, 0.1, "triangle");
    this.tone(220, 2.5, 0.06, "sine", 0.12);
    [0.5, 0.85, 1.25, 1.75].forEach((delay, index) => {
      this.tone([330, 440, 587, 740][index], 0.65, 0.025, "sine", delay);
    });
  }
}
