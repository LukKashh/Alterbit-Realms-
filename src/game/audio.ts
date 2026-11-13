class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume = 0.08
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const pitchJitter = 0.94 + Math.random() * 0.12;
    osc.type = type;
    osc.frequency.setValueAtTime(freq * pitchJitter, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq * pitchJitter), now + duration);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  jump() {
    this.playTone(230, 440, 0.11, 'square', 0.05);
  }

  land() {
    this.playTone(130, 65, 0.06, 'triangle', 0.06);
  }

  punch() {
    this.playTone(180, 90, 0.07, 'triangle', 0.07);
  }

  breakBlock() {
    this.playTone(280, 95, 0.12, 'sawtooth', 0.06);
  }

  placeBlock() {
    this.playTone(320, 420, 0.07, 'triangle', 0.06);
  }

  pickup() {
    this.playTone(520, 820, 0.09, 'sine', 0.06);
  }

  gem() {
    this.playTone(760, 1180, 0.14, 'sine', 0.07);
  }

  plant() {
    this.playTone(380, 560, 0.08, 'sine', 0.05);
  }

  uiClick() {
    this.playTone(460, 520, 0.04, 'sine', 0.04);
  }
}

export const soundEngine = new SoundEngine();
