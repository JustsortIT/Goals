/**
 * The sounds of the game, made in code with the browser's own audio (nothing to download, and
 * no library). A kiosk can silence the venue (`KioskState.sound`), so every sound asks
 * `enabled` first. Browsers keep audio shut until the page has been touched, so the context is
 * made, and woken, on the first touch. No Phaser imports.
 */

export type Sound =
  'kick' | 'net' | 'pop' | 'hit' | 'bonus' | 'miss' | 'clear' | 'win' | 'over' | 'click';

const MASTER = 0.5;

class Sfx {
  /** False when the venue has been silenced: nothing is played. */
  enabled = true;

  private context: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private master: GainNode | null = null;
  private crowd: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  /** Makes the audio context, or wakes it. Called by anything the player does with a finger. */
  unlock(): void {
    if (typeof AudioContext === 'undefined') return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = MASTER;
      this.master.connect(this.context.destination);
      this.noise = this.makeNoise(this.context);
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  play(sound: Sound): void {
    const context = this.ready();
    if (!context) return;
    const now = context.currentTime;
    switch (sound) {
      case 'kick':
        // A boot on a ball: a low thump with a short slap on top.
        this.tone(now, 'sine', 150, 48, 0.14, 0.9);
        this.burst(now, 0.05, 900, 'lowpass', 0.5);
        // The ball going away through the air.
        this.burst(now + 0.04, 0.45, 1400, 'bandpass', 0.07);
        break;
      case 'pop':
        // A target breaking up.
        this.tone(now, 'sawtooth', 420, 70, 0.2, 0.3);
        this.burst(now, 0.2, 2400, 'bandpass', 0.45);
        this.burst(now + 0.03, 0.12, 5000, 'highpass', 0.2);
        break;
      case 'net':
        // A ball in a net: a soft thud and the rustle of the mesh.
        this.tone(now, 'sine', 110, 60, 0.12, 0.5);
        this.burst(now, 0.22, 1800, 'bandpass', 0.22);
        break;
      case 'hit':
        this.tone(now, 'sine', 880, 880, 0.3, 0.35);
        this.tone(now + 0.04, 'sine', 1320, 1320, 0.3, 0.25);
        this.burst(now, 0.04, 3000, 'highpass', 0.15);
        break;
      case 'bonus':
        [523, 659, 784, 1047, 1319].forEach((hertz, step) => {
          this.tone(now + step * 0.07, 'triangle', hertz, hertz, 0.22, 0.35);
        });
        this.cheer(now + 0.2, 0.7, 0.4);
        break;
      case 'miss':
        this.tone(now, 'triangle', 240, 110, 0.35, 0.4);
        this.burst(now, 0.12, 500, 'lowpass', 0.2);
        break;
      case 'clear':
        [523, 659, 784].forEach((hertz, step) => {
          this.tone(now + step * 0.1, 'triangle', hertz, hertz, 0.4, 0.3);
        });
        this.cheer(now, 1.3, 0.8);
        break;
      case 'win':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((hertz, step) => {
          this.tone(now + step * 0.12, 'triangle', hertz, hertz, 0.35, 0.35);
        });
        this.cheer(now, 2.4, 1);
        break;
      case 'over':
        [392, 330, 262].forEach((hertz, step) => {
          this.tone(now + step * 0.2, 'triangle', hertz, hertz * 0.97, 0.4, 0.35);
        });
        break;
      case 'click':
        this.tone(now, 'square', 700, 500, 0.05, 0.12);
        break;
    }
  }

  /** A low murmur of people, for as long as a play lasts. */
  ambience(on: boolean): void {
    const context = this.ready(on);
    if (!context || !this.master || !this.noise) return;
    if (!on) {
      this.stopCrowd();
      return;
    }
    if (this.crowd) return;
    const source = context.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.4;
    const gain = context.createGain();
    gain.gain.value = 0.05;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    this.crowd = { source, gain };
  }

  /** Quietens or restores the murmur when the venue is silenced part way through a play. */
  refresh(): void {
    if (!this.enabled) this.stopCrowd();
  }

  private stopCrowd(): void {
    this.crowd?.source.stop();
    this.crowd = null;
  }

  private ready(starting = true): AudioContext | null {
    if (!this.enabled && starting) return null;
    return this.context && this.context.state !== 'closed' ? this.context : null;
  }

  private makeNoise(context: AudioContext): AudioBuffer {
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    return buffer;
  }

  /** One note: it slides from `from` to `to` Hz, and dies away over `length` seconds. */
  private tone(
    start: number,
    type: OscillatorType,
    from: number,
    to: number,
    length: number,
    volume: number,
  ): void {
    const { context, master } = this;
    if (!context || !master) return;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + length);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + length);
    oscillator.connect(gain).connect(master);
    oscillator.start(start);
    oscillator.stop(start + length + 0.02);
  }

  /** A short burst of noise through a filter: a slap, a click. */
  private burst(
    start: number,
    length: number,
    hertz: number,
    type: BiquadFilterType,
    volume: number,
  ): void {
    const { context, master, noise } = this;
    if (!context || !master || !noise) return;
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = hertz;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + length);
    source.connect(filter).connect(gain).connect(master);
    source.start(start, Math.random());
    source.stop(start + length + 0.02);
  }

  /** The crowd roaring: noise that swells and fades, with the voices in the middle of it. */
  private cheer(start: number, length: number, volume: number): void {
    const { context, master, noise } = this;
    if (!context || !master || !noise) return;
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700, start);
    filter.frequency.linearRampToValueAtTime(1500, start + length * 0.4);
    filter.Q.value = 0.7;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.35 * volume, start + length * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, start + length);
    source.connect(filter).connect(gain).connect(master);
    source.start(start, Math.random());
    source.stop(start + length + 0.05);
  }
}

export const sfx = new Sfx();

// The first touch wakes the sound: browsers do not allow any before one.
if (typeof window !== 'undefined') {
  for (const event of ['pointerdown', 'touchend', 'keydown']) {
    window.addEventListener(event, () => sfx.unlock(), { passive: true });
  }
}
