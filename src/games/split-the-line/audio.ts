/**
 * The sounds of the game, made in code with the browser's own audio (nothing to download, and
 * no library). A kiosk can silence the venue (`KioskState.sound`), so every sound asks
 * `enabled` first. Browsers keep audio shut until the page has been touched, so the context is
 * made, and woken, on the first touch. No Phaser imports.
 */

export type Sound =
  | 'click'
  | 'split'
  | 'close'
  | 'miss'
  | 'spill'
  | 'slide'
  | 'clear'
  | 'win'
  | 'over'
  | 'throw'
  | 'stick'
  | 'bull'
  | 'clink'
  | 'buzz'
  | 'arrive';

const MASTER = 0.5;

class Sfx {
  /** False when the venue has been silenced: nothing is played. */
  enabled = true;

  private context: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private master: GainNode | null = null;
  private crowd: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private pouring: {
    source: AudioBufferSourceNode;
    gain: GainNode;
    filter: BiquadFilterNode;
  } | null = null;

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
      case 'click':
        this.tone(now, 'square', 700, 500, 0.05, 0.12);
        break;
      case 'split':
        // The best a pour can be: a ring of glass, a rising run, and the bar cheering.
        [659, 880, 1175, 1568].forEach((hertz, step) => {
          this.tone(now + step * 0.07, 'triangle', hertz, hertz, 0.3, 0.32);
        });
        this.tone(now + 0.3, 'sine', 2093, 2093, 0.6, 0.18);
        this.cheer(now + 0.1, 1.3, 0.9);
        break;
      case 'close':
        this.tone(now, 'triangle', 660, 660, 0.2, 0.3);
        this.tone(now + 0.09, 'triangle', 880, 880, 0.3, 0.3);
        this.cheer(now + 0.1, 0.7, 0.35);
        break;
      case 'miss':
        this.tone(now, 'triangle', 240, 110, 0.4, 0.4);
        this.burst(now, 0.14, 500, 'lowpass', 0.2);
        break;
      case 'spill':
        // Stout over the rim and onto the bar.
        this.burst(now, 0.7, 1400, 'bandpass', 0.5);
        this.burst(now + 0.1, 0.5, 600, 'lowpass', 0.4);
        this.tone(now, 'triangle', 200, 90, 0.4, 0.25);
        break;
      case 'throw':
        // A dart through the air.
        this.burst(now, 0.16, 2600, 'highpass', 0.12);
        break;
      case 'stick':
        // A dart in cork: a short knock.
        this.tone(now, 'triangle', 220, 90, 0.08, 0.55);
        this.burst(now, 0.05, 1500, 'bandpass', 0.3);
        break;
      case 'bull':
        // The bull: a bell and the bar shouting.
        [880, 1318, 1760].forEach((hertz, step) => {
          this.tone(now + step * 0.06, 'sine', hertz, hertz, 0.7, 0.3);
        });
        this.cheer(now, 1.1, 0.7);
        break;
      case 'clink':
        // A glass set down and a coin in the till.
        this.tone(now, 'sine', 2093, 2093, 0.22, 0.28);
        this.tone(now + 0.04, 'sine', 3136, 3136, 0.18, 0.18);
        break;
      case 'buzz':
        this.tone(now, 'sawtooth', 130, 100, 0.22, 0.3);
        break;
      case 'arrive':
        // Someone comes up to the bar.
        this.tone(now, 'sine', 520, 640, 0.07, 0.12);
        break;
      case 'slide':
        // A glass pushed along the bar.
        this.burst(now, 0.38, 900, 'bandpass', 0.18);
        break;
      case 'clear':
        [523, 659, 784].forEach((hertz, step) => {
          this.tone(now + step * 0.1, 'triangle', hertz, hertz, 0.4, 0.3);
        });
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
    }
  }

  /**
   * The sound of the pour, as loud as the tap is open: `level` is how fast it is running, from 0
   * (shut, which stops it) up to 1. Call it every frame while pouring.
   */
  pour(level: number): void {
    const context = this.ready(level > 0);
    if (!context || !this.master || !this.noise) return;
    if (level <= 0.01) {
      this.stopPour();
      return;
    }
    if (!this.pouring) {
      const source = context.createBufferSource();
      source.buffer = this.noise;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 0.8;
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(this.master);
      source.start();
      this.pouring = { source, gain, filter };
    }
    const now = context.currentTime;
    // A heavier pour is louder and a little lower.
    this.pouring.gain.gain.setTargetAtTime(0.32 * Math.min(1, level), now, 0.04);
    this.pouring.filter.frequency.setTargetAtTime(2600 - 900 * Math.min(1, level), now, 0.05);
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
    gain.gain.value = 0.06;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    this.crowd = { source, gain };
  }

  /** Quietens everything when the venue is silenced part way through a play. */
  refresh(): void {
    if (!this.enabled) {
      this.stopCrowd();
      this.stopPour();
    }
  }

  private stopCrowd(): void {
    this.crowd?.source.stop();
    this.crowd = null;
  }

  private stopPour(): void {
    this.pouring?.source.stop();
    this.pouring = null;
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

  /** A short burst of noise through a filter: a splash, a slide. */
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

  /** The bar roaring: noise that swells and fades, with the voices in the middle of it. */
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
