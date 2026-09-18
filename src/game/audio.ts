type Sfx =
  | "select"
  | "command"
  | "place"
  | "error"
  | "complete"
  | "research"
  | "boom"
  | "zap"
  | "alarm"
  | "tick";

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  ambGain: GainNode | null = null;
  windGain: GainNode | null = null;
  enabled = true;
  private lastAt: Record<string, number> = {};

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = this.enabled ? 0.5 : 0;
      master.connect(ctx.destination);
      this.master = master;

      // --- ambient drone -------------------------------------
      const amb = ctx.createGain();
      amb.gain.value = 0.1;
      amb.connect(master);
      this.ambGain = amb;
      const freqs = [55, 82.5, 110.3, 164.8];
      freqs.forEach((f, i) => {
        const o = ctx.createOscillator();
        o.type = i % 2 ? "sine" : "triangle";
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0.18 / (i + 1);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.035 + i * 0.017;
        const lg = ctx.createGain();
        lg.gain.value = 0.09 / (i + 1);
        lfo.connect(lg).connect(g.gain);
        o.connect(g).connect(amb);
        o.start();
        lfo.start();
      });

      // --- wind noise ----------------------------------------
      const len = ctx.sampleRate * 3;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 4;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filt = ctx.createBiquadFilter();
      filt.type = "bandpass";
      filt.frequency.value = 420;
      filt.Q.value = 0.7;
      const wg = ctx.createGain();
      wg.gain.value = 0.04;
      src.connect(filt).connect(wg).connect(master);
      src.start();
      this.windGain = wg;
    } catch {
      /* ignore */
    }
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v ? 0.5 : 0, this.ctx.currentTime, 0.05);
    }
  }

  setStorm(intensity: number) {
    if (!this.windGain || !this.ctx) return;
    this.windGain.gain.setTargetAtTime(0.035 + intensity * 0.22, this.ctx.currentTime, 0.6);
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(120, t + dur);
    const g = ctx.createGain();
    g.gain.value = vol;
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
  }

  play(kind: Sfx) {
    if (!this.ctx || !this.enabled) return;
    const now = performance.now();
    const gap: Record<string, number> = { tick: 90, zap: 60, boom: 45 };
    if (gap[kind] && now - (this.lastAt[kind] ?? 0) < gap[kind]) return;
    this.lastAt[kind] = now;
    switch (kind) {
      case "select":
        this.blip(880, 0.07, "square", 0.06, 220);
        break;
      case "command":
        this.blip(520, 0.09, "triangle", 0.08, -160);
        break;
      case "place":
        this.blip(320, 0.14, "sawtooth", 0.07, 260);
        break;
      case "error":
        this.blip(150, 0.18, "square", 0.07, -60);
        break;
      case "complete":
        this.blip(660, 0.1, "triangle", 0.08);
        setTimeout(() => this.blip(990, 0.16, "triangle", 0.07), 90);
        break;
      case "research":
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.14, "sine", 0.07), i * 80));
        break;
      case "boom":
        this.noise(0.5, 0.35, 900);
        break;
      case "zap":
        this.blip(1400, 0.05, "square", 0.035, -900);
        break;
      case "alarm":
        this.blip(300, 0.2, "sawtooth", 0.09);
        setTimeout(() => this.blip(230, 0.3, "sawtooth", 0.09), 200);
        break;
      case "tick":
        this.blip(1800, 0.03, "sine", 0.02, -300);
        break;
    }
  }
}

export const audio = new AudioEngine();
