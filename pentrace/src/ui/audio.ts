import type { Sound } from '../engine/events';

/** Tiny WebAudio synth: no audio files to ship. */
export class Synth {
  private ctx: AudioContext | null = null;
  enabled = true;

  private ac(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.05, slideTo?: number) {
    const ctx = this.ac();
    if (!ctx) return;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  key() {
    this.tone(1800 + Math.random() * 400, 0, 0.018, 'square', 0.008);
  }

  play(s: Sound) {
    switch (s) {
      case 'blip':
        this.tone(880, 0, 0.06, 'square', 0.03);
        break;
      case 'success':
        [523, 659, 784].forEach((f, i) => this.tone(f, i * 0.06, 0.12, 'square', 0.035));
        break;
      case 'granted':
        [392, 523, 659, 1046].forEach((f, i) => this.tone(f, i * 0.08, 0.35, 'sawtooth', 0.03));
        break;
      case 'cash':
        this.tone(1318, 0, 0.08, 'square', 0.04);
        this.tone(1760, 0.08, 0.25, 'square', 0.04);
        break;
      case 'unlock':
        [880, 1174, 1568, 2093].forEach((f, i) => this.tone(f, i * 0.05, 0.2, 'triangle', 0.04));
        break;
      case 'error':
        this.tone(140, 0, 0.18, 'sawtooth', 0.05, 90);
        break;
      case 'fanfare':
        [523, 523, 523, 523, 415, 466, 523].forEach((f, i) =>
          this.tone(f, [0, 0.11, 0.22, 0.33, 0.6, 0.78, 0.96][i], i === 6 ? 0.6 : 0.1, 'sawtooth', 0.03),
        );
        break;
      case 'tick':
        this.tone(2400, 0, 0.012, 'square', 0.012);
        break;
      case 'rankup':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, i * 0.07, 0.3, 'triangle', 0.045));
        break;
      case 'alarm':
        this.tone(660, 0, 0.25, 'sawtooth', 0.05, 330);
        this.tone(660, 0.3, 0.25, 'sawtooth', 0.05, 330);
        break;
    }
  }
}
