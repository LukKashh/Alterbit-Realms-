import { getItemDef, ITEM_IDS } from './catalog.ts';

export type SoundMaterial =
  | 'dirt'
  | 'wood'
  | 'stone'
  | 'glass'
  | 'metal'
  | 'foliage'
  | 'fluid';

export function getMaterialForItem(itemId?: number): SoundMaterial {
  if (!itemId || itemId === ITEM_IDS.AIR || itemId === ITEM_IDS.BG_SKY) {
    return 'dirt';
  }
  const def = getItemDef(itemId);
  if (!def) return 'stone';

  if (def.category === 'fluid' || def.fluidKind) {
    return 'fluid';
  }
  if (def.category === 'seed' || def.category === 'misc') {
    return 'foliage';
  }
  if (def.category === 'lock') {
    return 'metal';
  }

  const key = def.key.toLowerCase();
  const name = def.name.toLowerCase();

  // Glass, Ice, Crystal, Gems, Cores
  if (
    key.includes('glass') ||
    key.includes('window') ||
    key.includes('ice') ||
    key.includes('icicle') ||
    key.includes('crystal') ||
    key.includes('snow') ||
    key.includes('salt') ||
    itemId === ITEM_IDS.WORLD_CORE ||
    itemId === ITEM_IDS.WORLD_BLAST
  ) {
    return 'glass';
  }

  // Metal, Machines, Locks, Terminals, Ingots, Portals
  if (
    key.includes('lock') ||
    key.includes('vending') ||
    key.includes('bfg') ||
    key.includes('terminal') ||
    key.includes('portal') ||
    key.includes('atm') ||
    key.includes('vaultbox') ||
    key.includes('matteragen') ||
    key.includes('ingot') ||
    key.includes('iron') ||
    key.includes('copper') ||
    key.includes('spikes') ||
    key.includes('dungeon_door')
  ) {
    return 'metal';
  }

  // Wood, Planks, Platforms, Doors, Signs, Roots, Bamboo
  if (
    key.includes('wood') ||
    key.includes('door') ||
    key.includes('sign') ||
    key.includes('platform') ||
    key.includes('root') ||
    key.includes('bamboo')
  ) {
    return 'wood';
  }

  // Foliage, Flowers, Crops, Bushes, Hedges, Mushrooms
  if (
    key.includes('daisy') ||
    key.includes('rose') ||
    key.includes('poppy') ||
    key.includes('mushroom') ||
    key.includes('wheat') ||
    key.includes('bush') ||
    key.includes('hedge') ||
    key.includes('blueberry') ||
    key.includes('cactus') ||
    key.includes('dune_grass')
  ) {
    return 'foliage';
  }

  // Dirt, Grass, Sand, Gravel, Clay, Permafrost, Bounce Pad
  if (
    key.includes('dirt') ||
    key.includes('grass') ||
    key.includes('sand') ||
    key.includes('gravel') ||
    key.includes('clay') ||
    key.includes('permafrost') ||
    key.includes('bounce') ||
    name.includes('dirt') ||
    name.includes('sand')
  ) {
    return 'dirt';
  }

  // Default to stone/masonry (rock, bricks, cave wall, limestone, shale, granite, veins, furnace, bedrock)
  return 'stone';
}

type ThemeMode = 'none' | 'menu' | 'world';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private whiteNoiseBuf: AudioBuffer | null = null;
  private pinkNoiseBuf: AudioBuffer | null = null;
  private brownNoiseBuf: AudioBuffer | null = null;

  private _muted = false;
  private themeTimer: number | null = null;
  private themeStep = 0;
  private currentTheme: ThemeMode = 'none';
  private stepFootIndex = 0;
  private lastStepAt = 0;

  public get muted(): boolean {
    return this._muted;
  }

  public set muted(val: boolean) {
    this._muted = Boolean(val);
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setTargetAtTime(this._muted ? 0 : 0.85, this.ctx.currentTime, 0.03);
      } catch {
        // ignore
      }
    }
  }

  private ensureContext(): AudioContext | null {
    if (this._muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        try {
          this.ctx = new AC();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.value = 0.85;
          this.masterGain.connect(this.ctx.destination);
          this.initNoiseBuffers(this.ctx);
        } catch {
          return null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getDestination(ctx: AudioContext): AudioNode {
    return this.masterGain ?? ctx.destination;
  }

  private initNoiseBuffers(ctx: AudioContext) {
    const length = ctx.sampleRate * 2; // 2 seconds of precomputed organic noise
    this.whiteNoiseBuf = ctx.createBuffer(1, length, ctx.sampleRate);
    this.pinkNoiseBuf = ctx.createBuffer(1, length, ctx.sampleRate);
    this.brownNoiseBuf = ctx.createBuffer(1, length, ctx.sampleRate);

    const white = this.whiteNoiseBuf.getChannelData(0);
    const pink = this.pinkNoiseBuf.getChannelData(0);
    const brown = this.brownNoiseBuf.getChannelData(0);

    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    let lastBrown = 0;

    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      white[i] = w;

      // Paul Kellet's pink noise filter
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      pink[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;

      // Brown (1/f^2) organic rumble noise
      lastBrown = (lastBrown + 0.02 * w) / 1.02;
      brown[i] = lastBrown * 3.2;
    }
  }

  /**
   * Plays a filtered organic noise burst (crucial for natural footsteps, soil crunch, wood splinters, water splash)
   */
  private playNoiseGrain(opts: {
    noiseType?: 'white' | 'pink' | 'brown';
    filterType?: BiquadFilterType;
    freq: number;
    endFreq?: number;
    q?: number;
    attack?: number;
    duration: number;
    volume: number;
    delay?: number;
  }) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const buf =
      opts.noiseType === 'brown'
        ? this.brownNoiseBuf
        : opts.noiseType === 'white'
          ? this.whiteNoiseBuf
          : this.pinkNoiseBuf;
    if (!buf) return;

    try {
      const start = ctx.currentTime + (opts.delay ?? 0);
      const attack = opts.attack ?? 0.003;
      const dur = Math.max(0.015, opts.duration);

      const src = ctx.createBufferSource();
      src.buffer = buf;

      const filter = ctx.createBiquadFilter();
      filter.type = opts.filterType ?? 'bandpass';
      filter.Q.setValueAtTime(opts.q ?? 1.8, start);
      filter.frequency.setValueAtTime(Math.max(40, opts.freq), start);
      if (opts.endFreq && opts.endFreq !== opts.freq) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.endFreq), start + dur);
      }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(opts.volume, start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.getDestination(ctx));

      const randomOffset = Math.random() * Math.max(0.1, buf.duration - dur - 0.05);
      src.start(start, randomOffset, dur + 0.02);
      src.stop(start + dur + 0.025);
    } catch {
      // ignore audio context timing edge cases
    }
  }

  /**
   * Plays a warm filtered physical body resonance (thud, woody knock, crystal bell, bass pluck)
   */
  private playResonantVoice(opts: {
    type?: OscillatorType;
    freq: number;
    endFreq?: number;
    duration: number;
    volume: number;
    attack?: number;
    cutoff?: number;
    delay?: number;
    detuneCents?: number;
  }) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const start = ctx.currentTime + (opts.delay ?? 0);
      const attack = opts.attack ?? 0.004;
      const dur = Math.max(0.015, opts.duration);

      const osc = ctx.createOscillator();
      osc.type = opts.type ?? 'triangle';
      if (opts.detuneCents) {
        osc.detune.setValueAtTime(opts.detuneCents, start);
      }
      osc.frequency.setValueAtTime(Math.max(24, opts.freq), start);
      if (opts.endFreq && opts.endFreq !== opts.freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(24, opts.endFreq), start + dur);
      }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(opts.volume, start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      if (opts.cutoff) {
        const lpf = ctx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.setValueAtTime(opts.cutoff, start);
        lpf.frequency.exponentialRampToValueAtTime(Math.max(120, opts.cutoff * 0.35), start + dur);
        osc.connect(lpf);
        lpf.connect(gain);
      } else {
        osc.connect(gain);
      }

      gain.connect(this.getDestination(ctx));
      osc.start(start);
      osc.stop(start + dur + 0.015);
    } catch {
      // ignore
    }
  }

  // ============================================================================
  // 1. NATURAL SURFACE-AWARE WALKING & LANDING
  // ============================================================================

  public footstep(groundItemId?: number, inFluid = false) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastStepAt < 145) return;
    this.lastStepAt = now;

    const material: SoundMaterial = inFluid ? 'fluid' : getMaterialForItem(groundItemId);
    // Alternate left and right foot pitch slightly for natural human gait
    const footParity = this.stepFootIndex++ % 2 === 0 ? 0.96 : 1.05;
    const jitter = (0.97 + Math.random() * 0.06) * footParity;

    switch (material) {
      case 'fluid': {
        // Wading splash & water slosh
        this.playNoiseGrain({
          noiseType: 'pink',
          filterType: 'bandpass',
          freq: 720 * jitter,
          endFreq: 1450 * jitter,
          q: 2.2,
          attack: 0.01,
          duration: 0.11,
          volume: 0.055,
        });
        this.playResonantVoice({
          type: 'sine',
          freq: 280 * jitter,
          endFreq: 540 * jitter,
          duration: 0.075,
          volume: 0.032,
          delay: 0.02,
        });
        break;
      }
      case 'wood': {
        // Hollow wooden floorboard step
        this.playResonantVoice({
          type: 'triangle',
          freq: 175 * jitter,
          endFreq: 92 * jitter,
          duration: 0.055,
          volume: 0.055,
          cutoff: 650,
        });
        this.playResonantVoice({
          type: 'sine',
          freq: 340 * jitter,
          endFreq: 250 * jitter,
          duration: 0.04,
          volume: 0.03,
        });
        this.playNoiseGrain({
          noiseType: 'pink',
          filterType: 'bandpass',
          freq: 1100 * jitter,
          q: 3.0,
          duration: 0.03,
          volume: 0.035,
        });
        break;
      }
      case 'stone': {
        // Crisp boot sole on cobblestone/rock
        this.playResonantVoice({
          type: 'sine',
          freq: 145 * jitter,
          endFreq: 62 * jitter,
          duration: 0.045,
          volume: 0.05,
        });
        this.playNoiseGrain({
          noiseType: 'white',
          filterType: 'bandpass',
          freq: 2200 * jitter,
          endFreq: 1600 * jitter,
          q: 2.6,
          duration: 0.032,
          volume: 0.042,
        });
        break;
      }
      case 'glass': {
        // Crisp snow/ice/crystal crunch step
        this.playNoiseGrain({
          noiseType: 'white',
          filterType: 'bandpass',
          freq: 2900 * jitter,
          endFreq: 1900 * jitter,
          q: 2.0,
          duration: 0.048,
          volume: 0.045,
        });
        this.playResonantVoice({
          type: 'sine',
          freq: 980 * jitter,
          endFreq: 680 * jitter,
          duration: 0.04,
          volume: 0.02,
        });
        break;
      }
      case 'metal': {
        // Metallic grate boot clank
        this.playResonantVoice({
          type: 'triangle',
          freq: 460 * jitter,
          endFreq: 290 * jitter,
          duration: 0.055,
          volume: 0.04,
          cutoff: 1600,
        });
        this.playResonantVoice({
          type: 'sine',
          freq: 1120 * jitter,
          endFreq: 860 * jitter,
          duration: 0.045,
          volume: 0.022,
        });
        break;
      }
      case 'foliage':
      case 'dirt':
      default: {
        // Soft cushioned earth thud + grass/gravel brush
        this.playResonantVoice({
          type: 'sine',
          freq: 112 * jitter,
          endFreq: 46 * jitter,
          duration: 0.055,
          volume: 0.06,
        });
        this.playNoiseGrain({
          noiseType: 'pink',
          filterType: 'bandpass',
          freq: 1550 * jitter,
          endFreq: 950 * jitter,
          q: 1.5,
          attack: 0.005,
          duration: 0.052,
          volume: 0.045,
          delay: 0.008,
        });
        break;
      }
    }
  }

  public jump(isBouncePad = false) {
    const jitter = 0.97 + Math.random() * 0.06;
    if (isBouncePad) {
      // Springy pneumatic pad launch
      this.playResonantVoice({
        type: 'sine',
        freq: 165 * jitter,
        endFreq: 560 * jitter,
        duration: 0.19,
        volume: 0.085,
      });
      this.playResonantVoice({
        type: 'triangle',
        freq: 330 * jitter,
        endFreq: 840 * jitter,
        duration: 0.15,
        volume: 0.045,
        cutoff: 1800,
        delay: 0.02,
      });
      this.playNoiseGrain({
        noiseType: 'pink',
        filterType: 'bandpass',
        freq: 600,
        endFreq: 2200,
        q: 1.6,
        duration: 0.14,
        volume: 0.05,
      });
      return;
    }

    // Natural physical push-off from ground + upward cloth/air whoosh
    this.playResonantVoice({
      type: 'sine',
      freq: 118 * jitter,
      endFreq: 245 * jitter,
      duration: 0.095,
      volume: 0.065,
    });
    this.playNoiseGrain({
      noiseType: 'pink',
      filterType: 'bandpass',
      freq: 420 * jitter,
      endFreq: 1380 * jitter,
      q: 1.6,
      attack: 0.01,
      duration: 0.11,
      volume: 0.048,
    });
  }

  public land(groundItemId?: number, inFluid = false) {
    const jitter = 0.96 + Math.random() * 0.08;
    // Deep cushioned body landing thud
    this.playResonantVoice({
      type: 'sine',
      freq: 135 * jitter,
      endFreq: 38 * jitter,
      duration: 0.085,
      volume: 0.085,
    });
    // Accompany with a natural surface scatter/step slightly offset (heel -> toe)
    this.lastStepAt = 0;
    this.footstep(groundItemId, inFluid);
  }

  // ============================================================================
  // 2. MATERIAL-AWARE TOOL SWING, BLOCK HIT, BLOCK BREAK & PLACEMENT
  // ============================================================================

  /**
   * Natural air whoosh when swinging Fist, Pickaxe, or Rod
   */
  public swingTool(toolItemId?: number) {
    const def = toolItemId ? getItemDef(toolItemId) : undefined;
    const jitter = 0.95 + Math.random() * 0.1;

    if (def?.toolKind === 'pickaxe') {
      // Heavy tool arc whoosh
      this.playNoiseGrain({
        noiseType: 'pink',
        filterType: 'bandpass',
        freq: 520 * jitter,
        endFreq: 1950 * jitter,
        q: 1.8,
        attack: 0.008,
        duration: 0.09,
        volume: 0.055,
      });
      this.playResonantVoice({
        type: 'triangle',
        freq: 195 * jitter,
        endFreq: 95 * jitter,
        duration: 0.07,
        volume: 0.045,
        cutoff: 700,
      });
    } else {
      // Nimble fist punch whoosh
      this.playNoiseGrain({
        noiseType: 'pink',
        filterType: 'bandpass',
        freq: 680 * jitter,
        endFreq: 1480 * jitter,
        q: 1.5,
        attack: 0.006,
        duration: 0.075,
        volume: 0.05,
      });
      this.playResonantVoice({
        type: 'sine',
        freq: 165 * jitter,
        endFreq: 78 * jitter,
        duration: 0.06,
        volume: 0.05,
      });
    }
  }

  /**
   * Backwards-compatible punch() that plays a natural physical strike
   */
  public punch(targetItemId?: number, toolItemId?: number) {
    this.swingTool(toolItemId);
    if (targetItemId && targetItemId !== ITEM_IDS.AIR) {
      this.hitBlock(targetItemId, toolItemId, 0.25);
    }
  }

  /**
   * Material-accurate block impact sound when damaging a tile
   * Pitch rises subtly with damageProgress (0..1) so player hears the block weakening!
   */
  public hitBlock(itemId?: number, toolItemId?: number, damageProgress = 0) {
    const material = getMaterialForItem(itemId);
    const toolDef = toolItemId ? getItemDef(toolItemId) : undefined;
    const isPickaxe = toolDef?.toolKind === 'pickaxe';
    const progressPitch = 1 + Math.max(0, Math.min(1, damageProgress)) * 0.18;
    const jitter = (0.95 + Math.random() * 0.1) * progressPitch;

    switch (material) {
      case 'dirt': {
        // Earthy shovel/fist crunch + soil grains
        this.playResonantVoice({
          type: 'sine',
          freq: 140 * jitter,
          endFreq: 52,
          duration: 0.075,
          volume: 0.08,
        });
        this.playNoiseGrain({
          noiseType: 'pink',
          filterType: 'bandpass',
          freq: 920 * jitter,
          endFreq: 520,
          q: 1.3,
          duration: 0.08,
          volume: 0.075,
        });
        this.playNoiseGrain({
          noiseType: 'white',
          filterType: 'bandpass',
          freq: 2600 * jitter,
          q: 2.4,
          duration: 0.045,
          volume: 0.035,
          delay: 0.015,
        });
        break;
      }

      case 'wood': {
        // Hollow resonant timber knock
        this.playResonantVoice({
          type: 'triangle',
          freq: 255 * jitter,
          endFreq: 145 * jitter,
          duration: 0.07,
          volume: 0.085,
          cutoff: 950,
        });
        this.playResonantVoice({
          type: 'sine',
          freq: 485 * jitter,
          endFreq: 360 * jitter,
          duration: 0.05,
          volume: 0.055,
        });
        this.playNoiseGrain({
          noiseType: 'pink',
          filterType: 'bandpass',
          freq: 1400 * jitter,
          q: 2.5,
          duration: 0.035,
          volume: 0.05,
        });
        break;
      }

      case 'stone': {
        // Chiseled stone thud + mineral pickaxe clink
        this.playResonantVoice({
          type: 'triangle',
          freq: 195 * jitter,
          endFreq: 75,
          duration: 0.07,
          volume: 0.08,
          cutoff: 800,
        });
        this.playNoiseGrain({
          noiseType: 'white',
          filterType: 'bandpass',
          freq: 2400 * jitter,
          endFreq: 1300,
          q: 2.2,
          duration: 0.055,
          volume: 0.065,
        });
        if (isPickaxe) {
          // Metallic pickaxe spark ping on rock
          this.playResonantVoice({
            type: 'sine',
            freq: 1480 * jitter,
            endFreq: 1120 * jitter,
            duration: 0.065,
            volume: 0.04,
          });
        }
        break;
      }

      case 'glass': {
        // Crystalline ice/glass clink
        this.playResonantVoice({
          type: 'sine',
          freq: 1680 * jitter,
          endFreq: 1420 * jitter,
          duration: 0.08,
          volume: 0.055,
        });
        this.playResonantVoice({
          type: 'sine',
          freq: 2640 * jitter,
          endFreq: 2380 * jitter,
          duration: 0.06,
          volume: 0.04,
          delay: 0.008,
        });
        this.playNoiseGrain({
          noiseType: 'white',
          filterType: 'highpass',
          freq: 3600,
          q: 1.5,
          duration: 0.035,
          volume: 0.045,
        });
        break;
      }

      case 'metal': {
        // Anvil/metal hull strike with inharmonic partials
        this.playResonantVoice({
          type: 'triangle',
          freq: 540 * jitter,
          endFreq: 490 * jitter,
          duration: 0.095,
          volume: 0.065,
          cutoff: 2200,
        });
        this.playResonantVoice({
          type: 'sine',
          freq: 1190 * jitter,
          endFreq: 1080 * jitter,
          duration: 0.08,
          volume: 0.045,
        });
        this.playResonantVoice({
          type: 'sine',
          freq: 1940 * jitter,
          endFreq: 1780 * jitter,
          duration: 0.06,
          volume: 0.03,
        });
        break;
      }

      case 'foliage': {
        // Crisp leaf rustle & stem chop
        this.playNoiseGrain({
          noiseType: 'pink',
          filterType: 'bandpass',
          freq: 2300 * jitter,
          endFreq: 1200,
          q: 1.4,
          duration: 0.075,
          volume: 0.065,
        });
        this.playResonantVoice({
          type: 'sine',
          freq: 290 * jitter,
          endFreq: 140,
          duration: 0.05,
          volume: 0.045,
        });
        break;
      }

      case 'fluid': {
        // Water/liquid splash
        this.playNoiseGrain({
          noiseType: 'pink',
          filterType: 'bandpass',
          freq: 850 * jitter,
          endFreq: 1750 * jitter,
          q: 2.0,
          duration: 0.1,
          volume: 0.06,
        });
        break;
      }
    }
  }

  /**
   * Multi-layered material-specific block destruction sound
   */
  public breakBlock(itemId?: number) {
    const material = getMaterialForItem(itemId);
    const jitter = 0.95 + Math.random() * 0.1;

    switch (material) {
      case 'dirt': {
        // Deep soil crumble + 3 cascading earth/pebble scatter grains
        this.playResonantVoice({
          type: 'sine',
          freq: 135 * jitter,
          endFreq: 38,
          duration: 0.16,
          volume: 0.1,
        });
        for (let i = 0; i < 3; i++) {
          this.playNoiseGrain({
            noiseType: 'pink',
            filterType: 'bandpass',
            freq: (1150 - i * 210) * jitter,
            endFreq: 420,
            q: 1.2,
            duration: 0.11,
            volume: 0.08 - i * 0.018,
            delay: i * 0.038,
          });
        }
        // Pebble scatter pops
        this.playNoiseGrain({
          noiseType: 'white',
          filterType: 'bandpass',
          freq: 2800 * jitter,
          q: 2.2,
          duration: 0.08,
          volume: 0.045,
          delay: 0.03,
        });
        break;
      }

      case 'wood': {
        // Crisp timber splinter crack + 3 tumbling hollow wooden plank clatters
        this.playNoiseGrain({
          noiseType: 'white',
          filterType: 'bandpass',
          freq: 1950 * jitter,
          endFreq: 900,
          q: 1.8,
          duration: 0.09,
          volume: 0.085,
        });
        const woodPitches = [310, 235, 175];
        woodPitches.forEach((p, idx) => {
          this.playResonantVoice({
            type: 'triangle',
            freq: p * jitter,
            endFreq: p * 0.58 * jitter,
            duration: 0.085,
            volume: 0.08 - idx * 0.018,
            cutoff: 1100,
            delay: idx * 0.042,
          });
        });
        break;
      }

      case 'stone': {
        // Heavy rock fracture + tumbling cobblestone debris
        this.playResonantVoice({
          type: 'triangle',
          freq: 165 * jitter,
          endFreq: 42,
          duration: 0.19,
          volume: 0.105,
          cutoff: 650,
        });
        this.playNoiseGrain({
          noiseType: 'brown',
          filterType: 'lowpass',
          freq: 520,
          duration: 0.21,
          volume: 0.09,
        });
        const stoneShards = [420, 310, 240, 185];
        stoneShards.forEach((freq, idx) => {
          this.playNoiseGrain({
            noiseType: 'white',
            filterType: 'bandpass',
            freq: (2200 - idx * 320) * jitter,
            q: 2.4,
            duration: 0.065,
            volume: 0.065 - idx * 0.012,
            delay: idx * 0.038,
          });
          this.playResonantVoice({
            type: 'sine',
            freq: freq * jitter,
            endFreq: freq * 0.55,
            duration: 0.06,
            volume: 0.055 - idx * 0.01,
            delay: idx * 0.038,
          });
        });
        break;
      }

      case 'glass': {
        // Crisp glass/crystal shatter + cascading 5-shard high-frequency tinkle
        this.playNoiseGrain({
          noiseType: 'white',
          filterType: 'highpass',
          freq: 2800,
          q: 1.4,
          duration: 0.11,
          volume: 0.075,
        });
        const shards = [2250, 3180, 2680, 3840, 4420];
        shards.forEach((f, idx) => {
          this.playResonantVoice({
            type: 'sine',
            freq: f * jitter,
            endFreq: f * 0.88 * jitter,
            duration: 0.09 - idx * 0.01,
            volume: 0.055 - idx * 0.008,
            delay: idx * 0.032,
          });
        });
        break;
      }

      case 'metal': {
        // Heavy metallic unbolting & resonant plate drop
        this.playResonantVoice({
          type: 'triangle',
          freq: 480 * jitter,
          endFreq: 180 * jitter,
          duration: 0.18,
          volume: 0.085,
          cutoff: 1900,
        });
        this.playResonantVoice({
          type: 'sine',
          freq: 1140 * jitter,
          endFreq: 760 * jitter,
          duration: 0.15,
          volume: 0.05,
          delay: 0.02,
        });
        this.playNoiseGrain({
          noiseType: 'white',
          filterType: 'bandpass',
          freq: 2600 * jitter,
          q: 2.5,
          duration: 0.09,
          volume: 0.06,
        });
        break;
      }

      case 'foliage': {
        // Lush leafy harvest swoosh + crisp stem snap
        this.playNoiseGrain({
          noiseType: 'pink',
          filterType: 'bandpass',
          freq: 2400 * jitter,
          endFreq: 950,
          q: 1.2,
          duration: 0.14,
          volume: 0.085,
        });
        this.playResonantVoice({
          type: 'triangle',
          freq: 380 * jitter,
          endFreq: 165,
          duration: 0.075,
          volume: 0.065,
          cutoff: 1200,
        });
        this.playResonantVoice({
          type: 'sine',
          freq: 520 * jitter,
          endFreq: 690 * jitter,
          duration: 0.08,
          volume: 0.04,
          delay: 0.04,
        });
        break;
      }

      case 'fluid': {
        // Big liquid splash & bubbling drain
        this.playNoiseGrain({
          noiseType: 'pink',
          filterType: 'bandpass',
          freq: 650,
          endFreq: 1850,
          q: 1.8,
          duration: 0.16,
          volume: 0.08,
        });
        [360, 520, 680].forEach((f, idx) => {
          this.playResonantVoice({
            type: 'sine',
            freq: f * jitter,
            endFreq: f * 1.45 * jitter,
            duration: 0.065,
            volume: 0.045,
            delay: idx * 0.035,
          });
        });
        break;
      }
    }
  }

  /**
   * Material-aware block placement acoustics
   */
  public placeBlock(itemId?: number) {
    const material = getMaterialForItem(itemId);
    const jitter = 0.96 + Math.random() * 0.08;

    switch (material) {
      case 'wood': {
        // Two-step carpentry knock
        this.playResonantVoice({
          type: 'triangle',
          freq: 220 * jitter,
          endFreq: 165 * jitter,
          duration: 0.055,
          volume: 0.075,
          cutoff: 950,
        });
        this.playResonantVoice({
          type: 'triangle',
          freq: 310 * jitter,
          endFreq: 265 * jitter,
          duration: 0.065,
          volume: 0.07,
          cutoff: 1150,
          delay: 0.028,
        });
        break;
      }
      case 'stone': {
        // Firm masonry block set + mortar brush
        this.playResonantVoice({
          type: 'sine',
          freq: 145 * jitter,
          endFreq: 58,
          duration: 0.085,
          volume: 0.085,
        });
        this.playNoiseGrain({
          noiseType: 'white',
          filterType: 'bandpass',
          freq: 1650 * jitter,
          endFreq: 1100,
          q: 2.0,
          duration: 0.055,
          volume: 0.055,
        });
        break;
      }
      case 'glass': {
        // Crisp glass/ice pane fit
        this.playResonantVoice({
          type: 'sine',
          freq: 1240 * jitter,
          endFreq: 1680 * jitter,
          duration: 0.075,
          volume: 0.055,
        });
        this.playResonantVoice({
          type: 'sine',
          freq: 2480 * jitter,
          endFreq: 2920 * jitter,
          duration: 0.06,
          volume: 0.035,
          delay: 0.015,
        });
        break;
      }
      case 'metal': {
        // Mechanical lock / machine bolt latch
        this.playResonantVoice({
          type: 'triangle',
          freq: 260 * jitter,
          endFreq: 180 * jitter,
          duration: 0.07,
          volume: 0.075,
          cutoff: 1400,
        });
        this.playResonantVoice({
          type: 'sine',
          freq: 980 * jitter,
          endFreq: 1420 * jitter,
          duration: 0.065,
          volume: 0.055,
          delay: 0.04,
        });
        break;
      }
      case 'fluid': {
        // Liquid pour & bubble
        this.playNoiseGrain({
          noiseType: 'pink',
          filterType: 'bandpass',
          freq: 700,
          endFreq: 1600,
          q: 2.0,
          duration: 0.14,
          volume: 0.07,
        });
        this.playResonantVoice({
          type: 'sine',
          freq: 380 * jitter,
          endFreq: 690 * jitter,
          duration: 0.09,
          volume: 0.05,
          delay: 0.025,
        });
        break;
      }
      case 'foliage':
      case 'dirt':
      default: {
        // Compacting soil pat + earthy brush
        this.playResonantVoice({
          type: 'sine',
          freq: 130 * jitter,
          endFreq: 68,
          duration: 0.075,
          volume: 0.08,
        });
        this.playNoiseGrain({
          noiseType: 'pink',
          filterType: 'bandpass',
          freq: 1150 * jitter,
          endFreq: 780,
          q: 1.5,
          duration: 0.065,
          volume: 0.06,
        });
        break;
      }
    }
  }

  public plant() {
    const jitter = 0.96 + Math.random() * 0.08;
    // Soil dig rustle + gentle organic sprout harmonic
    this.playNoiseGrain({
      noiseType: 'pink',
      filterType: 'bandpass',
      freq: 1350 * jitter,
      endFreq: 850,
      q: 1.4,
      duration: 0.08,
      volume: 0.065,
    });
    this.playResonantVoice({
      type: 'sine',
      freq: 330 * jitter,
      endFreq: 495 * jitter,
      duration: 0.09,
      volume: 0.055,
      delay: 0.025,
    });
    this.playResonantVoice({
      type: 'sine',
      freq: 495 * jitter,
      endFreq: 660 * jitter,
      duration: 0.09,
      volume: 0.04,
      delay: 0.065,
    });
  }

  // ============================================================================
  // 3. ITEM PICKUP, GEMS, FISHING, HAZARDS & DUNGEON COMBAT
  // ============================================================================

  public pickup() {
    const jitter = 0.96 + Math.random() * 0.08;
    // Soft leather pouch pop + warm marimba confirmation
    this.playResonantVoice({
      type: 'sine',
      freq: 290 * jitter,
      endFreq: 580 * jitter,
      attack: 0.003,
      duration: 0.075,
      volume: 0.07,
    });
    this.playResonantVoice({
      type: 'triangle',
      freq: 580 * jitter,
      endFreq: 870 * jitter,
      duration: 0.085,
      volume: 0.045,
      cutoff: 1800,
      delay: 0.032,
    });
  }

  public gem() {
    const jitter = 0.98 + Math.random() * 0.04;
    // Shimmering 3-note crystalline harmonic bell arpeggio
    const notes = [880, 1108.73, 1318.51, 1760]; // A5, C#6, E6, A6
    notes.forEach((freq, idx) => {
      this.playResonantVoice({
        type: 'sine',
        freq: freq * jitter,
        endFreq: freq * 1.005 * jitter,
        attack: 0.003,
        duration: 0.16,
        volume: 0.055 - idx * 0.008,
        delay: idx * 0.038,
      });
    });
  }

  public castRod() {
    // Rod whip whoosh + delayed water bobber plop
    this.playNoiseGrain({
      noiseType: 'pink',
      filterType: 'bandpass',
      freq: 580,
      endFreq: 2400,
      q: 2.2,
      attack: 0.01,
      duration: 0.12,
      volume: 0.065,
    });
    this.playResonantVoice({
      type: 'sine',
      freq: 360,
      endFreq: 740,
      duration: 0.09,
      volume: 0.05,
      delay: 0.14,
    });
    this.playNoiseGrain({
      noiseType: 'pink',
      filterType: 'bandpass',
      freq: 1100,
      endFreq: 1800,
      q: 2.0,
      duration: 0.09,
      volume: 0.05,
      delay: 0.15,
    });
  }

  public fishingBite() {
    // Energetic bobber plunge gulp + splash
    this.playResonantVoice({
      type: 'sine',
      freq: 620,
      endFreq: 240,
      duration: 0.11,
      volume: 0.085,
    });
    this.playResonantVoice({
      type: 'sine',
      freq: 380,
      endFreq: 760,
      duration: 0.11,
      volume: 0.075,
      delay: 0.08,
    });
    this.playNoiseGrain({
      noiseType: 'pink',
      filterType: 'bandpass',
      freq: 950,
      endFreq: 2100,
      q: 1.8,
      duration: 0.15,
      volume: 0.075,
      delay: 0.04,
    });
  }

  public reelTick(tension = 0.3) {
    const pitch = 780 + Math.min(1, Math.max(0, tension)) * 640;
    this.playResonantVoice({
      type: 'triangle',
      freq: pitch,
      endFreq: pitch * 1.15,
      duration: 0.032,
      volume: 0.045,
      cutoff: 2200,
    });
  }

  public hazardHit(kind: 'acid' | 'spikes' = 'spikes') {
    if (kind === 'acid') {
      // Sizzling acid hiss + bubbling
      this.playNoiseGrain({
        noiseType: 'white',
        filterType: 'bandpass',
        freq: 3200,
        endFreq: 1400,
        q: 1.4,
        duration: 0.24,
        volume: 0.085,
      });
      this.playResonantVoice({
        type: 'sawtooth',
        freq: 220,
        endFreq: 95,
        duration: 0.18,
        volume: 0.06,
        cutoff: 700,
      });
    } else {
      // Sharp metallic spike impact
      this.playResonantVoice({
        type: 'sawtooth',
        freq: 280,
        endFreq: 68,
        duration: 0.16,
        volume: 0.09,
        cutoff: 900,
      });
      this.playNoiseGrain({
        noiseType: 'white',
        filterType: 'bandpass',
        freq: 2400,
        q: 2.2,
        duration: 0.08,
        volume: 0.07,
      });
    }
  }

  public unlock() {
    const chord = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    chord.forEach((f, idx) => {
      this.playResonantVoice({
        type: 'triangle',
        freq: f,
        endFreq: f * 1.005,
        duration: 0.22,
        volume: 0.055,
        cutoff: 2400,
        delay: idx * 0.055,
      });
    });
  }

  public dungeonAttack() {
    const jitter = 0.95 + Math.random() * 0.1;
    // Crisp steel blade air-cleave + metallic ring
    this.playNoiseGrain({
      noiseType: 'white',
      filterType: 'bandpass',
      freq: 1850 * jitter,
      endFreq: 620,
      q: 1.8,
      attack: 0.005,
      duration: 0.11,
      volume: 0.075,
    });
    this.playResonantVoice({
      type: 'triangle',
      freq: 520 * jitter,
      endFreq: 165 * jitter,
      duration: 0.11,
      volume: 0.075,
      cutoff: 1800,
    });
    this.playResonantVoice({
      type: 'sine',
      freq: 1480 * jitter,
      endFreq: 980 * jitter,
      duration: 0.085,
      volume: 0.035,
    });
  }

  public uiClick() {
    // Subtle wooden/tactile UI tap (warm, non-piercing)
    this.playResonantVoice({
      type: 'sine',
      freq: 540,
      endFreq: 720,
      attack: 0.002,
      duration: 0.032,
      volume: 0.038,
    });
  }

  // ============================================================================
  // 4. REINVENTED MULTI-VOICE GAME THEME SONG (MENU OVERTURE & WORLD AMBIENCE)
  // ============================================================================

  /**
   * Plays an acoustic harp/kalimba plucked note with warm lowpass filter envelope
   */
  private playPluckNote(freq: number, duration: number, volume: number, delay = 0) {
    this.playResonantVoice({
      type: 'triangle',
      freq,
      endFreq: freq * 0.998,
      attack: 0.008,
      duration,
      volume,
      cutoff: freq * 3.2,
      delay,
    });
    this.playResonantVoice({
      type: 'sine',
      freq: freq * 2,
      attack: 0.005,
      duration: duration * 0.45,
      volume: volume * 0.35,
      delay,
    });
  }

  /**
   * Plays a warm, slow-breathing horizon pad chord
   */
  private playWarmPadChord(freqs: number[], duration: number, volume: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const f of freqs) {
      try {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(volume, now + duration * 0.32);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(this.getDestination(ctx));
        osc.start(now);
        osc.stop(now + duration + 0.05);
      } catch {
        // ignore
      }
    }
  }

  public startMenuTheme() {
    this.startThemeLoop('menu');
  }

  public startWorldTheme() {
    this.startThemeLoop('world');
  }

  public stopMenuTheme() {
    if (this.currentTheme === 'menu') {
      this.stopAllThemes();
    }
  }

  public stopAllThemes() {
    if (this.themeTimer !== null) {
      clearInterval(this.themeTimer);
      this.themeTimer = null;
    }
    this.currentTheme = 'none';
    this.themeStep = 0;
  }

  private startThemeLoop(mode: 'menu' | 'world') {
    if (this.currentTheme === mode && this.themeTimer !== null) return;
    this.stopAllThemes();
    this.currentTheme = mode;
    this.themeStep = 0;

    if (mode === 'menu') {
      // Unique 64-step (8-bar) 28-bit Pixelart Adventurous Soundtrack in D Dorian / F Major Cosmos:
      // Uplifting, heroic synthwave/chiptune frontier exploration progression:
      // Bar 1: Dm9   | Bar 2: Bbmaj7 | Bar 3: Csus4->C | Bar 4: Am7
      // Bar 5: Gm7   | Bar 6: C9     | Bar 7: Bbmaj7   | Bar 8: A7sus4->A7
      const menuBars = [
        { bass: 73.42, pad: [146.83, 220.0, 261.63, 329.63], arp: [293.66, 349.23, 440.0, 523.25, 659.25, 523.25, 440.0, 349.23] },
        { bass: 58.27, pad: [116.54, 174.61, 220.0, 293.66], arp: [233.08, 293.66, 349.23, 440.0, 587.33, 440.0, 349.23, 293.66] },
        { bass: 65.41, pad: [130.81, 196.0, 261.63, 349.23], arp: [261.63, 349.23, 392.0, 523.25, 659.25, 523.25, 392.0, 329.63] },
        { bass: 55.0, pad: [110.0, 164.81, 220.0, 293.66], arp: [220.0, 261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 261.63] },
        { bass: 98.0, pad: [196.0, 233.08, 293.66, 349.23], arp: [293.66, 349.23, 466.16, 587.33, 698.46, 587.33, 466.16, 349.23] },
        { bass: 65.41, pad: [130.81, 196.0, 233.08, 293.66], arp: [261.63, 329.63, 392.0, 466.16, 587.33, 466.16, 392.0, 329.63] },
        { bass: 58.27, pad: [116.54, 174.61, 220.0, 349.23], arp: [233.08, 293.66, 349.23, 440.0, 587.33, 698.46, 587.33, 440.0] },
        { bass: 55.0, pad: [110.0, 164.81, 207.65, 293.66], arp: [220.0, 277.18, 329.63, 440.0, 554.37, 440.0, 329.63, 277.18] },
      ];

      // Crisp 28-bit adventurous hero lead melody (Hz, 0 = sustain/rest)
      const heroLead = [
        // Bar 1 (Dm9)
        587.33, 0, 659.25, 698.46, 0, 880.0, 783.99, 698.46,
        // Bar 2 (Bbmaj7)
        698.46, 0, 587.33, 0, 440.0, 523.25, 587.33, 0,
        // Bar 3 (C)
        523.25, 0, 587.33, 659.25, 0, 783.99, 659.25, 587.33,
        // Bar 4 (Am7)
        523.25, 0, 440.0, 392.0, 440.0, 0, 523.25, 0,
        // Bar 5 (Gm7)
        783.99, 0, 698.46, 587.33, 0, 698.46, 783.99, 880.0,
        // Bar 6 (C9)
        1046.5, 0, 880.0, 783.99, 0, 659.25, 783.99, 0,
        // Bar 7 (Bbmaj7)
        698.46, 0, 783.99, 880.0, 0, 1046.5, 880.0, 783.99,
        // Bar 8 (A7 turnaround)
        659.25, 0, 554.37, 440.0, 554.37, 659.25, 880.0, 0,
      ];

      this.themeTimer = window.setInterval(() => {
        if (this._muted) return;
        const step = this.themeStep % 64;
        const barIdx = Math.floor(step / 8) % menuBars.length;
        const beatInBar = step % 8;
        const bar = menuBars[barIdx];

        // 1. Starlight Cosmic Pad on Bar Downbeats
        if (beatInBar === 0) {
          this.playWarmPadChord(bar.pad, 1.4, 0.015);
        }

        // 2. Driving 28-bit Synth Bassline (root + octave hop)
        const bassMult = beatInBar === 2 || beatInBar === 6 ? 2 : beatInBar === 4 ? 1.5 : 1;
        if (beatInBar % 2 === 0 || beatInBar === 7) {
          this.playResonantVoice({
            type: 'triangle',
            freq: bar.bass * bassMult,
            attack: 0.006,
            duration: 0.24,
            volume: beatInBar === 0 ? 0.036 : 0.025,
            cutoff: 680,
          });
        }

        // 3. Sparkling 28-bit Chiptune Arpeggio
        const arpFreq = bar.arp[beatInBar];
        if (arpFreq) {
          this.playResonantVoice({
            type: 'square',
            freq: arpFreq,
            attack: 0.004,
            duration: 0.12,
            volume: beatInBar % 2 === 0 ? 0.011 : 0.008,
            cutoff: 2200,
          });
        }

        // 4. Adventurous 28-bit Heroic Lead (layered square pulse + crystal overtone)
        const leadFreq = heroLead[step];
        if (leadFreq > 0) {
          this.playResonantVoice({
            type: 'square',
            freq: leadFreq,
            attack: 0.008,
            duration: 0.28,
            volume: 0.017,
            cutoff: 2800,
          });
          this.playResonantVoice({
            type: 'sine',
            freq: leadFreq * 2,
            attack: 0.01,
            duration: 0.2,
            volume: 0.006,
          });
        }

        // 5. Crisp Pixel Percussion (Kick pulse on 0/4, gentle chiptune snare/hat on off-beats)
        if (beatInBar === 0 || beatInBar === 4) {
          this.playResonantVoice({
            type: 'sine',
            freq: 118,
            endFreq: 44,
            attack: 0.003,
            duration: 0.09,
            volume: 0.03,
          });
        } else if (beatInBar === 2 || beatInBar === 6) {
          this.playNoiseGrain({
            noiseType: 'white',
            filterType: 'bandpass',
            freq: 2900,
            q: 1.8,
            attack: 0.002,
            duration: 0.055,
            volume: 0.012,
          });
        } else if (beatInBar % 2 === 1) {
          this.playNoiseGrain({
            noiseType: 'white',
            filterType: 'highpass',
            freq: 6400,
            q: 1.4,
            attack: 0.002,
            duration: 0.024,
            volume: 0.006,
          });
        }

        this.themeStep++;
      }, 155);
      return;
    }

    // 'world' mode: Serene, breathing sandbox atmosphere (leaves space for footsteps & block breaking)
    const chords = [
      { bass: 82.41, pad: [164.81, 246.94, 329.63, 415.3], arp: [329.63, 369.99, 415.3, 493.88, 659.25, 493.88, 415.3, 369.99] },
      { bass: 138.59, pad: [138.59, 207.65, 329.63, 415.3], arp: [277.18, 329.63, 415.3, 493.88, 554.37, 493.88, 415.3, 329.63] },
      { bass: 110.0, pad: [220.0, 277.18, 329.63, 415.3], arp: [220.0, 277.18, 329.63, 415.3, 493.88, 415.3, 329.63, 277.18] },
      { bass: 123.47, pad: [185.0, 246.94, 311.13, 369.99], arp: [246.94, 311.13, 369.99, 415.3, 493.88, 554.37, 493.88, 369.99] },
    ];

    this.themeTimer = window.setInterval(() => {
      if (this._muted) return;
      const step = this.themeStep % 32;
      const barIdx = Math.floor(step / 8) % chords.length;
      const beatInBar = step % 8;
      const bar = chords[barIdx];

      if (beatInBar === 0) {
        this.playWarmPadChord(bar.pad, 3.1, 0.012);
        this.playResonantVoice({
          type: 'sine',
          freq: bar.bass,
          attack: 0.03,
          duration: 1.6,
          volume: 0.022,
        });
      }
      if (beatInBar === 0 || beatInBar === 3 || beatInBar === 5) {
        const noteFreq = bar.arp[beatInBar];
        if (noteFreq) {
          this.playPluckNote(noteFreq, 0.72, 0.016);
        }
      }

      this.themeStep++;
    }, 420);
  }
}

export const soundEngine = new SoundEngine();
