import {
  DEFAULT_VIEW_SCALE,
  DROP_PICKUP_RADIUS,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  TILE_SIZE,
} from './constants.ts';
import { CATALOG, getItemDef, isCropSeed, ITEM_IDS } from './catalog.ts';
import {
  cloneGameConfig,
  DEFAULT_GAME_CONFIG,
  getEffectiveItemDef,
  type GameConfig,
} from './config.ts';
import { ensureFluidArrays, type FluidDelta } from './fluids.ts';
import { createPlayerBody, stepPlayerPhysics, type PlayerBody } from './physics.ts';
import {
  getCrackOverlay,
  getMarketStandSprite,
  getPlayerSprite,
  getTileSprite,
  type EquippedWearables,
  type PlayerPose,
} from './pixelArt.ts';
import { PLAYER_LOGICAL_H, PLAYER_LOGICAL_W } from './playerSpriteHD.ts';
import {
  canBreakTile,
  canPlaceTile,
  canPlowTile,
  getCoveringAreaLock,
  getCoveringShareLock,
  getMarketStandAt,
  getPlantGrowthState,
  inBoundsWorld,
  isDoorBlock,
  tileIndexIn,
  worldHeight,
  worldWidth,
} from './rules.ts';
import {
  generateWorld,
  type AreaLockRecord,
  type AtmMachineRecord,
  type DoorLinkRecord,
  type ShareLockRecord,
  type BfgCollectorRecord,
  type FurnaceRecord,
  type MatteragenRecord,
  type PlantedTree,
  type SeedPotRecord,
  type VaultboxRecord,
  type VendingMachineRecord,
  type WorldLockRecord,
  type WorldState,
} from './worldGen.ts';
import { soundEngine } from './audio.ts';
import { BLOCKGROVE_ART_THEME } from './artTheme.ts';
import type { ActiveBuff, FishingCastState, RemotePlayerState, WorldDrop } from './network.ts';

type ParticleShape = 'shard' | 'spark' | 'ring' | 'dust' | 'plus';

interface Particle {
  active: boolean;
  shape: ParticleShape;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  endSize: number;
  gravity: number;
  drag: number;
  rot: number;
  vRot: number;
  color: string;
  accentColor: string;
}

interface TileAnim {
  kind: 'hit' | 'place';
  startedAt: number;
  durationMs: number;
  dirX: number;
  dirY: number;
  itemId: number;
}

interface WorldPopup {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface TileCrackVisual {
  hits: number;
  maxHits: number;
  expiresAt: number;
}

export interface TileInspectInfo {
  tx: number;
  ty: number;
  fgId: number;
  fgName: string;
  bgName: string;
  plantInfo?: string;
  lockInfo?: string;
  worldLock?: WorldLockRecord | null;
  areaLock?: AreaLockRecord | null;
  shareLock?: ShareLockRecord | null;
  isLandlord?: boolean;
  isGreensVendor?: boolean;
  isWorldCore?: boolean;
  vendingMachine?: VendingMachineRecord | null;
  furnace?: FurnaceRecord | null;
  bfgCollector?: BfgCollectorRecord | null;
  isExchangeTerminal?: boolean;
  signText?: string | null;
  matteragenEngine?: MatteragenRecord | null;
  atmMachine?: AtmMachineRecord | null;
  vaultbox?: VaultboxRecord | null;
  bgId?: number;
  isDoor?: boolean;
  isNexusDoor?: boolean;
  doorLink?: DoorLinkRecord | null;
}

export interface EngineCallbacks {
  onMoveSync?: (state: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    facing: 1 | -1;
    grounded: boolean;
    punching: boolean;
    placing?: boolean;
  }) => void;
  onPunchTile?: (tx: number, ty: number, toolItemId?: number, adminEdit?: boolean) => void;
  onPlaceTile?: (tx: number, ty: number, itemId: number, adminEdit?: boolean) => void;
  onPlowTile?: (tx: number, ty: number, adminEdit?: boolean) => void;
  onPickupDrop?: (dropId: string) => void;
  onInspectTile?: (info: TileInspectInfo | null) => void;
  onInspectPlayer?: (player: RemotePlayerState) => void;
  onCoordsChange?: (tx: number, ty: number) => void;
  onCastFishing?: (tx: number, ty: number, rodItemId: number) => void;
  onReelFishing?: () => void;
  onUseConsumable?: (itemId: number) => void;
  onHazardHit?: (hazard: 'acid' | 'spikes') => void;
  onUseDoor?: (tx: number, ty: number) => void;
}

const MAX_PARTICLES = 280;
const MAX_POPUPS = 24;
const PUNCH_ANIM_DURATION = 0.28;
const PLACE_ANIM_DURATION = 0.24;
const PLACE_COOLDOWN = 0.24;

export class BlockgroveEngine {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private resizeObserver: ResizeObserver;

  private mode: 'title' | 'playing' | 'paused' = 'title';
  private world: WorldState;
  private localPlayerId = 'local';
  private localPlayerName = 'Explorer';
  private localPlayerRole: 'player' | 'admin' = 'player';
  private localShirtColor = '#3f8fd9';
  private localEquipped: EquippedWearables = {};
  private body: PlayerBody;
  private selectedItemId: number = ITEM_IDS.FIST;

  private remotePlayers = new Map<string, RemotePlayerState & { renderX: number; renderY: number }>();
  private drops = new Map<string, WorldDrop>();
  private cracks = new Map<string, TileCrackVisual>();
  private pickupAttempted = new Set<string>();
  private activeBuffs: ActiveBuff[] = [];
  private activeCasts = new Map<string, FishingCastState>();

  private camX = 0;
  private camY = 0;
  private skyGradient: CanvasGradient | null = null;
  private worldLayerCanvas: HTMLCanvasElement;
  private worldLayerCtx: CanvasRenderingContext2D;
  private shakeTrauma = 0;
  private hitstopTimer = 0;
  private cssWidth = 960;
  private cssHeight = 540;
  private dpr = 1;

  private keysHeld = new Set<string>();
  private jumpJustPressed = false;
  private touchState = { left: false, right: false, down: false, jumpHeld: false, punchHeld: false };
  private punchStick = { active: false, dx: 0, dy: 0 };

  private mouseScreenX = 0;
  private mouseScreenY = 0;
  private mouseInCanvas = false;
  private mouseDown = false;
  private activePointerId: number | null = null;
  private activePointers = new Set<number>();
  private punchTimer = 0;
  private punchAnimTimer = 0;
  private placeAnimTimer = 0;
  private landAnimTimer = 0;
  private lastSyncSent = 0;
  private lastCoordTx = -1;
  private lastCoordTy = -1;
  private lastPlantInspectKey: string | null = null;
  private lastPlantInspectAt = 0;
  private titlePanTime = 0;
  private stepDistanceAccum = 0;
  private gameConfig: GameConfig = cloneGameConfig(DEFAULT_GAME_CONFIG);
  private viewScale = DEFAULT_VIEW_SCALE;
  private adminWorldEdit = false;
  private adminBrushItemId: number | null = null;

  private particles: Particle[] = [];
  private particleCursor = 0;
  private tileAnims = new Map<string, TileAnim>();
  private popups: WorldPopup[] = [];

  private rafId: number | null = null;
  private throttleTimerId: number | null = null;
  private lastFrameMs = 0;
  private callbacks: EngineCallbacks;
  private nameplateCache = new Map<string, HTMLCanvasElement>();
  private playerHitRegions: Array<{
    player: RemotePlayerState;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }> = [];

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'block w-full h-full pixelated touch-none';
    this.canvas.style.touchAction = 'none';
    this.canvas.dataset.testid = 'game-canvas';
    this.container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;

    this.world = generateWorld('START');
    this.worldLayerCanvas = document.createElement('canvas');
    this.worldLayerCanvas.width = worldWidth(this.world) * TILE_SIZE;
    this.worldLayerCanvas.height = worldHeight(this.world) * TILE_SIZE;
    const wlCtx = this.worldLayerCanvas.getContext('2d');
    if (!wlCtx) throw new Error('Offscreen 2D canvas unavailable');
    wlCtx.imageSmoothingEnabled = false;
    this.worldLayerCtx = wlCtx;
    this.rebuildWorldLayer();

    this.body = createPlayerBody(this.world.spawnX, this.world.spawnY);
    this.snapCameraToPlayer();

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        shape: 'shard',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 0.4,
        size: 4,
        endSize: 2,
        gravity: 420,
        drag: 0.98,
        rot: 0,
        vRot: 0,
        color: '#ffffff',
        accentColor: '#ffffff',
      });
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    this.handleResize();

    this.bindEvents();
    this.lastFrameMs = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private handleResize() {
    const rect = this.container.getBoundingClientRect();
    const cssW = Math.max(320, Math.floor(rect.width));
    const cssH = Math.max(200, Math.floor(rect.height));
    const dpr = Math.min(3, Math.max(1, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1));
    const physW = Math.round(cssW * dpr);
    const physH = Math.round(cssH * dpr);
    if (
      this.cssWidth !== cssW ||
      this.cssHeight !== cssH ||
      this.dpr !== dpr ||
      this.canvas.width !== physW ||
      this.canvas.height !== physH
    ) {
      this.cssWidth = cssW;
      this.cssHeight = cssH;
      this.dpr = dpr;
      this.canvas.width = physW;
      this.canvas.height = physH;
      this.ctx.imageSmoothingEnabled = false;
      const grad = this.ctx.createLinearGradient(0, 0, 0, cssH);
      grad.addColorStop(0, '#4a9ee0');
      grad.addColorStop(0.55, '#86ccf5');
      grad.addColorStop(1, '#c8ecff');
      this.skyGradient = grad;
    }
    this.applyEffectiveViewScale();
  }

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clearInputs);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('pointerleave', () => {
      if (!this.mouseDown) {
        this.mouseInCanvas = false;
      }
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.throttleTimerId !== null) clearTimeout(this.throttleTimerId);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clearInputs);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.remove();
  }

  private onVisibilityChange = () => {
    if (document.hidden) this.clearInputs();
  };

  public clearInputs = () => {
    this.keysHeld.clear();
    this.mouseDown = false;
    this.activePointerId = null;
    this.activePointers.clear();
    this.jumpJustPressed = false;
    this.touchState = { left: false, right: false, down: false, jumpHeld: false, punchHeld: false };
    this.punchStick = { active: false, dx: 0, dy: 0 };
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.mode !== 'playing') return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const code = e.code;
    if (
      code === 'Space' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight'
    ) {
      e.preventDefault();
    }

    if ((code === 'Space' || code === 'KeyW' || code === 'ArrowUp') && !this.keysHeld.has(code)) {
      this.jumpJustPressed = true;
    }
    this.keysHeld.add(code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysHeld.delete(e.code);
  };

  private updatePointerCoords(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseScreenX = clientX - rect.left;
    this.mouseScreenY = clientY - rect.top;
    this.mouseInCanvas = true;
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
    if (e.pointerType === 'mouse' || e.pointerId === this.activePointerId) {
      this.updatePointerCoords(e.clientX, e.clientY);
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.mode !== 'playing') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.activePointers.add(e.pointerId);
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
    this.activePointerId = e.pointerId;
    this.updatePointerCoords(e.clientX, e.clientY);
    this.mouseDown = true;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events without active pointer capture
    }
    // Wrench Mode Hit-Test Priority: clicking a nearby player's overhead Wrench badge or character hitbox opens their Public Profile
    if (this.selectedItemId === ITEM_IDS.WRENCH) {
      for (const region of this.playerHitRegions) {
        if (
          this.mouseScreenX >= region.x0 &&
          this.mouseScreenX <= region.x1 &&
          this.mouseScreenY >= region.y0 &&
          this.mouseScreenY <= region.y1
        ) {
          this.mouseDown = false;
          this.punchTimer = 0.25;
          soundEngine.uiClick();
          this.callbacks.onInspectPlayer?.(region.player);
          return;
        }
      }
    }
    if (!this.punchStick.active) {
      this.tryInteractAtCursor();
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    this.activePointers.delete(e.pointerId);
    if (this.activePointerId === e.pointerId) {
      this.mouseDown = false;
      this.activePointerId = null;
    }
  };

  public setTouchMove(dir: 'left' | 'right' | 'down', active: boolean) {
    this.touchState[dir] = active;
  }

  public setTouchJump(active: boolean) {
    if (active && !this.touchState.jumpHeld) {
      this.jumpJustPressed = true;
    }
    this.touchState.jumpHeld = active;
  }

  public setTouchPunch(active: boolean) {
    this.touchState.punchHeld = active;
    if (active) {
      this.tryInteractFacing();
    }
  }

  public setTouchPunchStick(active: boolean, dx = 0, dy = 0) {
    const mag = Math.hypot(dx, dy);
    const clampedDx = mag > 1 ? dx / mag : dx;
    const clampedDy = mag > 1 ? dy / mag : dy;
    this.punchStick = { active, dx: clampedDx, dy: clampedDy };
    this.touchState.punchHeld = active;
    if (active) {
      if (Math.abs(clampedDx) > 0.12) {
        this.body.facing = clampedDx > 0 ? 1 : -1;
      }
      const { tx, ty } = this.getTargetTileFromJoystick();
      this.performTileInteraction(tx, ty);
    }
  }

  public setMode(mode: 'title' | 'playing' | 'paused') {
    this.mode = mode;
    if (mode !== 'playing') {
      this.clearInputs();
    } else {
      this.snapCameraToPlayer();
    }
  }

  public setLocalIdentity(
    id: string,
    name: string,
    shirtColor = '#3f8fd9',
    equipped?: EquippedWearables,
    role: 'player' | 'admin' = 'player'
  ) {
    this.localPlayerId = id;
    this.localPlayerName = name;
    this.localShirtColor = shirtColor;
    if (equipped) this.localEquipped = equipped;
    this.localPlayerRole = role;
  }

  public setLocalEquipped(equipped: EquippedWearables) {
    this.localEquipped = equipped;
  }

  public setSelectedItem(itemId: number) {
    this.selectedItemId = itemId;
  }

  public setAdminBrushItem(brushItemId: number | null) {
    this.adminBrushItemId = brushItemId;
  }

  public setAdminWorldEdit(enabled: boolean, brushItemId: number | null = null) {
    this.adminWorldEdit = enabled;
    this.adminBrushItemId = brushItemId;
  }

  private applyEffectiveViewScale() {
    const configured = Math.max(1, Math.min(2.5, this.gameConfig.mechanics.viewScale || DEFAULT_VIEW_SCALE));
    if (this.cssWidth >= 900 && this.cssHeight >= 520) {
      this.viewScale = configured;
      return;
    }
    const factor = Math.min(this.cssWidth / 900, this.cssHeight / 520);
    this.viewScale = Math.max(0.92, Math.min(configured, Math.round(configured * factor * 20) / 20));
  }

  public applyGameConfig(cfg: GameConfig) {
    this.gameConfig = cloneGameConfig(cfg);
    this.applyEffectiveViewScale();
  }

  public setActiveBuffs(buffs: ActiveBuff[]) {
    this.activeBuffs = buffs;
  }

  private getActiveBuffBonusPct(buffType: 'move_speed' | 'break_speed' | 'luck'): number {
    const now = Date.now();
    let total = 0;
    for (const b of this.activeBuffs) {
      if (b.buffType === buffType && b.expiresAt > now) {
        total += b.bonusPct;
      }
    }
    return total;
  }

  public setFishingCast(cast: FishingCastState) {
    this.activeCasts.set(cast.playerId, cast);
  }

  public markFishingBite(playerId: string) {
    const c = this.activeCasts.get(playerId);
    if (c) c.biting = true;
  }

  public updateFishingProgress(playerId: string, progress: number, lineTension: number, bobberOffset: number, fightPattern: FishingCastState['fightPattern']) {
    const cast = this.activeCasts.get(playerId);
    if (!cast) return;
    cast.pullProgress = Math.max(0, Math.min(100, progress));
    cast.lineTension = Math.max(0, Math.min(1, lineTension));
    cast.bobberOffset = Math.max(-16, Math.min(16, bobberOffset));
    cast.fightPattern = fightPattern;
  }

  public removeFishingCast(playerId: string) {
    this.activeCasts.delete(playerId);
  }

  public applyFluidDeltas(deltas: FluidDelta[]) {
    const { fluidType, fluidLevel } = ensureFluidArrays(this.world);
    for (const d of deltas) {
      if (!inBoundsWorld(this.world, d.tx, d.ty)) continue;
      const idx = tileIndexIn(this.world, d.tx, d.ty);
      fluidType[idx] = d.fluidType;
      fluidLevel[idx] = d.fluidLevel;
    }
  }

  private paintLayerTile(tx: number, ty: number) {
    const w = worldWidth(this.world);
    const h = worldHeight(this.world);
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) return;
    const idx = ty * w + tx;
    const px = tx * TILE_SIZE;
    const py = ty * TILE_SIZE;
    this.worldLayerCtx.clearRect(px, py, TILE_SIZE, TILE_SIZE);
    const bgId = this.world.bg[idx];
    const fgId = this.world.fg[idx];
    const fgDef = CATALOG[fgId];
    const fgTransparent =
      fgId === ITEM_IDS.AIR ||
      !!fgDef?.transparent ||
      fgId === ITEM_IDS.ENTRANCE_PORTAL ||
      fgId === ITEM_IDS.SMALL_LOCK ||
      fgId === ITEM_IDS.LANDLORD_NPC ||
      fgId === ITEM_IDS.GREENS_VENDOR_NPC;

    const aboveFg = ty > 0 ? this.world.fg[(ty - 1) * w + tx] : ITEM_IDS.AIR;
    const belowFg = ty + 1 < h ? this.world.fg[(ty + 1) * w + tx] : ITEM_IDS.BEDROCK;
    const aboveSolid = aboveFg !== ITEM_IDS.AIR && CATALOG[aboveFg]?.collision === 'solid';
    const belowSolid = belowFg !== ITEM_IDS.AIR && CATALOG[belowFg]?.collision === 'solid';

    if (bgId !== ITEM_IDS.BG_SKY && fgTransparent) {
      if (isDoorBlock(bgId) || bgId === ITEM_IDS.STONE_FURNACE) {
        // Draw recessed stone backing wall behind the background door or WorldCore Smeltery Furnace
        this.worldLayerCtx.drawImage(getTileSprite(ITEM_IDS.GP_ROCK_BACKGROUND), px, py, TILE_SIZE, TILE_SIZE);
        this.worldLayerCtx.fillStyle = 'rgba(7, 13, 22, 0.24)';
        this.worldLayerCtx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        this.worldLayerCtx.drawImage(getTileSprite(bgId), px, py, TILE_SIZE, TILE_SIZE);
      } else {
        this.worldLayerCtx.drawImage(getTileSprite(bgId), px, py, TILE_SIZE, TILE_SIZE);
        // Recessed depth tint so background walls sit visually behind foreground blocks
        this.worldLayerCtx.fillStyle = 'rgba(7, 13, 22, 0.24)';
        this.worldLayerCtx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        if (aboveSolid) {
          this.worldLayerCtx.fillStyle = 'rgba(5, 9, 16, 0.36)';
          this.worldLayerCtx.fillRect(px, py, TILE_SIZE, 8);
        }
      }
    }
    if (
      fgId !== ITEM_IDS.AIR &&
      fgId !== ITEM_IDS.LANDLORD_NPC &&
      fgId !== ITEM_IDS.GREENS_VENDOR_NPC
    ) {
      this.worldLayerCtx.drawImage(getTileSprite(fgId), px, py, TILE_SIZE, TILE_SIZE);
      if (fgDef?.collision === 'solid') {
        if (!aboveSolid) {
          this.worldLayerCtx.fillStyle = 'rgba(255, 250, 224, 0.16)';
          this.worldLayerCtx.fillRect(px, py, TILE_SIZE, 3);
        }
        if (!belowSolid) {
          this.worldLayerCtx.fillStyle = 'rgba(6, 11, 18, 0.28)';
          this.worldLayerCtx.fillRect(px, py + TILE_SIZE - 4, TILE_SIZE, 4);
        }
      }
    }
  }

  public updateWorldXp(worldXp: number, worldLevel: number, coreTokens?: number) {
    const prevLevel = this.world.worldLevel ?? 1;
    const prevTokens = this.world.coreTokens ?? 0;
    this.world.worldXp = worldXp;
    this.world.worldLevel = worldLevel;
    if (typeof coreTokens === 'number') {
      this.world.coreTokens = coreTokens;
      if (coreTokens > prevTokens) {
        const px = this.body.x + PLAYER_WIDTH * 0.5;
        const py = this.body.y - 18;
        this.spawnRing(px, py, 38, '#38bdf8', 0.45);
        this.spawnSparks(px, py, 14, '#38bdf8');
        this.spawnPopup(px, py - 14, '+1 CORE TOKEN!', '#38bdf8');
      }
    }
    if (worldLevel > prevLevel) {
      const px = this.body.x + PLAYER_WIDTH * 0.5;
      const py = this.body.y - 12;
      this.spawnRing(px, py, 44, '#fde047', 0.55);
      this.spawnSparks(px, py, 16, '#fde047');
      this.spawnPopup(px, py - 10, `WORLD LEVEL ${worldLevel}!`, '#fde047');
    }
  }

  public teleportLocalPlayer(tx: number, ty: number) {
    const nextBody = createPlayerBody(tx, ty);
    this.body.x = nextBody.x;
    this.body.y = nextBody.y;
    this.body.vx = 0;
    this.body.vy = 0;
    const px = this.body.x + PLAYER_WIDTH * 0.5;
    const py = this.body.y + PLAYER_HEIGHT * 0.5;
    this.spawnRing(px, py, 36, '#38bdf8', 0.35);
    this.spawnSparks(px, py, 12, '#7dd3fc');
    this.snapCameraToPlayer();
  }

  private rebuildWorldLayer() {
    const w = worldWidth(this.world);
    const h = worldHeight(this.world);
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        this.paintLayerTile(tx, ty);
      }
    }
  }

  public getWorldState(): WorldState {
    return this.world;
  }

  public getWorldRevision(): number {
    return this.world.revision ?? 0;
  }

  public getLocalPose() {
    return {
      x: this.body.x,
      y: this.body.y,
      vx: this.body.vx,
      vy: this.body.vy,
      facing: this.body.facing,
      grounded: this.body.grounded,
    };
  }

  public syncPresenceAndDrops(players: RemotePlayerState[], drops: WorldDrop[], revision?: number) {
    if (typeof revision === 'number' && revision > (this.world.revision ?? 0)) {
      this.world.revision = revision;
    }
    const seenIds = new Set<string>();
    for (const p of players) {
      if (p.id === this.localPlayerId) continue;
      seenIds.add(p.id);
      this.updateRemotePlayer(p);
    }
    for (const existingId of Array.from(this.remotePlayers.keys())) {
      if (!seenIds.has(existingId)) {
        this.remotePlayers.delete(existingId);
        this.activeCasts.delete(existingId);
      }
    }

    const seenDropIds = new Set<string>();
    for (const d of drops) {
      seenDropIds.add(d.id);
      this.drops.set(d.id, d);
    }
    for (const existingDropId of Array.from(this.drops.keys())) {
      if (!seenDropIds.has(existingDropId)) {
        this.drops.delete(existingDropId);
        this.pickupAttempted.delete(existingDropId);
      }
    }
  }

  public loadWorld(
    world: WorldState,
    players: RemotePlayerState[],
    drops: WorldDrop[],
    options?: { preserveLocalPose?: boolean }
  ) {
    const isSameWorldReconnect =
      Boolean(options?.preserveLocalPose) &&
      this.mode !== 'title' &&
      this.world?.name === world.name;
    const prevBody = isSameWorldReconnect ? { ...this.body } : null;

    this.world = world;
    this.world.areaLocks = this.world.areaLocks ?? {};
    this.world.vendingMachines = this.world.vendingMachines ?? {};
    this.world.signs = this.world.signs ?? {};
    this.world.furnaces = this.world.furnaces ?? {};
    this.world.bfgCollectors = this.world.bfgCollectors ?? {};
    this.world.seedPots = this.world.seedPots ?? {};
    this.world.matteragenEngines = this.world.matteragenEngines ?? {};
    this.world.atmMachines = this.world.atmMachines ?? {};
    this.world.vaultboxes = this.world.vaultboxes ?? {};
    this.world.doorLinks = this.world.doorLinks ?? {};
    this.world.coreTokens = this.world.coreTokens ?? 0;
    this.tileAnims.clear();
    this.popups = [];
    ensureFluidArrays(this.world);

    const wPx = worldWidth(this.world) * TILE_SIZE;
    const hPx = worldHeight(this.world) * TILE_SIZE;
    if (this.worldLayerCanvas.width !== wPx || this.worldLayerCanvas.height !== hPx) {
      this.worldLayerCanvas.width = wPx;
      this.worldLayerCanvas.height = hPx;
      this.worldLayerCtx.imageSmoothingEnabled = false;
    }

    this.rebuildWorldLayer();

    const serverSelf = players.find((p) => p.id === this.localPlayerId);
    if (prevBody) {
      this.body = prevBody;
    } else if (serverSelf && options?.preserveLocalPose) {
      this.body = {
        ...createPlayerBody(world.spawnX, world.spawnY),
        x: serverSelf.x,
        y: serverSelf.y,
        vx: serverSelf.vx,
        vy: serverSelf.vy,
        facing: serverSelf.facing,
        grounded: serverSelf.grounded,
      };
    } else {
      this.body = createPlayerBody(world.spawnX, world.spawnY);
    }

    this.remotePlayers.clear();
    for (const p of players) {
      if (p.id !== this.localPlayerId) {
        this.remotePlayers.set(p.id, { ...p, renderX: p.x, renderY: p.y });
      }
    }
    this.drops.clear();
    for (const d of drops) {
      this.drops.set(d.id, d);
    }
    this.cracks.clear();
    this.pickupAttempted.clear();
    this.activeCasts.clear();
    if (!prevBody) {
      this.snapCameraToPlayer();
    }
  }

  public addRemotePlayer(p: RemotePlayerState) {
    if (p.id === this.localPlayerId) return;
    this.remotePlayers.set(p.id, { ...p, renderX: p.x, renderY: p.y });
  }

  public removeRemotePlayer(playerId: string) {
    this.remotePlayers.delete(playerId);
    this.activeCasts.delete(playerId);
  }

  public updateRemotePlayer(p: RemotePlayerState) {
    if (p.id === this.localPlayerId) return;
    const existing = this.remotePlayers.get(p.id);
    if (existing) {
      existing.x = p.x;
      existing.y = p.y;
      existing.vx = p.vx;
      existing.vy = p.vy;
      existing.facing = p.facing;
      existing.grounded = p.grounded;
      existing.punching = p.punching;
      existing.placing = p.placing;
      existing.level = p.level;
      existing.equipped = p.equipped;
    } else {
      this.remotePlayers.set(p.id, { ...p, renderX: p.x, renderY: p.y });
    }
  }

  public applyTileDamaged(tx: number, ty: number, hits: number, maxHits: number) {
    const key = `${tx},${ty}`;
    this.cracks.set(key, { hits, maxHits, expiresAt: performance.now() + 4000 });
    const idx = tileIndexIn(this.world, tx, ty);
    const fgId = this.world.fg[idx];
    const plant = this.world.plants[key];
    const bgId = this.world.bg[idx];
    const targetId = fgId !== ITEM_IDS.AIR ? fgId : plant ? plant.seedId : bgId;
    const def =
      getEffectiveItemDef(fgId, this.gameConfig) ??
      (plant ? getEffectiveItemDef(plant.seedId, this.gameConfig) : undefined) ??
      getEffectiveItemDef(bgId, this.gameConfig);
    soundEngine.hitBlock(targetId, this.selectedItemId, hits / Math.max(1, maxHits));

    const cxWorld = tx * TILE_SIZE + TILE_SIZE * 0.5;
    const cyWorld = ty * TILE_SIZE + TILE_SIZE * 0.5;
    const pCx = this.body.x + PLAYER_WIDTH * 0.5;
    const pCy = this.body.y + PLAYER_HEIGHT * 0.5;
    const dirX = cxWorld >= pCx ? 1 : -1;
    const dirY = cyWorld >= pCy ? 1 : -1;

    this.tileAnims.set(key, {
      kind: 'hit',
      startedAt: performance.now(),
      durationMs: 165,
      dirX,
      dirY,
      itemId: targetId,
    });

    const primary = def?.colorPrimary ?? '#a88462';
    const secondary = def?.colorSecondary ?? primary;
    const accent = def?.colorAccent ?? '#ffffff';

    this.spawnShards(cxWorld, cyWorld, 7, primary, secondary, accent, dirX);
    this.spawnSparks(cxWorld, cyWorld, 5, accent);
    if (hits >= Math.ceil(maxHits * 0.5)) {
      this.spawnRing(cxWorld, cyWorld, 20, accent, 0.22);
    }
    this.shakeTrauma = Math.min(0.32, this.shakeTrauma + 0.06);
  }

  public applyTileUpdated(
    tx: number,
    ty: number,
    fg: number,
    bg: number,
    plant: PlantedTree | null,
    worldLock?: WorldLockRecord | null,
    areaLock?: AreaLockRecord | null,
    shareLock?: ShareLockRecord | null,
    vendingMachine?: VendingMachineRecord | null,
    signText?: string | null,
    fluidType?: number,
    fluidLevel?: number,
    furnace?: FurnaceRecord | null,
    bfgCollector?: BfgCollectorRecord | null,
    seedPot?: SeedPotRecord | null,
    matteragenEngine?: MatteragenRecord | null,
    atmMachine?: AtmMachineRecord | null,
    vaultbox?: VaultboxRecord | null,
    doorLink?: DoorLinkRecord | null
  ) {
    const idx = tileIndexIn(this.world, tx, ty);
    const key = `${tx},${ty}`;
    const prevFg = this.world.fg[idx];
    const prevBg = this.world.bg[idx];
    const prevPlant = this.world.plants[key];
    const prevEng = this.world.matteragenEngines?.[key];
    const prevAtm = this.world.atmMachines?.[key];

    this.world.fg[idx] = fg;
    this.world.bg[idx] = bg;

    ensureFluidArrays(this.world);
    if (fluidType !== undefined) this.world.fluidType![idx] = fluidType;
    if (fluidLevel !== undefined) this.world.fluidLevel![idx] = fluidLevel;

    if (plant) {
      this.world.plants[key] = plant;
    } else {
      delete this.world.plants[key];
    }
    if (worldLock !== undefined) {
      this.world.worldLock = worldLock;
    }
    this.world.areaLocks = this.world.areaLocks ?? {};
    if (areaLock !== undefined) {
      if (areaLock) this.world.areaLocks[key] = areaLock;
      else delete this.world.areaLocks[key];
    }
    this.world.shareLocks = this.world.shareLocks ?? {};
    if (shareLock !== undefined) {
      if (shareLock) this.world.shareLocks[key] = shareLock;
      else delete this.world.shareLocks[key];
    }
    this.world.vendingMachines = this.world.vendingMachines ?? {};
    if (vendingMachine !== undefined) {
      if (vendingMachine) this.world.vendingMachines[key] = vendingMachine;
      else delete this.world.vendingMachines[key];
    }
    this.world.furnaces = this.world.furnaces ?? {};
    if (furnace !== undefined) {
      if (furnace) this.world.furnaces[key] = furnace;
      else delete this.world.furnaces[key];
    }
    this.world.bfgCollectors = this.world.bfgCollectors ?? {};
    if (bfgCollector !== undefined) {
      if (bfgCollector) this.world.bfgCollectors[key] = bfgCollector;
      else delete this.world.bfgCollectors[key];
    }
    this.world.seedPots = this.world.seedPots ?? {};
    if (seedPot !== undefined) {
      if (seedPot) this.world.seedPots[key] = seedPot;
      else delete this.world.seedPots[key];
    }
    this.world.matteragenEngines = this.world.matteragenEngines ?? {};
    if (matteragenEngine !== undefined) {
      if (matteragenEngine) this.world.matteragenEngines[key] = matteragenEngine;
      else delete this.world.matteragenEngines[key];
    }
    this.world.atmMachines = this.world.atmMachines ?? {};
    if (atmMachine !== undefined) {
      if (atmMachine) this.world.atmMachines[key] = atmMachine;
      else delete this.world.atmMachines[key];
    }
    this.world.vaultboxes = this.world.vaultboxes ?? {};
    if (vaultbox !== undefined) {
      if (vaultbox) this.world.vaultboxes[key] = vaultbox;
      else delete this.world.vaultboxes[key];
    }
    this.world.signs = this.world.signs ?? {};
    if (signText !== undefined) {
      if (signText) this.world.signs[key] = signText;
      else delete this.world.signs[key];
    }
    this.world.doorLinks = this.world.doorLinks ?? {};
    if (doorLink !== undefined) {
      if (doorLink) this.world.doorLinks[key] = doorLink;
      else delete this.world.doorLinks[key];
    }

    this.paintLayerTile(tx, ty);
    this.paintLayerTile(tx, ty - 1);
    this.paintLayerTile(tx, ty + 1);
    this.cracks.delete(key);

    const cxWorld = tx * TILE_SIZE + TILE_SIZE * 0.5;
    const cyWorld = ty * TILE_SIZE + TILE_SIZE * 0.5;

    if (prevAtm?.isReady && atmMachine && !atmMachine.isReady) {
      // ATM Payout collected!
      this.spawnSparks(cxWorld, cyWorld, 18, '#fde047');
      this.spawnRing(cxWorld, cyWorld, 36, '#38e8d8', 0.34);
      this.spawnPopup(cxWorld, cyWorld - 14, `+${prevAtm.storedGems} GEMS!`, '#fde047');
      this.tileAnims.set(key, {
        kind: 'hit',
        startedAt: performance.now(),
        durationMs: 180,
        dirX: 0,
        dirY: -1,
        itemId: ITEM_IDS.ATM_MACHINE,
      });
      this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.18);
      soundEngine.gem();
    } else if (prevEng?.isReady && matteragenEngine && !matteragenEngine.isReady) {
      // Matteragen Yield collected!
      this.spawnSparks(cxWorld, cyWorld, 16, '#34d399');
      this.spawnRing(cxWorld, cyWorld, 34, '#34d399', 0.32);
      this.spawnPopup(cxWorld, cyWorld - 14, 'SYNTH COLLECTED!', '#a7f3d0');
      this.tileAnims.set(key, {
        kind: 'hit',
        startedAt: performance.now(),
        durationMs: 180,
        dirX: 0,
        dirY: -1,
        itemId: matteragenEngine.typeId,
      });
      this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.16);
      soundEngine.unlock();
    } else if (prevFg !== ITEM_IDS.AIR && fg === ITEM_IDS.AIR) {
      const def = getItemDef(prevFg);
      this.spawnShards(
        cxWorld,
        cyWorld,
        16,
        def?.colorPrimary ?? '#9c6e49',
        def?.colorSecondary ?? '#6b4222',
        def?.colorAccent ?? '#ffffff',
        0
      );
      this.spawnSparks(cxWorld, cyWorld, 8, def?.colorAccent ?? '#ffffff');
      this.spawnDust(cxWorld, cyWorld, 6, def?.colorPrimary ?? '#9c6e49');
      this.spawnRing(cxWorld, cyWorld, 30, def?.colorAccent ?? '#ffffff', 0.28);
      this.tileAnims.delete(key);
      this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.26);
      this.hitstopTimer = 0.028;
      soundEngine.breakBlock(prevFg);
    } else if (prevPlant && !plant) {
      const seedDef = getItemDef(prevPlant.seedId);
      this.spawnShards(
        cxWorld,
        cyWorld,
        14,
        seedDef?.colorPrimary ?? '#5fc95a',
        seedDef?.colorSecondary ?? '#2d7a36',
        seedDef?.colorAccent ?? '#e8ffad',
        0
      );
      this.spawnSparks(cxWorld, cyWorld, 10, seedDef?.colorAccent ?? '#e8ffad');
      this.spawnRing(cxWorld, cyWorld, 28, '#82e068', 0.26);
      this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.18);
      soundEngine.breakBlock(prevPlant.seedId);
    } else if (prevBg !== ITEM_IDS.BG_SKY && bg === ITEM_IDS.BG_SKY) {
      const bgDef = getItemDef(prevBg);
      this.spawnShards(
        cxWorld,
        cyWorld,
        12,
        bgDef?.colorPrimary ?? '#7c6b5e',
        bgDef?.colorSecondary ?? '#52443b',
        bgDef?.colorAccent ?? '#c7b8ac',
        0
      );
      this.spawnDust(cxWorld, cyWorld, 5, bgDef?.colorPrimary ?? '#7c6b5e');
      this.spawnRing(cxWorld, cyWorld, 24, bgDef?.colorAccent ?? '#c7b8ac', 0.24);
      this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.18);
      soundEngine.breakBlock(prevBg);
    } else if ((prevFg === ITEM_IDS.AIR && fg !== ITEM_IDS.AIR) || (!prevPlant && plant) || (prevBg === ITEM_IDS.BG_SKY && bg !== ITEM_IDS.BG_SKY)) {
      const placedId = fg !== ITEM_IDS.AIR ? fg : plant ? plant.seedId : bg;
      const def = getItemDef(placedId);
      this.tileAnims.set(key, {
        kind: 'place',
        startedAt: performance.now(),
        durationMs: 210,
        dirX: 0,
        dirY: 1,
        itemId: placedId,
      });
      this.spawnDust(cxWorld, ty * TILE_SIZE + TILE_SIZE - 4, 6, def?.colorAccent ?? '#e2f0d9');
      this.spawnSparks(cxWorld, cyWorld, 6, def?.colorAccent ?? '#ffffff');
      this.spawnRing(cxWorld, cyWorld, 22, def?.colorAccent ?? '#ffffff', 0.22);
    } else if (fg !== ITEM_IDS.AIR) {
      const def = getItemDef(fg);
      this.spawnSparks(cxWorld, cyWorld, 5, def?.colorAccent ?? '#ffffff');
    }
  }

  public addDrop(drop: WorldDrop) {
    this.drops.set(drop.id, drop);
  }

  public removeDrop(dropId: string) {
    this.drops.delete(dropId);
    this.pickupAttempted.delete(dropId);
  }

  private getTargetTileFromCursor(): { tx: number; ty: number } {
    if (!this.mouseInCanvas) {
      return this.getTargetTileFacing();
    }
    const worldX = this.mouseScreenX / this.viewScale + this.camX;
    const worldY = this.mouseScreenY / this.viewScale + this.camY;
    return {
      tx: Math.floor(worldX / TILE_SIZE),
      ty: Math.floor(worldY / TILE_SIZE),
    };
  }

  private getTargetTileFacing(): { tx: number; ty: number } {
    const pcx = Math.floor((this.body.x + PLAYER_WIDTH * 0.5) / TILE_SIZE);
    const pcy = Math.floor((this.body.y + PLAYER_HEIGHT * 0.5) / TILE_SIZE);
    return {
      tx: Math.max(0, Math.min(worldWidth(this.world) - 1, pcx + this.body.facing)),
      ty: Math.max(0, Math.min(worldHeight(this.world) - 1, pcy)),
    };
  }

  private getTargetTileFromJoystick(): { tx: number; ty: number } {
    const mag = Math.hypot(this.punchStick.dx, this.punchStick.dy);
    if (mag < 0.18) {
      return this.getTargetTileFacing();
    }
    const dirX = this.punchStick.dx / mag;
    const dirY = this.punchStick.dy / mag;
    const pcx = (this.body.x + PLAYER_WIDTH * 0.5) / TILE_SIZE;
    const pcy = (this.body.y + PLAYER_HEIGHT * 0.5) / TILE_SIZE;
    const ptx = Math.floor(pcx);
    const pty = Math.floor(pcy);
    const playerCtx = {
      id: this.localPlayerId,
      x: this.body.x,
      y: this.body.y,
      adminWorldEdit: this.adminWorldEdit,
    };
    const reach = this.adminWorldEdit
      ? Math.max(12, this.gameConfig.mechanics.reachTiles)
      : this.gameConfig.mechanics.reachTiles;
    const w = worldWidth(this.world);
    const h = worldHeight(this.world);
    const activeItemId = this.getEffectiveInteractItemId();
    const selectedDef = getItemDef(activeItemId);
    const isBreakTool = activeItemId === ITEM_IDS.FIST || selectedDef?.toolKind === 'pickaxe';
    const strongVertical = Math.abs(dirY) > 0.78;

    const rayTiles: Array<{ tx: number; ty: number }> = [];
    let prevKey = '';
    for (let d = 0.55; d <= reach; d += 0.16) {
      const tx = Math.max(0, Math.min(w - 1, Math.floor(pcx + dirX * d)));
      const ty = Math.max(0, Math.min(h - 1, Math.floor(pcy + dirY * d)));
      const key = `${tx},${ty}`;
      if (key === prevKey) continue;
      prevKey = key;
      rayTiles.push({ tx, ty });
    }

    const inFrontTiles = rayTiles.filter(({ tx, ty }) => tx !== ptx || ty !== pty || strongVertical);
    const firstFrontTile = inFrontTiles[0] ?? this.getTargetTileFacing();

    if (isBreakTool) {
      // Pass 1: Prefer foreground blocks, plants, or interactables in front along the joystick ray
      for (const { tx, ty } of inFrontTiles) {
        const idx = tileIndexIn(this.world, tx, ty);
        const fgId = this.world.fg[idx];
        const hasPlant = Boolean(this.world.plants[`${tx},${ty}`]);
        if (fgId !== ITEM_IDS.AIR || hasPlant || getMarketStandAt(this.world, tx, ty)) {
          if (canBreakTile(this.world, playerCtx, tx, ty, reach).ok) {
            return { tx, ty };
          }
          if (
            CATALOG[fgId]?.collision === 'solid' ||
            Boolean(CATALOG[fgId]?.key.includes('sign')) ||
            Boolean(getMarketStandAt(this.world, tx, ty)) ||
            fgId === ITEM_IDS.VENDING_MACHINE ||
            fgId === ITEM_IDS.WORLD_LOCK ||
            fgId === ITEM_IDS.SMALL_LOCK ||
            fgId === ITEM_IDS.STONE_FURNACE ||
            fgId === ITEM_IDS.BFG_COLLECTOR ||
            fgId === ITEM_IDS.EXCHANGE_TERMINAL ||
            fgId === ITEM_IDS.LANDLORD_NPC ||
            fgId === ITEM_IDS.GREENS_VENDOR_NPC ||
            fgId === ITEM_IDS.WORLD_CORE ||
            fgId === ITEM_IDS.SEED_POT ||
            fgId === ITEM_IDS.ATM_MACHINE ||
            fgId === ITEM_IDS.VAULTBOX
          ) {
            return { tx, ty };
          }
        }
      }
      // Pass 2: Break background tiles in front if no foreground target was hit
      for (const { tx, ty } of inFrontTiles) {
        if (canBreakTile(this.world, playerCtx, tx, ty, reach).ok) {
          return { tx, ty };
        }
      }
      // Pass 3: Fallback to player's own tile if aiming straight down/up
      if (canBreakTile(this.world, playerCtx, ptx, pty, reach).ok) {
        return { tx: ptx, ty: pty };
      }
      return firstFrontTile;
    }

    if (activeItemId === ITEM_IDS.WRENCH) {
      for (const { tx, ty } of inFrontTiles) {
        const idx = tileIndexIn(this.world, tx, ty);
        if (this.world.fg[idx] !== ITEM_IDS.AIR || getMarketStandAt(this.world, tx, ty)) {
          return { tx, ty };
        }
      }
      return firstFrontTile;
    }

    if (selectedDef?.toolKind === 'hoe') {
      for (const { tx, ty } of rayTiles) {
        if (canPlowTile(this.world, playerCtx, tx, ty, reach).ok) {
          return { tx, ty };
        }
      }
      return firstFrontTile;
    }

    if (selectedDef?.toolKind === 'rod') {
      for (const { tx, ty } of inFrontTiles) {
        const idx = tileIndexIn(this.world, tx, ty);
        if ((this.world.fluidLevel?.[idx] ?? 0) > 0) {
          return { tx, ty };
        }
      }
      return firstFrontTile;
    }

    // Placing blocks / seeds / backgrounds / locks / machines: prioritize tiles in front first
    for (const { tx, ty } of inFrontTiles) {
      if (canPlaceTile(this.world, playerCtx, activeItemId, tx, ty, reach).ok) {
        return { tx, ty };
      }
      const idx = tileIndexIn(this.world, tx, ty);
      const fgId = this.world.fg[idx];
      if (
        selectedDef?.category !== 'background' &&
        fgId !== ITEM_IDS.AIR &&
        CATALOG[fgId]?.collision === 'solid'
      ) {
        return firstFrontTile;
      }
    }

    for (const { tx, ty } of rayTiles) {
      if (canPlaceTile(this.world, playerCtx, activeItemId, tx, ty, reach).ok) {
        return { tx, ty };
      }
    }

    return firstFrontTile;
  }

  private getEffectiveInteractItemId(): number {
    return this.selectedItemId;
  }

  private tryInteractFacing() {
    const { tx, ty } = this.getTargetTileFacing();
    this.performTileInteraction(tx, ty);
  }

  private tryInteractAtCursor() {
    const { tx, ty } = this.getTargetTileFromCursor();
    this.performTileInteraction(tx, ty);
  }

  public emitInspectAt(tx: number, ty: number, quiet = false) {
    if (!inBoundsWorld(this.world, tx, ty)) return;
    const idx = tileIndexIn(this.world, tx, ty);
    const key = `${tx},${ty}`;
    const rawFgId = this.world.fg[idx];
    const stand = getMarketStandAt(this.world, tx, ty);
    const fgId = stand ? stand.itemId : rawFgId;
    const fgDef = getItemDef(fgId);
    const bgId = this.world.bg[idx];
    const bgDef = getItemDef(bgId);
    const plant = this.world.plants[key];
    let plantInfo: string | undefined;
    if (plant) {
      const g = getPlantGrowthState(plant, Date.now());
      const seedDef = getItemDef(plant.seedId);
      const remaining = Math.max(0, Math.ceil(g.remainingMs / 1000));
      const timeLabel = remaining >= 60 ? `${Math.floor(remaining / 60)}m ${remaining % 60}s` : `${remaining}s`;
      plantInfo = `${seedDef?.name ?? 'Seed'} · Stage ${g.visualStageIndex + 1}/4 · ${Math.round(g.progress * 100)}% · ${g.stage === 'mature' ? 'Ready' : timeLabel}`;
    }

    const coveringAreaLock = getCoveringAreaLock(this.world, tx, ty);
    const coveringShareLock = getCoveringShareLock(this.world, tx, ty);
    const directAreaLock = this.world.areaLocks?.[key] ?? coveringAreaLock ?? null;
    const shareLock = this.world.shareLocks?.[key] ?? coveringShareLock;
    const lockInfo = shareLock
      ? `${shareLock.width}×${shareLock.height} Share Lock by ${shareLock.ownerName}`
      : directAreaLock
        ? `Area Lock by ${directAreaLock.ownerName}`
        : this.world.worldLock
          ? `Owned by ${this.world.worldLock.ownerName}`
          : 'Unlocked';

    const isDoor = isDoorBlock(bgId) || isDoorBlock(fgId);
    const isFurnaceTile = fgId === ITEM_IDS.STONE_FURNACE || bgId === ITEM_IDS.STONE_FURNACE;

    if (!quiet) soundEngine.uiClick();
    this.callbacks.onInspectTile?.({
      tx: stand ? stand.anchorX : tx,
      ty: stand ? stand.anchorY : ty,
      fgId: fgId === ITEM_IDS.AIR && bgId === ITEM_IDS.STONE_FURNACE ? ITEM_IDS.STONE_FURNACE : fgId,
      fgName:
        fgId === ITEM_IDS.AIR && bgId === ITEM_IDS.STONE_FURNACE
          ? (bgDef?.name ?? 'Smeltery Furnace')
          : (fgDef?.name ?? 'Air'),
      bgName: bgDef?.name ?? 'Open Sky',
      plantInfo,
      lockInfo,
      worldLock: fgId === ITEM_IDS.WORLD_CORE || fgId === ITEM_IDS.WORLD_LOCK ? this.world.worldLock : null,
      areaLock: fgId === ITEM_IDS.SMALL_LOCK ? (this.world.areaLocks?.[key] ?? null) : coveringAreaLock,
      shareLock: this.world.shareLocks?.[key] ?? null,
      isLandlord: stand?.kind === 'landlord' || fgId === ITEM_IDS.LANDLORD_NPC,
      isGreensVendor: stand?.kind === 'greens_vendor' || fgId === ITEM_IDS.GREENS_VENDOR_NPC,
      isWorldCore: fgId === ITEM_IDS.WORLD_CORE,
      vendingMachine: fgId === ITEM_IDS.VENDING_MACHINE ? (this.world.vendingMachines?.[key] ?? null) : null,
      furnace: isFurnaceTile
        ? (this.world.furnaces?.[key] ?? {
            x: tx,
            y: ty,
            ownerId: this.world.worldLock?.ownerId ?? '',
            recipeId: null,
            startedAt: null,
            finishesAt: null,
            readyOutputItemId: 0,
            readyOutputQty: 0,
          })
        : null,
      bfgCollector: fgId === ITEM_IDS.BFG_COLLECTOR ? (this.world.bfgCollectors?.[key] ?? null) : null,
      isExchangeTerminal: fgId === ITEM_IDS.EXCHANGE_TERMINAL,
      signText: !!CATALOG[fgId]?.key.includes('sign') ? (this.world.signs?.[key] ?? '') : null,
      matteragenEngine:
        fgId >= ITEM_IDS.MATTERAGEN_BOTANICAL && fgId <= ITEM_IDS.MATTERAGEN_COSMIC
          ? (this.world.matteragenEngines?.[key] ?? null)
          : null,
      atmMachine: fgId === ITEM_IDS.ATM_MACHINE ? (this.world.atmMachines?.[key] ?? null) : null,
      vaultbox: fgId === ITEM_IDS.VAULTBOX ? (this.world.vaultboxes?.[key] ?? null) : null,
      bgId,
      isDoor,
      isNexusDoor: isDoor && this.world.name === 'NEXUS',
      doorLink: isDoor ? (this.world.doorLinks?.[key] ?? null) : null,
    });
  }

  private performTileInteraction(tx: number, ty: number) {
    if (this.punchTimer > 0) return;
    if (!inBoundsWorld(this.world, tx, ty)) return;
    const playerCtx = {
      id: this.localPlayerId,
      x: this.body.x,
      y: this.body.y,
      adminWorldEdit: this.adminWorldEdit,
    };
    const reach = this.adminWorldEdit
      ? Math.max(12, this.gameConfig.mechanics.reachTiles)
      : this.gameConfig.mechanics.reachTiles;
    const activeItemId = this.getEffectiveInteractItemId();
    const selectedDef = getItemDef(activeItemId);

    if (activeItemId === ITEM_IDS.WRENCH) {
      this.punchTimer = 0.25;
      this.emitInspectAt(tx, ty);
      return;
    }

    // Tapping WorldCore, a 3x2 Market Stand, background Smeltery Furnace, ready Matteragen Engine, or Doorway opens its panel
    const tileIdx = tileIndexIn(this.world, tx, ty);
    const targetFgId = this.world.fg[tileIdx];
    const targetBgId = this.world.bg[tileIdx];
    const targetKey = `${tx},${ty}`;
    const targetHasDoor = isDoorBlock(targetBgId) || isDoorBlock(targetFgId);
    const isBreakTool = activeItemId === ITEM_IDS.FIST || selectedDef?.toolKind === 'pickaxe';
    const isMatteragenFg =
      targetFgId >= ITEM_IDS.MATTERAGEN_BOTANICAL && targetFgId <= ITEM_IDS.MATTERAGEN_COSMIC;
    const matteragenState = isMatteragenFg ? this.world.matteragenEngines?.[targetKey] : null;

    if (!(this.adminWorldEdit && isBreakTool)) {
      if (targetHasDoor && this.world.name === 'NEXUS') {
        this.punchTimer = 0.25;
        this.punchAnimTimer = PUNCH_ANIM_DURATION;
        this.emitInspectAt(tx, ty);
        return;
      }
      if (targetHasDoor && this.world.doorLinks?.[targetKey] && activeItemId === ITEM_IDS.FIST) {
        this.punchTimer = 0.25;
        this.punchAnimTimer = PUNCH_ANIM_DURATION;
        soundEngine.uiClick();
        this.callbacks.onUseDoor?.(tx, ty);
        return;
      }
      if (
        targetFgId === ITEM_IDS.WORLD_CORE ||
        Boolean(getMarketStandAt(this.world, tx, ty)) ||
        (targetFgId === ITEM_IDS.AIR && targetBgId === ITEM_IDS.STONE_FURNACE) ||
        (isMatteragenFg && matteragenState?.isReady)
      ) {
        this.punchTimer = 0.25;
        this.emitInspectAt(tx, ty);
        return;
      }
    }

    if (selectedDef?.category === 'consumable') {
      this.punchTimer = 0.4;
      soundEngine.uiClick();
      this.callbacks.onUseConsumable?.(activeItemId);
      return;
    }

    if (selectedDef?.toolKind === 'hoe') {
      this.punchTimer = 0.22;
      this.punchAnimTimer = PUNCH_ANIM_DURATION;
      const check = canPlowTile(this.world, playerCtx, tx, ty, reach);
      soundEngine.swingTool(activeItemId);
      if (check.ok) {
        const cx = tx * TILE_SIZE + TILE_SIZE * 0.5;
        const cy = ty * TILE_SIZE + 8;
        this.spawnDust(cx, cy, 8, '#8b5a2b');
        this.spawnSparks(cx, cy, 5, '#fde047');
        this.callbacks.onPlowTile?.(tx, ty, this.adminWorldEdit);
      } else {
        this.emitInspectAt(tx, ty);
      }
      return;
    }

    if (selectedDef?.toolKind === 'rod') {
      if (this.activeCasts.has(this.localPlayerId)) {
        this.punchTimer = 0.35;
        soundEngine.reelTick(0.45);
        this.callbacks.onReelFishing?.();
      } else {
        this.punchTimer = 0.45;
        soundEngine.castRod();
        this.callbacks.onCastFishing?.(tx, ty, activeItemId);
      }
      return;
    }

    if (activeItemId === ITEM_IDS.FIST || selectedDef?.toolKind === 'pickaxe') {
      const baseCd = this.gameConfig.mechanics.punchCooldownMs / 1000;
      const toolFactor =
        selectedDef?.toolKind === 'pickaxe'
          ? (selectedDef.toolPower ?? 2) >= 4
            ? 0.72
            : (selectedDef.toolPower ?? 2) >= 3
              ? 0.82
              : 0.90
          : 1;
      const buffFactor = this.getActiveBuffBonusPct('break_speed') > 0 ? 0.75 : 1;
      this.punchTimer = this.adminWorldEdit ? 0.08 : Math.max(0.08, baseCd * toolFactor * buffFactor);
      this.punchAnimTimer = PUNCH_ANIM_DURATION;
      const check = canBreakTile(this.world, playerCtx, tx, ty, reach);
      soundEngine.swingTool(activeItemId);
      if (check.ok) {
        this.callbacks.onPunchTile?.(tx, ty, activeItemId, this.adminWorldEdit);
      } else {
        const fgId = this.world.fg[tileIndexIn(this.world, tx, ty)];
        if (
          fgId === ITEM_IDS.VENDING_MACHINE ||
          fgId === ITEM_IDS.WORLD_LOCK ||
          fgId === ITEM_IDS.SMALL_LOCK ||
          fgId === ITEM_IDS.STONE_FURNACE ||
          targetBgId === ITEM_IDS.STONE_FURNACE ||
          fgId === ITEM_IDS.BFG_COLLECTOR ||
          fgId === ITEM_IDS.EXCHANGE_TERMINAL ||
          fgId === ITEM_IDS.LANDLORD_NPC ||
          fgId === ITEM_IDS.GREENS_VENDOR_NPC ||
          fgId === ITEM_IDS.WORLD_CORE ||
          fgId === ITEM_IDS.ATM_MACHINE ||
          fgId === ITEM_IDS.VAULTBOX ||
          targetHasDoor ||
          (fgId >= ITEM_IDS.MATTERAGEN_BOTANICAL && fgId <= ITEM_IDS.MATTERAGEN_COSMIC)
        ) {
          this.emitInspectAt(tx, ty);
        }
      }
      return;
    }

    // Placing block / background / seed / lock / fluid / machine
    this.punchTimer = this.adminWorldEdit ? 0.09 : PLACE_COOLDOWN;
    const check = canPlaceTile(this.world, playerCtx, activeItemId, tx, ty, reach);
    if (check.ok) {
      this.placeAnimTimer = PLACE_ANIM_DURATION;
      if (check.layer === 'seed') soundEngine.plant();
      else soundEngine.placeBlock(activeItemId);
      this.callbacks.onPlaceTile?.(tx, ty, activeItemId, this.adminWorldEdit);
    }
  }

  private allocParticle(): Particle {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;
    return p;
  }

  private spawnShards(
    x: number,
    y: number,
    count: number,
    primary: string,
    secondary: string,
    accent: string,
    biasX: number
  ) {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      p.active = true;
      p.shape = 'shard';
      p.x = x + (Math.random() - 0.5) * 16;
      p.y = y + (Math.random() - 0.5) * 16;
      const ang = Math.random() * Math.PI * 2;
      const spd = 55 + Math.random() * 165;
      p.vx = Math.cos(ang) * spd + biasX * (35 + Math.random() * 45);
      p.vy = Math.sin(ang) * spd - 95 - Math.random() * 60;
      p.maxLife = 0.34 + Math.random() * 0.32;
      p.life = p.maxLife;
      p.size = 5 + Math.floor(Math.random() * 5);
      p.endSize = 2;
      p.gravity = 520;
      p.drag = 0.965;
      p.rot = Math.random() * Math.PI * 2;
      p.vRot = (Math.random() - 0.5) * 18;
      p.color = i % 3 === 0 ? secondary : primary;
      p.accentColor = accent;
    }
  }

  private spawnSparks(x: number, y: number, count: number, color: string) {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      p.active = true;
      p.shape = 'spark';
      p.x = x + (Math.random() - 0.5) * 12;
      p.y = y + (Math.random() - 0.5) * 12;
      const ang = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 180;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd - 45;
      p.maxLife = 0.18 + Math.random() * 0.22;
      p.life = p.maxLife;
      p.size = 3 + Math.floor(Math.random() * 3);
      p.endSize = 1;
      p.gravity = 160;
      p.drag = 0.92;
      p.rot = 0;
      p.vRot = 0;
      p.color = color;
      p.accentColor = '#ffffff';
    }
  }

  private spawnDust(x: number, y: number, count: number, color: string) {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      p.active = true;
      p.shape = 'dust';
      p.x = x + (Math.random() - 0.5) * 18;
      p.y = y + (Math.random() - 0.5) * 8;
      p.vx = (Math.random() - 0.5) * 75;
      p.vy = -18 - Math.random() * 48;
      p.maxLife = 0.28 + Math.random() * 0.22;
      p.life = p.maxLife;
      p.size = 5 + Math.floor(Math.random() * 4);
      p.endSize = 8;
      p.gravity = -18;
      p.drag = 0.9;
      p.rot = 0;
      p.vRot = 0;
      p.color = color;
      p.accentColor = color;
    }
  }

  private spawnRing(x: number, y: number, maxRadius: number, color: string, duration = 0.26) {
    const p = this.allocParticle();
    p.active = true;
    p.shape = 'ring';
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.maxLife = duration;
    p.life = duration;
    p.size = 6;
    p.endSize = maxRadius;
    p.gravity = 0;
    p.drag = 1;
    p.rot = 0;
    p.vRot = 0;
    p.color = color;
    p.accentColor = '#ffffff';
  }

  private spawnPlus(x: number, y: number, color: string) {
    const p = this.allocParticle();
    p.active = true;
    p.shape = 'plus';
    p.x = x + (Math.random() - 0.5) * 24;
    p.y = y + (Math.random() - 0.5) * 16;
    p.vx = (Math.random() - 0.5) * 14;
    p.vy = -24 - Math.random() * 20;
    p.maxLife = 0.48 + Math.random() * 0.25;
    p.life = p.maxLife;
    p.size = 5;
    p.endSize = 5;
    p.gravity = -10;
    p.drag = 0.97;
    p.rot = 0;
    p.vRot = 0;
    p.color = color;
    p.accentColor = '#ffffff';
  }

  private spawnPopup(x: number, y: number, text: string, color: string) {
    if (this.popups.length >= MAX_POPUPS) {
      this.popups.shift();
    }
    this.popups.push({
      x,
      y,
      vy: -34,
      text,
      color,
      life: 1.05,
      maxLife: 1.05,
    });
  }

  private snapCameraToPlayer() {
    const viewW = (this.cssWidth || 960) / this.viewScale;
    const viewH = (this.cssHeight || 540) / this.viewScale;
    const wPx = worldWidth(this.world) * TILE_SIZE;
    const hPx = worldHeight(this.world) * TILE_SIZE;
    const targetX = this.body.x + PLAYER_WIDTH * 0.5 - viewW * 0.5;
    const targetY = this.body.y + PLAYER_HEIGHT * 0.5 - viewH * 0.54;
    this.camX = Math.max(0, Math.min(Math.max(0, wPx - viewW), targetX));
    this.camY = Math.max(0, Math.min(Math.max(0, hPx - viewH), targetY));
  }

  private loop = (nowMs: number) => {
    const frameStart = performance.now();
    const rawDt = (nowMs - this.lastFrameMs) / 1000;
    this.lastFrameMs = nowMs;
    const dt = Math.min(Math.max(rawDt, 0), 0.05);

    this.update(dt, nowMs);
    this.render(nowMs);

    const frameWorkMs = performance.now() - frameStart;
    if (frameWorkMs > 2 || (typeof navigator !== 'undefined' && navigator.webdriver)) {
      this.throttleTimerId = window.setTimeout(() => {
        this.rafId = requestAnimationFrame(this.loop);
      }, 24);
    } else {
      this.rafId = requestAnimationFrame(this.loop);
    }
  };

  private update(dt: number, nowMs: number) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * dt;
      const damp = Math.pow(p.drag, dt * 60);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vRot * dt;
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.life -= dt;
      if (pop.life <= 0) {
        this.popups.splice(i, 1);
      } else {
        pop.y += pop.vy * dt;
        pop.vy *= Math.pow(0.95, dt * 60);
      }
    }
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.4);

    const viewW = this.cssWidth / this.viewScale;
    const viewH = this.cssHeight / this.viewScale;
    const wPx = worldWidth(this.world) * TILE_SIZE;
    const hPx = worldHeight(this.world) * TILE_SIZE;
    const maxCamX = Math.max(0, wPx - viewW);
    const maxCamY = Math.max(0, hPx - viewH);

    if (this.mode === 'title') {
      this.titlePanTime += dt;
      const panCenter = (wPx - viewW) * (0.5 + 0.35 * Math.sin(this.titlePanTime * 0.14));
      this.camX = Math.max(0, Math.min(maxCamX, panCenter));
      this.camY = Math.max(0, Math.min(maxCamY, this.world.spawnY * TILE_SIZE - viewH * 0.62));
      return;
    }

    if (this.mode === 'paused') return;

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    this.punchTimer = Math.max(0, this.punchTimer - dt);
    this.punchAnimTimer = Math.max(0, this.punchAnimTimer - dt);
    this.placeAnimTimer = Math.max(0, this.placeAnimTimer - dt);
    this.landAnimTimer = Math.max(0, this.landAnimTimer - dt);

    if (this.punchStick.active && this.punchTimer <= 0) {
      if (Math.abs(this.punchStick.dx) > 0.12) {
        this.body.facing = this.punchStick.dx > 0 ? 1 : -1;
      }
      const { tx, ty } = this.getTargetTileFromJoystick();
      this.performTileInteraction(tx, ty);
    } else if (this.mouseDown && this.punchTimer <= 0) {
      this.tryInteractAtCursor();
    } else if (this.touchState.punchHeld && this.punchTimer <= 0) {
      this.tryInteractFacing();
    }

    const left = this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') || this.touchState.left;
    const right = this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') || this.touchState.right;
    const down = this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') || this.touchState.down;
    const jumpHeld =
      this.keysHeld.has('Space') ||
      this.keysHeld.has('KeyW') ||
      this.keysHeld.has('ArrowUp') ||
      this.touchState.jumpHeld;

    const speedBonus = this.getActiveBuffBonusPct('move_speed');
    const effMechanics =
      speedBonus > 0
        ? {
            ...this.gameConfig.mechanics,
            moveSpeed: Math.round(this.gameConfig.mechanics.moveSpeed * (1 + speedBonus / 100)),
          }
        : this.gameConfig.mechanics;

    const result = stepPlayerPhysics(
      this.body,
      this.world,
      {
        left,
        right,
        down,
        jumpHeld,
        jumpJustPressed: this.jumpJustPressed,
      },
      dt,
      effMechanics
    );
    this.jumpJustPressed = false;

    const footTx = Math.max(0, Math.min(worldWidth(this.world) - 1, Math.floor((this.body.x + PLAYER_WIDTH * 0.5) / TILE_SIZE)));
    const footTy = Math.max(0, Math.min(worldHeight(this.world) - 1, Math.floor((this.body.y + PLAYER_HEIGHT + 2) / TILE_SIZE)));
    const bodyTy = Math.max(0, Math.min(worldHeight(this.world) - 1, Math.floor((this.body.y + PLAYER_HEIGHT * 0.7) / TILE_SIZE)));
    const groundFgId = this.world.fg[tileIndexIn(this.world, footTx, footTy)];
    const inFluid = (this.world.fluidLevel?.[tileIndexIn(this.world, footTx, bodyTy)] ?? 0) > 0;

    if (result.bounced) {
      soundEngine.jump(true);
      this.stepDistanceAccum = 0;
      this.landAnimTimer = 0;
      this.spawnDust(this.body.x + PLAYER_WIDTH * 0.5, this.body.y + PLAYER_HEIGHT - 2, 6, '#a8f794');
      this.spawnRing(this.body.x + PLAYER_WIDTH * 0.5, this.body.y + PLAYER_HEIGHT, 24, '#a8f794', 0.24);
    } else if (result.jumped) {
      soundEngine.jump(false);
      this.stepDistanceAccum = 0;
      this.landAnimTimer = 0;
      this.spawnDust(this.body.x + PLAYER_WIDTH * 0.5, this.body.y + PLAYER_HEIGHT - 2, 4, inFluid ? '#7ce2ff' : '#d6c6a8');
    } else if (result.landed) {
      soundEngine.land(groundFgId, inFluid);
      this.stepDistanceAccum = 0;
      this.landAnimTimer = 0.13;
      this.spawnDust(
        this.body.x + PLAYER_WIDTH * 0.5,
        this.body.y + PLAYER_HEIGHT - 2,
        6,
        inFluid ? '#7ce2ff' : '#d6c6a8'
      );
      if (inFluid) {
        this.spawnSparks(this.body.x + PLAYER_WIDTH * 0.5, this.body.y + PLAYER_HEIGHT - 2, 6, '#9ce8ff');
      }
    } else if (this.body.grounded && Math.abs(this.body.vx) > 28) {
      this.stepDistanceAccum += Math.abs(this.body.vx) * dt;
      if (this.stepDistanceAccum >= 34) {
        this.stepDistanceAccum %= 34;
        soundEngine.footstep(groundFgId, inFluid);
        this.spawnDust(
          this.body.x + PLAYER_WIDTH * 0.5 - this.body.facing * 6,
          this.body.y + PLAYER_HEIGHT - 2,
          2,
          inFluid ? '#7ce2ff' : '#d6c6a8'
        );
      }
    } else if (!this.body.grounded || Math.abs(this.body.vx) <= 10) {
      this.stepDistanceAccum = Math.min(this.stepDistanceAccum, 24);
    }

    if (result.hazardHit) {
      soundEngine.hazardHit(result.hazardHit);
      this.spawnSparks(
        this.body.x + PLAYER_WIDTH * 0.5,
        this.body.y + PLAYER_HEIGHT * 0.5,
        14,
        result.hazardHit === 'acid' ? '#62db3c' : '#ff8a6b'
      );
      this.body.x = this.world.spawnX * TILE_SIZE + (TILE_SIZE - PLAYER_WIDTH) * 0.5;
      this.body.y = (this.world.spawnY + 1) * TILE_SIZE - PLAYER_HEIGHT;
      this.body.vx = 0;
      this.body.vy = 0;
      this.shakeTrauma = 0.45;
      this.callbacks.onHazardHit?.(result.hazardHit);
    }

    // NEXUS Open-Sky Void Respawn Boundary
    if (
      this.world.name === 'NEXUS' &&
      this.body.y > (worldHeight(this.world) - 4) * TILE_SIZE
    ) {
      this.body.x = this.world.spawnX * TILE_SIZE + (TILE_SIZE - PLAYER_WIDTH) * 0.5;
      this.body.y = (this.world.spawnY + 1) * TILE_SIZE - PLAYER_HEIGHT;
      this.body.vx = 0;
      this.body.vy = 0;
      this.spawnRing(
        this.body.x + PLAYER_WIDTH * 0.5,
        this.body.y + PLAYER_HEIGHT * 0.5,
        36,
        '#38bdf8',
        0.35
      );
      this.spawnPopup(
        this.body.x + PLAYER_WIDTH * 0.5,
        this.body.y - 10,
        'RETURNED TO NEXUS DECK',
        '#7dd3fc'
      );
    }

    const targetCamX = Math.max(0, Math.min(maxCamX, this.body.x + PLAYER_WIDTH * 0.5 - viewW * 0.5));
    const targetCamY = Math.max(0, Math.min(maxCamY, this.body.y + PLAYER_HEIGHT * 0.5 - viewH * 0.54));
    const damp = 1 - Math.exp(-7.5 * dt);
    this.camX += (targetCamX - this.camX) * damp;
    this.camY += (targetCamY - this.camY) * damp;

    const ptx = Math.floor((this.body.x + PLAYER_WIDTH * 0.5) / TILE_SIZE);
    const pty = Math.floor((this.body.y + PLAYER_HEIGHT * 0.5) / TILE_SIZE);
    if (ptx !== this.lastCoordTx || pty !== this.lastCoordTy) {
      this.lastCoordTx = ptx;
      this.lastCoordTy = pty;
      this.callbacks.onCoordsChange?.(ptx, pty);
    }
    const standingPlantKey = `${ptx},${pty}`;
    if (this.world.plants[standingPlantKey]) {
      if (this.lastPlantInspectKey !== standingPlantKey || nowMs - this.lastPlantInspectAt >= 500) {
        this.lastPlantInspectKey = standingPlantKey;
        this.lastPlantInspectAt = nowMs;
        this.emitInspectAt(ptx, pty, true);
      }
    } else if (this.lastPlantInspectKey !== null) {
      this.lastPlantInspectKey = null;
      this.callbacks.onInspectTile?.(null);
    }

    const rDamp = 1 - Math.exp(-16 * dt);
    for (const rp of this.remotePlayers.values()) {
      rp.renderX += (rp.x - rp.renderX) * rDamp;
      rp.renderY += (rp.y - rp.renderY) * rDamp;
    }

    const px = this.body.x + PLAYER_WIDTH * 0.5;
    const py = this.body.y + PLAYER_HEIGHT * 0.5;
    const magnetRadius = this.gameConfig.mechanics.dropMagnetRadius;
    for (const drop of this.drops.values()) {
      const dx = px - drop.x;
      const dy = py - drop.y;
      const dist = Math.hypot(dx, dy);
      if (dist < magnetRadius && dist > 1) {
        drop.x += (dx / dist) * 180 * dt;
        drop.y += (dy / dist) * 180 * dt;
      }
      if (dist <= DROP_PICKUP_RADIUS && !this.pickupAttempted.has(drop.id)) {
        this.pickupAttempted.add(drop.id);
        if (drop.isGem) {
          soundEngine.gem();
          this.spawnSparks(drop.x, drop.y, 7, '#fde047');
          this.spawnPopup(drop.x, drop.y - 8, `+${drop.qty} G`, '#fde047');
        } else {
          soundEngine.pickup();
          this.spawnSparks(drop.x, drop.y, 4, '#a8fff7');
        }
        this.callbacks.onPickupDrop?.(drop.id);
      }
    }

    if (nowMs - this.lastSyncSent > 50) {
      this.lastSyncSent = nowMs;
      this.callbacks.onMoveSync?.({
        x: Math.round(this.body.x * 10) / 10,
        y: Math.round(this.body.y * 10) / 10,
        vx: Math.round(this.body.vx),
        vy: Math.round(this.body.vy),
        facing: this.body.facing,
        grounded: this.body.grounded,
        punching: this.punchAnimTimer > 0,
        placing: this.placeAnimTimer > 0,
      });
    }
  }

  private render(nowMs: number) {
    const liveDpr = Math.min(3, Math.max(1, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1));
    if (liveDpr !== this.dpr) {
      this.handleResize();
    }

    const ctx = this.ctx;
    const w = this.cssWidth;
    const h = this.cssHeight;
    const viewScale = this.viewScale;
    const viewW = w / viewScale;
    const viewH = h / viewScale;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const shakeAmp = this.shakeTrauma * this.shakeTrauma * 6;
    const shakeX = shakeAmp > 0.1 ? (Math.random() * 2 - 1) * shakeAmp : 0;
    const shakeY = shakeAmp > 0.1 ? (Math.random() * 2 - 1) * shakeAmp : 0;

    const snapScale = this.dpr * viewScale;
    const cx = Math.round((this.camX + shakeX) * snapScale) / snapScale;
    const cy = Math.round((this.camY + shakeY) * snapScale) / snapScale;

    // 1. Biome-Aware Sky & Multi-Layer Parallax Backdrop (unscaled full viewport)
    const family = this.world.worldFamily ?? 'temperate';
    if (this.world.name === 'NEXUS') {
      // Custom NEXUS Weather: Teal Aurora Nebula with drifting crystal dust
      const nexusGrad = ctx.createLinearGradient(0, 0, 0, h);
      nexusGrad.addColorStop(0, '#04131d');
      nexusGrad.addColorStop(0.38, '#0b2b3c');
      nexusGrad.addColorStop(0.75, '#134e5e');
      nexusGrad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = nexusGrad;
      ctx.fillRect(0, 0, w, h);

      // Undulating Teal & Emerald Aurora Borealis Ribbons
      for (let band = 0; band < 4; band++) {
        const baseY = 38 + band * 34;
        ctx.fillStyle =
          band === 0
            ? 'rgba(45, 212, 191, 0.16)'
            : band === 1
              ? 'rgba(52, 211, 153, 0.14)'
              : band === 2
                ? 'rgba(56, 189, 248, 0.12)'
                : 'rgba(167, 139, 250, 0.10)';
        for (let seg = 0; seg < w; seg += 32) {
          const waveY = baseY + Math.sin(nowMs * 0.0011 + seg * 0.012 + band * 1.4) * 14;
          ctx.fillRect(seg, Math.round(waveY), 32, 18 - band * 2);
        }
      }

      // Distant crystalline nebula spires along horizon
      ctx.fillStyle = 'rgba(13, 59, 76, 0.42)';
      for (let i = 0; i < 11; i++) {
        const mx = i * 240 - Math.floor(cx * 0.18);
        const my = Math.floor(24 * TILE_SIZE - cy * 0.28 - 95 - (i % 3) * 22);
        ctx.beginPath();
        ctx.moveTo(mx - 55, h);
        ctx.lineTo(mx + 60, my);
        ctx.lineTo(mx + 175, h);
        ctx.closePath();
        ctx.fill();
      }

      // 32 Drifting Crystal Dust Motes (capped <= 35, zero per-frame allocations)
      for (let m = 0; m < 32; m++) {
        const seedX = (m * 197 + 43) % 997;
        const seedY = (m * 313 + 71) % 991;
        const driftX = ((seedX * 1.8 + nowMs * (0.012 + (m % 3) * 0.004) - cx * 0.12) % (w + 40) + (w + 40)) % (w + 40) - 20;
        const driftY = ((seedY * 1.3 - nowMs * (0.015 + (m % 4) * 0.003) - cy * 0.08) % (h + 40) + (h + 40)) % (h + 40) - 20;
        const twinkle = 0.35 + 0.55 * Math.abs(Math.sin(nowMs * 0.003 + m * 1.7));
        const sz = m % 4 === 0 ? 4 : 3;
        ctx.fillStyle =
          m % 3 === 0
            ? `rgba(153, 246, 228, ${twinkle.toFixed(2)})`
            : m % 3 === 1
              ? `rgba(167, 243, 208, ${twinkle.toFixed(2)})`
              : `rgba(224, 242, 254, ${twinkle.toFixed(2)})`;
        ctx.fillRect(Math.round(driftX), Math.round(driftY), sz, sz);
      }
    } else if (this.world.worldKind === 'mine_shaft' || family === 'cave_blast') {
      const caveGrad = ctx.createLinearGradient(0, 0, 0, h);
      caveGrad.addColorStop(0, '#090d16');
      caveGrad.addColorStop(0.55, '#141d2e');
      caveGrad.addColorStop(1, '#22182b');
      ctx.fillStyle = caveGrad;
      ctx.fillRect(0, 0, w, h);

      // Distant subterranean pillars & glowing crystal veins
      ctx.fillStyle = 'rgba(26, 36, 56, 0.55)';
      for (let i = 0; i < 10; i++) {
        const px = ((i * 220 - Math.floor(cx * 0.16)) % (w + 260)) - 80;
        ctx.fillRect(px, 0, 44, h);
        ctx.fillStyle = 'rgba(140, 247, 238, 0.14)';
        ctx.fillRect(px + 18, (i * 83) % Math.max(120, h - 80), 6, 28);
        ctx.fillStyle = 'rgba(26, 36, 56, 0.55)';
      }
    } else if (family === 'arctic_tundra') {
      const arcticGrad = ctx.createLinearGradient(0, 0, 0, h);
      arcticGrad.addColorStop(0, '#0b1d33');
      arcticGrad.addColorStop(0.48, '#1b4468');
      arcticGrad.addColorStop(1, '#79bedb');
      ctx.fillStyle = arcticGrad;
      ctx.fillRect(0, 0, w, h);

      // Shimmering Aurora Borealis ribbons
      for (let band = 0; band < 3; band++) {
        const ay = 46 + band * 28 + Math.sin(nowMs * 0.0012 + band) * 8;
        ctx.fillStyle = band === 1 ? 'rgba(140, 247, 238, 0.16)' : 'rgba(87, 200, 135, 0.15)';
        ctx.fillRect(0, Math.round(ay), w, 14);
      }

      // Snow-capped parallax alpine peaks
      ctx.fillStyle = 'rgba(42, 78, 112, 0.52)';
      for (let i = 0; i < 12; i++) {
        const mx = i * 220 - Math.floor(cx * 0.22);
        const my = Math.floor(24 * TILE_SIZE - cy * 0.32 - 90);
        ctx.beginPath();
        ctx.moveTo(mx - 70, h);
        ctx.lineTo(mx + 75, my);
        ctx.lineTo(mx + 220, h);
        ctx.closePath();
        ctx.fill();
      }
    } else if (family === 'desert_blast') {
      const desertGrad = ctx.createLinearGradient(0, 0, 0, h);
      desertGrad.addColorStop(0, '#b84b29');
      desertGrad.addColorStop(0.52, '#e6923a');
      desertGrad.addColorStop(1, '#ffe39f');
      ctx.fillStyle = desertGrad;
      ctx.fillRect(0, 0, w, h);

      // Blazing desert sun with coronal rings
      const sunX = Math.round(w * 0.76 - cx * 0.04);
      const sunY = Math.round(Math.max(58, h * 0.18 - cy * 0.03));
      ctx.fillStyle = 'rgba(255, 244, 184, 0.22)';
      ctx.fillRect(sunX - 42, sunY - 42, 84, 84);
      ctx.fillStyle = '#fff5bd';
      ctx.fillRect(sunX - Math.round(TILE_SIZE * 0.5), sunY - Math.round(TILE_SIZE * 0.5), TILE_SIZE, TILE_SIZE);

      // Layered red-sandstone mesas
      ctx.fillStyle = 'rgba(156, 68, 42, 0.38)';
      for (let i = 0; i < 10; i++) {
        const mx = i * 250 - Math.floor(cx * 0.22);
        const my = Math.floor(24 * TILE_SIZE - cy * 0.34 - 64);
        ctx.fillRect(mx, my, 150, h - my);
        ctx.fillStyle = 'rgba(224, 126, 69, 0.28)';
        ctx.fillRect(mx + 12, my, 126, 8);
        ctx.fillStyle = 'rgba(156, 68, 42, 0.38)';
      }
    } else {
      ctx.fillStyle = this.skyGradient ?? '#7ec8f2';
      ctx.fillRect(0, 0, w, h);

      // Warm pixel sun with soft coronal glow rings
      const sunX = Math.round(w * 0.78 - cx * 0.04);
      const sunY = Math.round(Math.max(54, h * 0.16 - cy * 0.03));
      ctx.fillStyle = 'rgba(255, 248, 196, 0.18)';
      ctx.fillRect(sunX - 38, sunY - 38, 76, 76);
      ctx.fillStyle = 'rgba(255, 242, 166, 0.35)';
      ctx.fillRect(sunX - 26, sunY - 26, 52, 52);
      ctx.fillStyle = '#fff9d2';
      ctx.fillRect(sunX - 16, sunY - 16, 32, 32);

      // Far misty mountain range
      ctx.fillStyle = 'rgba(58, 112, 156, 0.26)';
      for (let i = 0; i < 12; i++) {
        const mx = i * 260 - Math.floor(cx * 0.16);
        const my = Math.floor(24 * TILE_SIZE - cy * 0.28 - 110);
        ctx.beginPath();
        ctx.moveTo(mx - 80, h);
        ctx.lineTo(mx + 90, my);
        ctx.lineTo(mx + 260, h);
        ctx.closePath();
        ctx.fill();
      }

      // Mid-ground ridged mountains with sunlit snow caps
      for (let i = 0; i < 12; i++) {
        const mx = i * 220 - Math.floor(cx * 0.26);
        const my = Math.floor(24 * TILE_SIZE - cy * 0.35 - 62);
        ctx.fillStyle = 'rgba(42, 88, 128, 0.34)';
        ctx.beginPath();
        ctx.moveTo(mx - 60, h);
        ctx.lineTo(mx + 80, my);
        ctx.lineTo(mx + 220, h);
        ctx.closePath();
        ctx.fill();
      }

      // 3-tone sculpted pixel clouds (top sunlit rim, fluffy body, cool slate under-shadow)
      for (let i = 0; i < 8; i++) {
        const cloudX = Math.floor(((i * 260 - cx * 0.18 + nowMs * 0.008) % (w + 320)) - 150);
        const cloudY = Math.floor(96 + (i % 3) * 46 - cy * 0.05);
        ctx.fillStyle = 'rgba(182, 214, 240, 0.65)';
        ctx.fillRect(cloudX + 4, cloudY + 14, 96, 8);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
        ctx.fillRect(cloudX, cloudY, 96, 16);
        ctx.fillRect(cloudX + 18, cloudY - 12, 58, 14);
        ctx.fillRect(cloudX + 32, cloudY - 18, 30, 8);
        ctx.fillStyle = 'rgba(255, 253, 235, 0.95)';
        ctx.fillRect(cloudX + 18, cloudY - 12, 58, 3);
      }
    }

    // Upscaled crisp nearest-neighbor world pass
    ctx.save();
    ctx.scale(viewScale, viewScale);
    ctx.imageSmoothingEnabled = false;

    // 3. Single-blit static world tilemap (bg + fg) from full-res 48px/tile offscreen cache
    const sxTile = Math.max(0, Math.floor(cx));
    const syTile = Math.max(0, Math.floor(cy));
    const subX = cx - sxTile;
    const subY = cy - syTile;
    const srcW = Math.min(this.worldLayerCanvas.width - sxTile, Math.ceil(viewW + 2));
    const srcH = Math.min(this.worldLayerCanvas.height - syTile, Math.ceil(viewH + 2));
    if (srcW > 0 && srcH > 0) {
      ctx.drawImage(this.worldLayerCanvas, sxTile, syTile, srcW, srcH, -subX, -subY, srcW, srcH);
    }

    // 3a. Share Lock claimed rectangle boundaries & corner sigils
    if (this.world.shareLocks) {
      for (const lock of Object.values(this.world.shareLocks)) {
        const lx = lock.x * TILE_SIZE - cx;
        const ly = lock.y * TILE_SIZE - cy;
        const lw = lock.width * TILE_SIZE;
        const lh = lock.height * TILE_SIZE;
        if (lx + lw < 0 || ly + lh < 0 || lx > viewW || ly > viewH) continue;
        const borderCol =
          lock.itemId === ITEM_IDS.MICRO_SHARE_LOCK
            ? 'rgba(72, 198, 213, 0.75)'
            : lock.itemId === ITEM_IDS.SMALL_SHARE_LOCK
              ? 'rgba(87, 200, 135, 0.75)'
              : 'rgba(182, 138, 255, 0.78)';
        const fillCol =
          lock.itemId === ITEM_IDS.MICRO_SHARE_LOCK
            ? 'rgba(72, 198, 213, 0.07)'
            : lock.itemId === ITEM_IDS.SMALL_SHARE_LOCK
              ? 'rgba(87, 200, 135, 0.07)'
              : 'rgba(182, 138, 255, 0.08)';
        ctx.fillStyle = fillCol;
        ctx.fillRect(lx, ly, lw, lh);
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = 2;
        ctx.strokeRect(lx + 1, ly + 1, lw - 2, lh - 2);
      }
    }

    // 3b. Dynamic Water & Acid fluid cells with subsurface shimmer & surface waves
    const ww = worldWidth(this.world);
    const wh = worldHeight(this.world);
    const tx0 = Math.max(0, Math.floor(cx / TILE_SIZE));
    const tx1 = Math.min(ww - 1, Math.ceil((cx + viewW) / TILE_SIZE));
    const ty0 = Math.max(0, Math.floor(cy / TILE_SIZE));
    const ty1 = Math.min(wh - 1, Math.ceil((cy + viewH) / TILE_SIZE));
    if (this.world.fluidType && this.world.fluidLevel) {
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const idx = ty * ww + tx;
          const fLvl = this.world.fluidLevel[idx];
          const fTyp = this.world.fluidType[idx];
          if (fLvl > 0 && fTyp > 0) {
            const fillH = Math.round((Math.min(4, fLvl) / 4) * TILE_SIZE);
            const fx = tx * TILE_SIZE - cx;
            const fy = ty * TILE_SIZE - cy + (TILE_SIZE - fillH);
            ctx.fillStyle = fTyp === 2 ? 'rgba(84, 204, 48, 0.74)' : 'rgba(34, 138, 214, 0.70)';
            ctx.fillRect(fx, fy, TILE_SIZE, fillH);
            const waveOffset = Math.round(Math.sin(nowMs * 0.006 + tx * 0.9) * 2);
            ctx.fillStyle = fTyp === 2 ? 'rgba(196, 255, 118, 0.88)' : 'rgba(158, 230, 255, 0.86)';
            ctx.fillRect(fx, fy + waveOffset, TILE_SIZE, 4);
            if (fillH > 16) {
              const causticX = fx + 8 + Math.round(Math.sin(nowMs * 0.004 + ty) * 6);
              ctx.fillStyle = fTyp === 2 ? 'rgba(220, 255, 160, 0.35)' : 'rgba(200, 245, 255, 0.32)';
              ctx.fillRect(causticX, fy + 10, 14, 3);
            }
          }
        }
      }
    }

    // 3c. Per-tile impact hit flash / squash & placement spring-pop animations
    for (const [key, anim] of this.tileAnims.entries()) {
      const elapsed = nowMs - anim.startedAt;
      if (elapsed >= anim.durationMs) {
        this.tileAnims.delete(key);
        continue;
      }
      const t = Math.max(0, Math.min(1, elapsed / anim.durationMs));
      const [atxStr, atyStr] = key.split(',');
      const sx = Number(atxStr) * TILE_SIZE - cx;
      const sy = Number(atyStr) * TILE_SIZE - cy;
      if (sx + TILE_SIZE < 0 || sy + TILE_SIZE < 0 || sx > viewW || sy > viewH) continue;

      if (anim.kind === 'hit') {
        const recoil = Math.sin(t * Math.PI) * 3.5;
        const dx = anim.dirX * recoil;
        const dy = anim.dirY * recoil * 0.6;
        const flashAlpha = (1 - t) * 0.42;
        ctx.save();
        ctx.translate(sx + dx, sy + dy);
        ctx.drawImage(getTileSprite(anim.itemId), 0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.restore();
      } else {
        // Elastic pop from 1.24 -> 0.96 -> 1.0
        const spring = 1 + Math.sin(t * Math.PI) * (1 - t) * 0.28;
        const flashAlpha = (1 - t) * 0.35;
        ctx.save();
        ctx.translate(sx + TILE_SIZE * 0.5, sy + TILE_SIZE * 0.5);
        ctx.scale(spring, 2 - spring * 0.95);
        ctx.drawImage(getTileSprite(anim.itemId), -TILE_SIZE * 0.5, -TILE_SIZE * 0.5, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = `rgba(255, 250, 224, ${flashAlpha})`;
        ctx.fillRect(-TILE_SIZE * 0.5, -TILE_SIZE * 0.5, TILE_SIZE, TILE_SIZE);
        ctx.restore();
      }
    }

    // 4. Dynamic planted trees, machine status cues, vending machine stock & damage cracks
    for (const key in this.world.plants) {
      const plant = this.world.plants[key];
      const sx = plant.x * TILE_SIZE - cx;
      const sy = plant.y * TILE_SIZE - cy;
      if (sx >= -TILE_SIZE && sx <= viewW && sy >= -TILE_SIZE && sy <= viewH) {
        this.drawPlantedTree(ctx, plant, sx, sy, nowMs);
        if (nowMs >= plant.maturityAt && Math.random() < 0.03) {
          this.spawnPlus(plant.x * TILE_SIZE + TILE_SIZE * 0.5, plant.y * TILE_SIZE + 12, '#b8f58c');
        }
      }
    }

    if (this.world.furnaces) {
      for (const f of Object.values(this.world.furnaces)) {
        const sx = f.x * TILE_SIZE - cx;
        const sy = f.y * TILE_SIZE - cy;
        if (sx >= -TILE_SIZE && sx <= viewW && sy >= -TILE_SIZE && sy <= viewH) {
          if (f.recipeId || f.readyOutputItemId > 0) {
            const pulse = 0.55 + 0.35 * Math.sin(nowMs * 0.01);
            ctx.fillStyle = f.readyOutputItemId > 0
              ? `rgba(130, 224, 104, ${pulse})`
              : `rgba(255, 138, 48, ${pulse})`;
            ctx.fillRect(sx + 16, sy + 24, 16, 12);
          }
        }
      }
    }

    if (this.world.bfgCollectors) {
      for (const bfg of Object.values(this.world.bfgCollectors)) {
        if (!bfg.active) continue;
        const sx = bfg.x * TILE_SIZE - cx;
        const sy = bfg.y * TILE_SIZE - cy;
        if (sx >= -TILE_SIZE && sx <= viewW && sy >= -TILE_SIZE && sy <= viewH) {
          const pulse = 0.5 + 0.35 * Math.sin(nowMs * 0.008);
          ctx.fillStyle = `rgba(56, 232, 216, ${pulse})`;
          ctx.fillRect(sx + 18, sy + 12, 12, 12);
        }
      }
    }

    if (this.world.vendingMachines) {
      for (const key in this.world.vendingMachines) {
        const vm = this.world.vendingMachines[key];
        if (vm.stockItemId > 0 && vm.stockQty > 0) {
          const sx = vm.x * TILE_SIZE - cx;
          const sy = vm.y * TILE_SIZE - cy;
          if (sx >= -TILE_SIZE && sx <= viewW && sy >= -TILE_SIZE && sy <= viewH) {
            ctx.drawImage(getTileSprite(vm.stockItemId), sx + 10, sy + 9, 18, 18);
          }
        }
      }
    }

    for (const [key, crack] of this.cracks.entries()) {
      if (nowMs >= crack.expiresAt) {
        this.cracks.delete(key);
        continue;
      }
      const [txStr, tyStr] = key.split(',');
      const sx = Number(txStr) * TILE_SIZE - cx;
      const sy = Number(tyStr) * TILE_SIZE - cy;
      const stage = Math.max(1, Math.min(4, Math.ceil((crack.hits / crack.maxHits) * 4)));
      ctx.drawImage(getCrackOverlay(stage), sx, sy, TILE_SIZE, TILE_SIZE);
    }

    // 5. Collectible Drops floating with enlarged frame & faceted pixel-art gem jewels (~35% increased scale)
    for (const drop of this.drops.values()) {
      const bob = Math.sin(nowMs * 0.0055 + drop.x * 0.35 + drop.y * 0.2) * 2.8;
      if (drop.isGem) {
        const qty = drop.qty || 1;
        let sz = 14;
        let darkColor = '#713f12';
        let baseColor = '#ca8a04';
        let lightColor = '#fde047';
        let sparkColor = '#fef08a';

        if (qty >= 100) {
          sz = 26;
          darkColor = '#581c87';
          baseColor = '#9333ea';
          lightColor = '#c084fc';
          sparkColor = '#f3e8ff';
        } else if (qty >= 50) {
          sz = 23;
          darkColor = '#14532d';
          baseColor = '#16a34a';
          lightColor = '#4ade80';
          sparkColor = '#dcfce7';
        } else if (qty >= 10) {
          sz = 20;
          darkColor = '#991b1b';
          baseColor = '#dc2626';
          lightColor = '#f87171';
          sparkColor = '#fee2e2';
        } else if (qty >= 5) {
          sz = 17;
          darkColor = '#0369a1';
          baseColor = '#0284c7';
          lightColor = '#38bdf8';
          sparkColor = '#e0f2fe';
        } else {
          sz = 14;
          darkColor = '#713f12';
          baseColor = '#ca8a04';
          lightColor = '#fde047';
          sparkColor = '#fef08a';
        }

        const half = Math.floor(sz / 2);
        const gx = Math.floor(drop.x - cx - half);
        const gy = Math.floor(drop.y - cy - half + bob);

        // Ground shadow
        ctx.fillStyle = 'rgba(4, 8, 14, 0.40)';
        ctx.fillRect(gx + 1, Math.floor(drop.y - cy + half), sz - 2, 3);

        // Gem silhouette (brilliant octagon/diamond cut)
        ctx.fillStyle = '#090d16';
        ctx.fillRect(gx + 2, gy, sz - 4, sz);
        ctx.fillRect(gx, gy + 2, sz, sz - 4);
        ctx.fillRect(gx + 1, gy + 1, sz - 2, sz - 2);

        // Deep facet shadows (left & bottom)
        ctx.fillStyle = darkColor;
        ctx.fillRect(gx + 1, gy + 2, Math.max(2, Math.floor(sz * 0.3)), sz - 4);
        ctx.fillRect(gx + 2, gy + sz - 2, sz - 4, Math.max(2, Math.floor(sz * 0.3)));

        // Mid base color facets
        ctx.fillStyle = baseColor;
        ctx.fillRect(gx + Math.floor(sz * 0.3), gy + 1, Math.max(2, sz - Math.floor(sz * 0.3) - 2), sz - 2);

        // Brilliant crown highlight (top right)
        ctx.fillStyle = lightColor;
        ctx.fillRect(gx + Math.floor(sz * 0.35), gy + 1, Math.max(2, Math.floor(sz * 0.45)), Math.max(2, Math.floor(sz * 0.45)));

        // Sparkling glint (animated)
        const glintPhase = Math.sin(nowMs * 0.008 + drop.x * 1.5) > 0.2;
        if (glintPhase) {
          ctx.fillStyle = sparkColor;
          ctx.fillRect(gx + Math.floor(sz * 0.4), gy + 1, 3, 3);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(gx + Math.floor(sz * 0.45), gy + 1, 2, 2);
        }
      } else {
        const dropDef = getItemDef(drop.itemId);
        const isSolidFullBlock =
          (dropDef?.category === 'foreground' || dropDef?.category === 'background') &&
          !dropDef?.transparent;

        if (!isSolidFullBlock) {
          // Non-block / non-background / hollow-background items: slightly larger (24x24) with clear see-through background
          const iconSize = 24;
          const dx = Math.floor(drop.x - cx - iconSize * 0.5);
          const dy = Math.floor(drop.y - cy - iconSize * 0.5 + bob);
          // Subtle ground shadow only (no opaque dark box behind sprite)
          ctx.fillStyle = 'rgba(6, 12, 20, 0.30)';
          ctx.fillRect(dx + 3, Math.floor(drop.y - cy + 10), iconSize - 6, 3);

          ctx.drawImage(getTileSprite(drop.itemId), dx, dy, iconSize, iconSize);

          if (drop.qty > 1) {
            const label = drop.qty > 999 ? '999+' : String(drop.qty);
            ctx.font = 'bold 8px monospace';
            const badgeW = Math.max(12, Math.ceil(ctx.measureText(label).width) + 4);
            const badgeX = dx + iconSize - badgeW + 2;
            const badgeY = dy + iconSize - 8;
            ctx.fillStyle = '#0d1520';
            ctx.fillRect(badgeX - 1, badgeY - 1, badgeW + 2, 10);
            ctx.fillStyle = '#e8f2fa';
            ctx.fillRect(badgeX, badgeY, badgeW, 8);
            ctx.fillStyle = '#142233';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, badgeX + badgeW / 2, badgeY + 4);
            ctx.textAlign = 'start';
            ctx.textBaseline = 'alphabetic';
          }
        } else {
          // Solid full-tile foreground/background blocks: crisp 20x20 block drop
          const dx = Math.floor(drop.x - cx - 10);
          const dy = Math.floor(drop.y - cy - 10 + bob);
          ctx.fillStyle = 'rgba(6, 12, 20, 0.35)';
          ctx.fillRect(dx + 2, Math.floor(drop.y - cy + 9), 16, 3);

          ctx.fillStyle = '#090d16';
          ctx.fillRect(dx, dy, 20, 20);
          ctx.drawImage(getTileSprite(drop.itemId), dx + 1, dy + 1, 18, 18);

          if (drop.qty > 1) {
            const label = drop.qty > 999 ? '999+' : String(drop.qty);
            ctx.font = 'bold 8px monospace';
            const badgeW = Math.max(12, Math.ceil(ctx.measureText(label).width) + 4);
            const badgeX = dx + 20 - badgeW + 2;
            const badgeY = dy + 12;
            ctx.fillStyle = '#0d1520';
            ctx.fillRect(badgeX - 1, badgeY - 1, badgeW + 2, 10);
            ctx.fillStyle = '#e8f2fa';
            ctx.fillRect(badgeX, badgeY, badgeW, 8);
            ctx.fillStyle = '#142233';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, badgeX + badgeW / 2, badgeY + 4);
            ctx.textAlign = 'start';
            ctx.textBaseline = 'alphabetic';
          }
        }
      }
    }

    const queuedNameplates: Array<{ name: string; screenX: number; screenY: number }> = [];
    const queuedPlayerTitles: Array<{
      playerId: string;
      name: string;
      role: 'admin' | 'owner' | 'shared' | 'guest';
      screenX: number;
      screenY: number;
      worldX: number;
      worldY: number;
      showWrench: boolean;
      remotePlayer?: RemotePlayerState;
    }> = [];

    // 5b. 3×2 Market Stands (Landlord Steward & Fresh Greens Vendor) & WorldCore in-world presence cues
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = Math.max(0, tx0 - 1); tx <= Math.min(ww - 1, tx1 + 1); tx++) {
        const fgId = this.world.fg[ty * ww + tx];
        if (fgId === ITEM_IDS.LANDLORD_NPC || fgId === ITEM_IDS.GREENS_VENDOR_NPC) {
          const isLandlord = fgId === ITEM_IDS.LANDLORD_NPC;
          const standSprite = getMarketStandSprite(isLandlord ? 'landlord' : 'greens_vendor');
          const standX = (tx - 1) * TILE_SIZE - cx;
          const standY = (ty - 1) * TILE_SIZE - cy;
          const standW = TILE_SIZE * 3;
          const standH = TILE_SIZE * 2;
          ctx.drawImage(standSprite, standX, standY, standW, standH);

          const glowPulse = 0.26 + Math.sin(nowMs * 0.004 + tx) * 0.12;
          ctx.strokeStyle = isLandlord
            ? `rgba(255, 225, 140, ${glowPulse})`
            : `rgba(110, 231, 183, ${glowPulse})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(standX - 1, standY - 1, standW + 2, standH + 2);

          queuedNameplates.push({
            name: isLandlord
              ? 'LANDLORD · REALM STEWARD'
              : 'FRESH GREENS VENDOR · CROPS & DIGIBITS',
            screenX: (standX + standW * 0.5) * viewScale,
            screenY: (standY - 4) * viewScale,
          });
        }
      }
    }
    if (this.world.worldLock && this.world.worldLock.lockItemId === ITEM_IDS.WORLD_CORE) {
      const wcx = this.world.worldLock.x;
      const wcy = this.world.worldLock.y;
      const csx = wcx * TILE_SIZE - cx;
      const csy = wcy * TILE_SIZE - cy;
      const pulse = 0.35 + Math.sin(nowMs * 0.005) * 0.18;
      ctx.strokeStyle = `rgba(244, 196, 95, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(csx - 1, csy - 1, TILE_SIZE + 2, TILE_SIZE + 2);
      queuedNameplates.push({
        name: `WORLD CORE · LV.${this.world.worldLevel ?? 1} (TAP)`,
        screenX: (csx + TILE_SIZE * 0.5) * viewScale,
        screenY: (csy - 2) * viewScale,
      });
    }

    // 5c. Matteragen Engine in-world status & readiness cues
    if (this.world.matteragenEngines) {
      for (const engine of Object.values(this.world.matteragenEngines)) {
        const esx = engine.x * TILE_SIZE - cx;
        const esy = engine.y * TILE_SIZE - cy;
        if (esx + TILE_SIZE < 0 || esx > viewW || esy + TILE_SIZE < 0 || esy > viewH) continue;

        const corePulse = 0.4 + 0.3 * Math.sin(nowMs * 0.006 + engine.x * 2 + engine.y);
        if (engine.isReady) {
          if (Math.random() < 0.05) {
            this.spawnPlus(engine.x * TILE_SIZE + TILE_SIZE * 0.5, engine.y * TILE_SIZE + 8, '#6ee7b7');
          }
          ctx.fillStyle = `rgba(52, 211, 153, ${corePulse * 0.7})`;
          ctx.fillRect(esx + 6, esy + 6, TILE_SIZE - 12, TILE_SIZE - 12);
          ctx.strokeStyle = '#6ee7b7';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(esx + 2, esy + 2, TILE_SIZE - 4, TILE_SIZE - 4);

          const bounce = Math.sin(nowMs * 0.007) * 3;
          ctx.font = 'bold 9px monospace';
          const text = 'TAP TO CLAIM!';
          const tw = ctx.measureText(text).width;
          const bx = Math.round(esx + TILE_SIZE / 2 - tw / 2 - 5);
          const by = Math.round(esy - 13 + bounce);
          ctx.fillStyle = '#064e3b';
          ctx.fillRect(bx - 1, by - 1, tw + 10, 15);
          ctx.fillStyle = '#10b981';
          ctx.fillRect(bx, by, tw + 8, 13);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, bx + 4, by + 10);
        } else {
          ctx.fillStyle = `rgba(56, 189, 248, ${corePulse * 0.35})`;
          ctx.fillRect(esx + 14, esy + 14, TILE_SIZE - 28, TILE_SIZE - 28);

          ctx.font = 'bold 8px monospace';
          const lvlText = `LV.${engine.level || 1}`;
          const ltw = ctx.measureText(lvlText).width;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
          ctx.fillRect(esx + 2, esy + 2, ltw + 6, 11);
          ctx.fillStyle = '#38bdf8';
          ctx.fillText(lvlText, esx + 5, esy + 10);
        }
      }
    }

    // 5d. ATM Machine & Vaultbox in-world cues
    if (this.world.atmMachines) {
      for (const atm of Object.values(this.world.atmMachines)) {
        const asx = atm.x * TILE_SIZE - cx;
        const asy = atm.y * TILE_SIZE - cy;
        if (asx + TILE_SIZE < 0 || asx > viewW || asy + TILE_SIZE < 0 || asy > viewH) continue;

        const ledPulse = 0.45 + 0.35 * Math.sin(nowMs * 0.007 + atm.x * 1.7);
        if (atm.isReady) {
          if (Math.random() < 0.06) {
            this.spawnPlus(atm.x * TILE_SIZE + TILE_SIZE * 0.5, atm.y * TILE_SIZE + 8, '#fde047');
          }
          ctx.fillStyle = `rgba(250, 204, 21, ${ledPulse * 0.42})`;
          ctx.fillRect(asx + 4, asy + 4, TILE_SIZE - 8, TILE_SIZE - 8);
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2;
          ctx.strokeRect(asx + 1, asy + 1, TILE_SIZE - 2, TILE_SIZE - 2);

          const bounce = Math.sin(nowMs * 0.0075) * 3;
          ctx.font = 'bold 9px monospace';
          const text = `PUNCH: +${atm.storedGems} G!`;
          const tw = ctx.measureText(text).width;
          const bx = Math.round(asx + TILE_SIZE / 2 - tw / 2 - 5);
          const by = Math.round(asy - 14 + bounce);
          ctx.fillStyle = '#422006';
          ctx.fillRect(bx - 1, by - 1, tw + 10, 15);
          ctx.fillStyle = '#eab308';
          ctx.fillRect(bx, by, tw + 8, 13);
          ctx.fillStyle = '#fefce8';
          ctx.fillText(text, bx + 4, by + 10);
        } else {
          ctx.fillStyle = `rgba(56, 232, 216, ${ledPulse * 0.55})`;
          ctx.fillRect(asx + 12, asy + 11, 24, 11);
        }
      }
    }

    if (this.world.vaultboxes) {
      for (const vb of Object.values(this.world.vaultboxes)) {
        const vsx = vb.x * TILE_SIZE - cx;
        const vsy = vb.y * TILE_SIZE - cy;
        if (vsx + TILE_SIZE < 0 || vsx > viewW || vsy + TILE_SIZE < 0 || vsy > viewH) continue;
        const used = vb.slots.filter(Boolean).length;
        if (used > 0) {
          ctx.font = 'bold 8px monospace';
          const tag = `${used}/10`;
          const tw = ctx.measureText(tag).width;
          ctx.fillStyle = 'rgba(9, 14, 23, 0.86)';
          ctx.fillRect(vsx + 2, vsy + 2, tw + 6, 11);
          ctx.fillStyle = '#fde047';
          ctx.fillText(tag, vsx + 5, vsy + 10);
        }
      }
    }

    // 6. Remote players
    const isWrenchSelected = this.selectedItemId === ITEM_IDS.WRENCH;
    for (const rp of this.remotePlayers.values()) {
      ctx.fillStyle = 'rgba(6, 12, 20, 0.34)';
      ctx.fillRect(Math.round(rp.renderX - cx + 6), Math.round(rp.renderY - cy + PLAYER_HEIGHT - 3), PLAYER_WIDTH - 12, 5);
      const rpCast = this.activeCasts.get(rp.id);
      const rpFishState: 'none' | 'hold' | 'reel' = rpCast ? (rpCast.biting ? 'reel' : 'hold') : 'none';
      const topY = this.drawCharacter(
        ctx,
        rp.renderX - cx,
        rp.renderY - cy,
        rp.facing,
        rp.vx,
        rp.vy,
        rp.grounded,
        rp.punching,
        Boolean(rp.placing),
        rp.shirtColor,
        nowMs * 0.014,
        nowMs,
        rp.punching ? ((nowMs % 320) / 320) : 0,
        rp.equipped,
        'punch',
        false,
        rpFishState
      );
      const distToLocal = Math.hypot(
        rp.renderX - this.body.x,
        rp.renderY - this.body.y
      );
      queuedPlayerTitles.push({
        playerId: rp.id,
        name: rp.name,
        role: this.resolvePlayerWorldRole(rp.id, rp.role),
        screenX: (rp.renderX - cx + PLAYER_WIDTH * 0.5) * viewScale,
        screenY: topY * viewScale,
        worldX: rp.renderX,
        worldY: rp.renderY,
        showWrench: isWrenchSelected && distToLocal <= TILE_SIZE * 8,
        remotePlayer: rp,
      });
    }

    // 7. Local player, nearby Sign banner & targeting reticle (3-block reach check)
    const queuedSignBanners: Array<{ text: string; screenX: number; screenY: number }> = [];
    if (this.mode !== 'title') {
      ctx.fillStyle = 'rgba(6, 12, 20, 0.36)';
      ctx.fillRect(
        Math.round(this.body.x - cx + 6),
        Math.round(this.body.y - cy + PLAYER_HEIGHT - 3),
        PLAYER_WIDTH - 12,
        5
      );
      const punchProgress =
        this.punchAnimTimer > 0
          ? Math.max(0, Math.min(1, 1 - this.punchAnimTimer / PUNCH_ANIM_DURATION))
          : 0;
      const selDef = getItemDef(this.selectedItemId);
      const actionKind: 'punch' | 'mine' =
        selDef?.toolKind === 'pickaxe' || this.selectedItemId === ITEM_IDS.WRENCH ? 'mine' : 'punch';
      const localCast = this.activeCasts.get(this.localPlayerId);
      const localFishState: 'none' | 'hold' | 'reel' = localCast
        ? localCast.biting
          ? 'reel'
          : 'hold'
        : 'none';
      const localTopY = this.drawCharacter(
        ctx,
        this.body.x - cx,
        this.body.y - cy,
        this.body.facing,
        this.body.vx,
        this.body.vy,
        this.body.grounded,
        this.punchAnimTimer > 0,
        this.placeAnimTimer > 0,
        this.localShirtColor,
        this.body.walkDistance * 0.165,
        nowMs,
        punchProgress,
        this.localEquipped,
        actionKind,
        this.landAnimTimer > 0,
        localFishState
      );
      queuedPlayerTitles.push({
        playerId: this.localPlayerId,
        name: this.localPlayerName,
        role: this.resolvePlayerWorldRole(this.localPlayerId, this.localPlayerRole),
        screenX: (this.body.x - cx + PLAYER_WIDTH * 0.5) * viewScale,
        screenY: localTopY * viewScale,
        worldX: this.body.x,
        worldY: this.body.y,
        showWrench: false,
      });

      // Signboard display:
      // 1) Static pixel-art directional text labels on NEXUS navigational WOODEN_SIGN & Multi-Way Door blocks
      // 2) Full signboard floating banner ONLY when standing directly on the sign block
      if (this.world.signs) {
        const ptx = (this.body.x + PLAYER_WIDTH * 0.5) / TILE_SIZE;
        const pty = (this.body.y + PLAYER_HEIGHT * 0.5) / TILE_SIZE;
        const playerTileX = Math.floor(ptx);
        const playerTileY = Math.floor(pty);
        for (const key in this.world.signs) {
          const text = this.world.signs[key];
          if (!text) continue;
          const [sxStr, syStr] = key.split(',');
          const stx = Number(sxStr);
          const sty = Number(syStr);

          // Static pixel-art text label rendered directly above NEXUS directional signs
          if (
            this.world.name === 'NEXUS' &&
            (text === '← Fresh Greens' || text === 'Realm Steward →' || text === '↑ Exchange & Furnace')
          ) {
            const sx = stx * TILE_SIZE - cx;
            const sy = sty * TILE_SIZE - cy;
            if (sx + TILE_SIZE >= -60 && sx <= viewW + 60 && sy + TILE_SIZE >= -30 && sy <= viewH + 30) {
              ctx.font = 'bold 8px monospace';
              const tw = Math.ceil(ctx.measureText(text).width);
              const pw = tw + 8;
              const ph = 12;
              const px = Math.round(sx + TILE_SIZE * 0.5 - pw * 0.5);
              const py = Math.round(sy - (stx === 52 ? 22 : 10));
              ctx.fillStyle = '#2d1c10';
              ctx.fillRect(px - 1, py - 1, pw + 2, ph + 2);
              ctx.fillStyle = '#6d4829';
              ctx.fillRect(px, py, pw, ph);
              ctx.fillStyle = '#e1b67a';
              ctx.fillRect(px + 1, py + 1, pw - 2, 1);
              ctx.fillStyle = '#fffbeb';
              ctx.fillText(text, px + 4, py + 9);
            }
          }

          // Sign banner display range: ONLY when standing on the sign block
          if (playerTileX === stx && playerTileY === sty) {
            queuedSignBanners.push({
              text,
              screenX: (stx * TILE_SIZE - cx + TILE_SIZE * 0.5) * viewScale,
              screenY: (sty * TILE_SIZE - cy) * viewScale,
            });
          }
        }
      }

      // NEXUS Multi-Way Navigational Doorway pixel-art cue
      if (this.world.name === 'NEXUS') {
        const doorCoords: Array<[number, number]> = [
          [53, 29],
          [31, 27],
          [69, 27],
          [51, 17],
        ];
        for (const [dtx, dty] of doorCoords) {
          const idx = dty * ww + dtx;
          if (isDoorBlock(this.world.bg[idx]) || isDoorBlock(this.world.fg[idx])) {
            const dsx = dtx * TILE_SIZE - cx;
            const dsy = dty * TILE_SIZE - cy;
            if (dsx + TILE_SIZE >= 0 && dsx <= viewW && dsy + TILE_SIZE >= 0 && dsy <= viewH) {
              const pulse = 0.45 + 0.25 * Math.sin(nowMs * 0.005 + dtx);
              ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
              ctx.lineWidth = 2;
              ctx.strokeRect(dsx + 2, dsy + 2, TILE_SIZE - 4, TILE_SIZE - 2);
              queuedNameplates.push({
                name: 'NEXUS TRANSIT DOOR (PUNCH)',
                screenX: (dsx + TILE_SIZE * 0.5) * viewScale,
                screenY: (dsy - 4) * viewScale,
              });
            }
          }
        }
      }

      // Fishing lines + bobbers + ! bite alerts
      for (const cast of this.activeCasts.values()) {
        let rodX = 0;
        let rodY = 0;
        const rodOffX = cast.biting ? 21 : 24;
        const rodOffY = cast.biting ? 27 : 30;
        if (cast.playerId === this.localPlayerId) {
          rodX = this.body.x + PLAYER_WIDTH * 0.5 + this.body.facing * rodOffX - cx;
          rodY = this.body.y + rodOffY - cy;
        } else {
          const rp = this.remotePlayers.get(cast.playerId);
          if (!rp) continue;
          rodX = rp.renderX + PLAYER_WIDTH * 0.5 + rp.facing * rodOffX - cx;
          rodY = rp.renderY + rodOffY - cy;
        }
        const bobX = cast.bobberTx * TILE_SIZE + TILE_SIZE * 0.5 - cx;
        const bobY =
          cast.bobberTy * TILE_SIZE +
          TILE_SIZE * 0.45 +
          Math.sin(nowMs * (cast.biting ? 0.035 : 0.008)) * (cast.biting ? 5 : 2) +
          (cast.biting ? (cast.bobberOffset ?? 0) : 0) - cy;
        const tension = cast.lineTension ?? 0.15;
        ctx.strokeStyle = tension > 0.82 ? '#ff6255' : tension < 0.38 ? '#77e7ff' : '#e8eff7';
        ctx.lineWidth = 1.2 + tension * 1.2;
        ctx.beginPath();
        ctx.moveTo(rodX, rodY);
        const midX = (rodX + bobX) * 0.5;
        const midY = (rodY + bobY) * 0.5 + (1 - tension) * 7;
        ctx.quadraticCurveTo(midX, midY, bobX, bobY);
        ctx.stroke();

        ctx.fillStyle = '#151b26';
        ctx.fillRect(Math.round(bobX - 6), Math.round(bobY - 6), 12, 12);
        ctx.fillStyle = cast.biting ? '#ff4a36' : '#e0503e';
        ctx.fillRect(Math.round(bobX - 4), Math.round(bobY - 4), 8, 5);
        ctx.fillStyle = '#f7f4eb';
        ctx.fillRect(Math.round(bobX - 4), Math.round(bobY + 1), 8, 3);

        if (cast.biting) {
          ctx.fillStyle = '#ffe18c';
          ctx.font = 'bold 16px monospace';
          ctx.fillText('!', Math.round(bobX - 4), Math.round(bobY - 12));
        }
      }

      // Tool swing slash arc when punching/mining
      if (this.punchAnimTimer > 0) {
        const pt = 1 - Math.max(0, Math.min(1, this.punchAnimTimer / PUNCH_ANIM_DURATION));
        const arcCx = this.body.x + PLAYER_WIDTH * 0.5 + this.body.facing * 20 - cx;
        const arcCy = this.body.y + PLAYER_HEIGHT * 0.45 - cy;
        ctx.save();
        ctx.globalAlpha = Math.max(0, (1 - pt) * 0.8);
        ctx.strokeStyle = actionKind === 'mine' ? '#8cf7ee' : '#fef08a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (this.body.facing === 1) {
          ctx.arc(arcCx, arcCy, 16 + pt * 4, -0.95 + pt * 0.5, 0.75 + pt * 0.4);
        } else {
          ctx.arc(arcCx, arcCy, 16 + pt * 4, Math.PI - 0.75 - pt * 0.4, Math.PI + 0.95 - pt * 0.5);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Animated tile targeting reticle with pulsing corner brackets & placement ghost hint
      const { tx, ty } = this.punchStick.active
        ? this.getTargetTileFromJoystick()
        : this.getTargetTileFromCursor();
      if (inBoundsWorld(this.world, tx, ty)) {
        const playerCtx = {
          id: this.localPlayerId,
          x: this.body.x,
          y: this.body.y,
          adminWorldEdit: this.adminWorldEdit,
        };
        const reach = this.adminWorldEdit
          ? Math.max(12, this.gameConfig.mechanics.reachTiles)
          : this.gameConfig.mechanics.reachTiles;
        const activeItemId = this.getEffectiveInteractItemId();
        const sDef = getItemDef(activeItemId);
        const isBreakTool = activeItemId === ITEM_IDS.FIST || sDef?.toolKind === 'pickaxe';
        const isHoeTool = sDef?.toolKind === 'hoe';
        const isNonPlaceTool = activeItemId === ITEM_IDS.WRENCH || sDef?.category === 'consumable' || sDef?.toolKind === 'rod';
        const targetTileIdx = tileIndexIn(this.world, tx, ty);
        const isSpecialInspectTarget =
          this.world.fg[targetTileIdx] === ITEM_IDS.WORLD_CORE ||
          this.world.bg[targetTileIdx] === ITEM_IDS.STONE_FURNACE ||
          Boolean(getMarketStandAt(this.world, tx, ty));
        const canAct = isSpecialInspectTarget
          ? true
          : isHoeTool
            ? canPlowTile(this.world, playerCtx, tx, ty, reach).ok
            : isBreakTool
              ? canBreakTile(this.world, playerCtx, tx, ty, reach).ok
              : isNonPlaceTool
                ? true
                : canPlaceTile(this.world, playerCtx, activeItemId, tx, ty, reach).ok;

        const rx = tx * TILE_SIZE - cx;
        const ry = ty * TILE_SIZE - cy;
        const pulse = Math.sin(nowMs * 0.009) * 1.5;

        // Faint placement ghost sprite when aiming a placeable block/machine/pot
        if (canAct && !isBreakTool && !isHoeTool && !isNonPlaceTool && !isSpecialInspectTarget && sDef?.placeable) {
          ctx.save();
          ctx.globalAlpha = 0.34;
          ctx.drawImage(getTileSprite(activeItemId), rx, ry, TILE_SIZE, TILE_SIZE);
          ctx.restore();
        }

        const bracketColor = canAct
          ? this.adminWorldEdit
            ? 'rgba(56, 232, 216, 0.96)'
            : 'rgba(255, 240, 128, 0.96)'
          : 'rgba(255, 110, 110, 0.65)';
        if (canAct) {
          ctx.fillStyle = this.adminWorldEdit
            ? 'rgba(56, 232, 216, 0.12)'
            : 'rgba(255, 245, 158, 0.09)';
          ctx.fillRect(rx + 2, ry + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        }

        const brk = 10;
        const pad = 1 - pulse * 0.5;
        ctx.strokeStyle = bracketColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        // Top-left
        ctx.moveTo(rx + pad, ry + pad + brk);
        ctx.lineTo(rx + pad, ry + pad);
        ctx.lineTo(rx + pad + brk, ry + pad);
        // Top-right
        ctx.moveTo(rx + TILE_SIZE - pad - brk, ry + pad);
        ctx.lineTo(rx + TILE_SIZE - pad, ry + pad);
        ctx.lineTo(rx + TILE_SIZE - pad, ry + pad + brk);
        // Bottom-right
        ctx.moveTo(rx + TILE_SIZE - pad, ry + TILE_SIZE - pad - brk);
        ctx.lineTo(rx + TILE_SIZE - pad, ry + TILE_SIZE - pad);
        ctx.lineTo(rx + TILE_SIZE - pad - brk, ry + TILE_SIZE - pad);
        // Bottom-left
        ctx.moveTo(rx + pad + brk, ry + TILE_SIZE - pad);
        ctx.lineTo(rx + pad, ry + TILE_SIZE - pad);
        ctx.lineTo(rx + pad, ry + TILE_SIZE - pad - brk);
        ctx.stroke();
      }
    }

    // 8. Pooled multi-shape VFX particles & floating world popups
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      const t = 1 - Math.max(0, Math.min(1, p.life / p.maxLife));
      const alpha = Math.max(0, 1 - t);
      const pxScreen = p.x - cx;
      const pyScreen = p.y - cy;

      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.shape === 'ring') {
        const radius = p.size + (p.endSize - p.size) * (1 - (1 - t) * (1 - t));
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1.2, 3 * (1 - t));
        ctx.beginPath();
        ctx.arc(pxScreen, pyScreen, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.shape === 'shard') {
        const curSize = Math.max(2, p.size + (p.endSize - p.size) * t);
        const half = curSize * 0.5;
        ctx.translate(pxScreen, pyScreen);
        ctx.rotate(p.rot);
        ctx.fillStyle = '#0d1520';
        ctx.fillRect(-half - 1, -half - 1, curSize + 2, curSize + 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(-half, -half, curSize, curSize);
        ctx.fillStyle = p.accentColor;
        ctx.fillRect(-half, -half, Math.max(1, curSize * 0.45), Math.max(1, curSize * 0.45));
      } else if (p.shape === 'plus') {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.floor(pxScreen - 1), Math.floor(pyScreen - 3), 2, 6);
        ctx.fillRect(Math.floor(pxScreen - 3), Math.floor(pyScreen - 1), 6, 2);
      } else if (p.shape === 'dust') {
        const curSize = p.size + (p.endSize - p.size) * t;
        ctx.globalAlpha = alpha * 0.65;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.floor(pxScreen - curSize * 0.5), Math.floor(pyScreen - curSize * 0.5), curSize, curSize);
      } else {
        // spark
        const curSize = Math.max(1.5, p.size * (1 - t * 0.5));
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.floor(pxScreen - curSize * 0.5), Math.floor(pyScreen - curSize * 0.5), curSize, curSize);
        ctx.fillStyle = p.accentColor;
        ctx.fillRect(Math.floor(pxScreen), Math.floor(pyScreen), 1.5, 1.5);
      }
      ctx.restore();
    }

    // Floating combat/gem/harvest world popups
    if (this.popups.length > 0) {
      ctx.save();
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const pop of this.popups) {
        const alpha = Math.max(0, Math.min(1, pop.life / (pop.maxLife * 0.55)));
        const sx = Math.round(pop.x - cx);
        const sy = Math.round(pop.y - cy);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#090e17';
        ctx.fillText(pop.text, sx + 1, sy + 1);
        ctx.fillStyle = pop.color;
        ctx.fillText(pop.text, sx, sy);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 9. Crisp HiDPI screen-space nameplates, overhead player titles & signboard overlays
    this.playerHitRegions = [];
    if (queuedNameplates.length > 0 || queuedPlayerTitles.length > 0 || queuedSignBanners.length > 0) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      for (const np of queuedNameplates) {
        const nameplate = this.getNameplateCanvas(np.name);
        const nw = nameplate.width / 2;
        const nh = nameplate.height / 2;
        const tagX = Math.round(np.screenX - nw * 0.5);
        const tagY = Math.round(np.screenY - nh - 6);
        ctx.drawImage(nameplate, tagX, tagY, nw, nh);
      }

      // Compute same-tile vertical staggering for overlapping players
      for (let i = 0; i < queuedPlayerTitles.length; i++) {
        const pt = queuedPlayerTitles[i];
        let overlapIndex = 0;
        let overlapTotal = 1;
        for (let j = 0; j < queuedPlayerTitles.length; j++) {
          if (i === j) continue;
          const other = queuedPlayerTitles[j];
          if (Math.abs(pt.worldX - other.worldX) < 28 && Math.abs(pt.worldY - other.worldY) < 28) {
            overlapTotal++;
            if (j < i) overlapIndex++;
          }
        }
        const scaleMult = pt.role === 'admin' ? 1.25 : 1;
        const titleCanvas = this.getPlayerTitleCanvas(pt.name, pt.role, pt.showWrench);
        const nw = Math.round((titleCanvas.width / 2) * scaleMult);
        const nh = Math.round((titleCanvas.height / 2) * scaleMult);
        // Strictly centered over the player's horizontal center (independent of facing direction)
        const tagX = Math.round(pt.screenX - nw * 0.5);
        const staggerY = overlapIndex * 14;
        const tagY = Math.round(pt.screenY - nh - 6 - staggerY);

        if (overlapTotal >= 3 && pt.playerId !== this.localPlayerId) {
          ctx.globalAlpha = 0.65;
        } else {
          ctx.globalAlpha = 1;
        }
        ctx.drawImage(titleCanvas, tagX, tagY, nw, nh);
        ctx.globalAlpha = 1;

        if (pt.remotePlayer && pt.showWrench) {
          const charLeft = (pt.worldX - cx) * viewScale;
          const charTop = (pt.worldY - cy) * viewScale;
          const charRight = (pt.worldX - cx + PLAYER_WIDTH) * viewScale;
          const charBottom = (pt.worldY - cy + PLAYER_HEIGHT) * viewScale;
          this.playerHitRegions.push({
            player: pt.remotePlayer,
            x0: Math.min(tagX - 6, charLeft - 6),
            y0: Math.min(tagY - 6, charTop - 6),
            x1: Math.max(tagX + nw + 6, charRight + 6),
            y1: Math.max(tagY + nh + 6, charBottom + 6),
          });
        }
      }

      for (const sb of queuedSignBanners) {
        const banner = this.getSignBannerCanvas(sb.text);
        const bw = banner.width / 2;
        const bh = banner.height / 2;
        const rawBx = Math.round(sb.screenX - bw * 0.5);
        const bx = Math.max(8, Math.min(Math.max(8, w - bw - 8), rawBx));
        const by = Math.max(8, Math.round(sb.screenY - bh - 8));
        ctx.drawImage(banner, bx, by, bw, bh);
      }
      ctx.restore();
    }
  }

  private resolvePlayerWorldRole(
    playerId: string,
    accountRole?: 'player' | 'admin'
  ): 'admin' | 'owner' | 'shared' | 'guest' {
    if (accountRole === 'admin') return 'admin';
    if (this.world.worldLock?.ownerId === playerId) return 'owner';
    if (this.world.worldLock?.editors?.some((e) => e.id === playerId)) return 'shared';
    if (
      this.world.shareLocks &&
      Object.values(this.world.shareLocks).some(
        (sl) => sl.ownerId === playerId || Boolean(sl.access?.[playerId])
      )
    ) {
      return 'shared';
    }
    return 'guest';
  }

  private getPlayerTitleCanvas(
    rawName: string,
    role: 'admin' | 'owner' | 'shared' | 'guest',
    showWrench: boolean
  ): HTMLCanvasElement {
    const cacheKey = `ptitle::${role}::${showWrench ? '1' : '0'}::${rawName}`;
    const cached = this.nameplateCache.get(cacheKey);
    if (cached) return cached;

    const displayName = role === 'admin' ? `@${rawName}` : rawName;
    const font = 'bold 16px "Press Start 2P", monospace';
    const c = document.createElement('canvas');
    const tmpCtx = c.getContext('2d')!;
    tmpCtx.font = font;
    const textW = Math.ceil(tmpCtx.measureText(displayName).width);

    const pillH = 34;
    const badgeD = 34; // Same elevation and dimensions round circle to the left of the pill
    const gap = 6;
    const pillPadX = 16;
    const pillW = textW + pillPadX * 2;
    const wrenchW = showWrench ? 34 + gap : 0;

    c.width = badgeD + gap + pillW + wrenchW + 4;
    c.height = pillH + 4;

    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const cy = c.height / 2;

    // 1. Left Circular Role Icon Badge (same elevation and height as the pill)
    const badgeCx = 2 + badgeD / 2;
    const badgeBorderColor =
      role === 'admin'
        ? '#FF9F1C'
        : role === 'owner'
          ? '#FACC15'
          : role === 'shared'
            ? '#34D399'
            : '#94A3B8';
    const badgeFillColor =
      role === 'admin'
        ? 'rgba(42, 18, 4, 0.55)'
        : role === 'owner'
          ? 'rgba(40, 28, 6, 0.45)'
          : role === 'shared'
            ? 'rgba(6, 38, 28, 0.45)'
            : 'rgba(15, 23, 42, 0.40)';

    ctx.beginPath();
    ctx.arc(badgeCx, cy, badgeD / 2 - 1, 0, Math.PI * 2);
    ctx.fillStyle = badgeFillColor;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(badgeCx, cy, badgeD / 2 - 2.5, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = badgeBorderColor;
    ctx.stroke();

    // Pixel-art Role Icon inside the left circle
    const ix = Math.round(badgeCx - 8);
    const iy = Math.round(cy - 8);
    if (role === 'admin') {
      // Golden-Orange Admin Star Crest
      ctx.fillStyle = '#000000';
      ctx.fillRect(ix + 5, iy + 1, 6, 14);
      ctx.fillRect(ix + 1, iy + 5, 14, 6);
      ctx.fillStyle = '#FF9F1C';
      ctx.fillRect(ix + 6, iy + 2, 4, 12);
      ctx.fillRect(ix + 2, iy + 6, 12, 4);
      ctx.fillStyle = '#FFF3B0';
      ctx.fillRect(ix + 7, iy + 7, 2, 2);
    } else if (role === 'owner') {
      // World Owner Gold Crown
      ctx.fillStyle = '#000000';
      ctx.fillRect(ix + 1, iy + 3, 14, 11);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(ix + 2, iy + 8, 12, 5);
      ctx.fillRect(ix + 2, iy + 4, 3, 5);
      ctx.fillRect(ix + 7, iy + 3, 2, 6);
      ctx.fillRect(ix + 11, iy + 4, 3, 5);
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(ix + 7, iy + 9, 2, 2);
    } else if (role === 'shared') {
      // Shared Access Emerald Key / Wrench
      ctx.fillStyle = '#000000';
      ctx.fillRect(ix + 2, iy + 3, 7, 7);
      ctx.fillRect(ix + 7, iy + 7, 7, 5);
      ctx.fillStyle = '#34D399';
      ctx.fillRect(ix + 3, iy + 4, 5, 5);
      ctx.fillRect(ix + 8, iy + 8, 5, 2);
      ctx.fillRect(ix + 11, iy + 10, 2, 2);
    } else {
      // Guest Visitor Silhouette
      ctx.fillStyle = '#000000';
      ctx.fillRect(ix + 5, iy + 2, 6, 6);
      ctx.fillRect(ix + 3, iy + 8, 10, 6);
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(ix + 6, iy + 3, 4, 4);
      ctx.fillRect(ix + 4, iy + 9, 8, 4);
    }

    // 2. Clear / Transparent Pill-Boxed Frame around Username
    const pillX = 2 + badgeD + gap;
    const pillY = 2;
    const r = pillH / 2;
    ctx.beginPath();
    ctx.moveTo(pillX + r, pillY);
    ctx.lineTo(pillX + pillW - r, pillY);
    ctx.arc(pillX + pillW - r, pillY + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(pillX + r, pillY + pillH);
    ctx.arc(pillX + r, pillY + r, r, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(10, 14, 24, 0.18)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = role === 'admin' ? 'rgba(255, 159, 28, 0.85)' : 'rgba(255, 255, 255, 0.55)';
    ctx.stroke();

    // 3. Username Text with Thin Black Outline & Pixel-Art Font
    ctx.font = font;
    ctx.textBaseline = 'middle';
    const tx = pillX + pillPadX;
    const ty = cy + 1;
    ctx.fillStyle = '#000000';
    for (const [ox, oy] of [
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
      [-1.5, -1.5],
      [1.5, -1.5],
      [-1.5, 1.5],
      [1.5, 1.5],
    ]) {
      ctx.fillText(displayName, tx + ox, ty + oy);
    }
    ctx.fillStyle = role === 'admin' ? '#FF9F1C' : '#F8FAFC';
    ctx.fillText(displayName, tx, ty);

    // 4. Optional Wrench Inspection Icon to the right of the Pill when Wrench Mode is active
    if (showWrench) {
      const wx = pillX + pillW + gap + badgeD / 2;
      ctx.beginPath();
      ctx.arc(wx, cy, badgeD / 2 - 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(12, 34, 52, 0.65)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#38BDF8';
      ctx.stroke();
      ctx.drawImage(getTileSprite(ITEM_IDS.WRENCH), Math.round(wx - 11), Math.round(cy - 11), 22, 22);
    }

    this.nameplateCache.set(cacheKey, c);
    return c;
  }

  private drawPlantedTree(
    ctx: CanvasRenderingContext2D,
    plant: PlantedTree,
    sx: number,
    sy: number,
    nowMs: number
  ) {
    const def = getItemDef(plant.seedId);
    const { visualStageIndex } = getPlantGrowthState(plant, nowMs);
    const leafColor = def?.colorPrimary ?? '#4ea84e';
    const shadeLeaf = def?.colorSecondary ?? '#286b35';
    const highlight = def?.colorAccent ?? '#b8f58c';

    const scale = TILE_SIZE / 48;
    const sway = Math.round(Math.sin(nowMs * 0.0025 + plant.x * 0.7) * (visualStageIndex === 3 ? 2 : 1));
    // 4 distinct visual stages: 0 (0-24%), 1 (25-59%), 2 (60-99%), 3 (100% Mature)
    const stageFactor =
      visualStageIndex === 0
        ? 0.15
        : visualStageIndex === 1
          ? 0.48
          : visualStageIndex === 2
            ? 0.78
            : 1.0;

    // Soil-sown Crop Seeds grow as 4-stage low-profile vegetable/fruit crop beds
    if (isCropSeed(plant.seedId)) {
      const moundW = Math.round(36 * scale);
      const moundX = sx + Math.round((TILE_SIZE - moundW) / 2);
      ctx.fillStyle = '#151b26';
      ctx.fillRect(moundX - 1, sy + TILE_SIZE - Math.round(9 * scale), moundW + 2, Math.round(9 * scale));
      ctx.fillStyle = '#5c381c';
      ctx.fillRect(moundX, sy + TILE_SIZE - Math.round(8 * scale), moundW, Math.round(7 * scale));

      if (visualStageIndex === 0) {
        // Stage 0 (0-24%): Tiny 2-leaf cotyledon sprout emerging from soil mound
        const sxCenter = sx + Math.round(TILE_SIZE * 0.5);
        const syBottom = sy + TILE_SIZE - Math.round(8 * scale);
        ctx.fillStyle = '#151b26';
        ctx.fillRect(sxCenter - 5, syBottom - 8, 10, 8);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(sxCenter - 1, syBottom - 6, 2, 6);
        ctx.fillStyle = '#86efac';
        ctx.fillRect(sxCenter - 4, syBottom - 7, 3, 3);
        ctx.fillRect(sxCenter + 1, syBottom - 7, 3, 3);
        return;
      }

      const bushW = Math.round((12 + stageFactor * 26) * scale);
      const bushH = Math.round((7 + stageFactor * 23) * scale);
      const bushX = sx + Math.round((TILE_SIZE - bushW) / 2) + sway;
      const bushY = sy + TILE_SIZE - Math.round(6 * scale) - bushH;

      ctx.fillStyle = '#151b26';
      ctx.fillRect(bushX - 2, bushY - 2, bushW + 4, bushH + 4);
      ctx.fillStyle = '#15803d';
      ctx.fillRect(bushX, bushY, bushW, bushH);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(bushX + 2, bushY + 2, Math.max(4, bushW - 4), Math.max(3, Math.floor(bushH * 0.6)));
      ctx.fillStyle = '#86efac';
      ctx.fillRect(bushX + 4, bushY + 2, Math.max(2, Math.floor(bushW * 0.5)), Math.max(2, Math.floor(bushH * 0.28)));

      if (visualStageIndex >= 2) {
        // Stage 2 shows unripe green/yellow buds; Stage 3 shows full vibrant ripe produce clusters
        const fruitSize = Math.round((visualStageIndex === 3 ? 7 : 4) * scale);
        const budColor = visualStageIndex === 3 ? leafColor : '#a3e635';
        const budHi = visualStageIndex === 3 ? highlight : '#ecfccb';
        for (const [fx, fy] of [
          [bushX + Math.round(bushW * 0.2), bushY + Math.round(bushH * 0.45)],
          [bushX + Math.round(bushW * 0.52), bushY + Math.round(bushH * 0.32)],
          [bushX + Math.round(bushW * 0.72), bushY + Math.round(bushH * 0.55)],
        ]) {
          ctx.fillStyle = '#151b26';
          ctx.fillRect(fx - 1, fy - 1, fruitSize + 2, fruitSize + 2);
          ctx.fillStyle = budColor;
          ctx.fillRect(fx, fy, fruitSize, fruitSize);
          ctx.fillStyle = budHi;
          ctx.fillRect(fx, fy, Math.max(2, Math.floor(fruitSize * 0.5)), Math.max(2, Math.floor(fruitSize * 0.5)));
        }
      }
      if (visualStageIndex === 3) {
        const bounce = Math.sin(nowMs * 0.008 + plant.x) * 2;
        ctx.font = 'bold 8px monospace';
        const tag = 'READY!';
        const tw = ctx.measureText(tag).width;
        const bx = Math.round(sx + TILE_SIZE / 2 - tw / 2 - 4);
        const by = Math.round(bushY - 14 + bounce);
        ctx.fillStyle = '#052e16';
        ctx.fillRect(bx - 1, by - 1, tw + 8, 13);
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(bx, by, tw + 6, 11);
        ctx.fillStyle = '#fef08a';
        ctx.fillText(tag, bx + 3, by + 8);
      }
      return;
    }

    const potKey = `${plant.x},${plant.y}`;
    const pIdx = tileIndexIn(this.world, plant.x, plant.y);
    if (this.world.seedPots?.[potKey] || this.world.fg[pIdx] === ITEM_IDS.SEED_POT) {
      ctx.drawImage(getTileSprite(ITEM_IDS.SEED_POT), sx, sy, TILE_SIZE, TILE_SIZE);
    }

    if (visualStageIndex === 0) {
      // Stage 0 (0-24%): Seed mound + tiny 2-leaf sprout
      if (!this.world.seedPots?.[potKey] && this.world.fg[pIdx] !== ITEM_IDS.SEED_POT) {
        ctx.fillStyle = '#151b26';
        ctx.fillRect(sx + Math.round(14 * scale), sy + Math.round(36 * scale), Math.round(20 * scale), Math.round(12 * scale));
        ctx.fillStyle = '#6b4222';
        ctx.fillRect(sx + Math.round(16 * scale), sy + Math.round(38 * scale), Math.round(16 * scale), Math.round(8 * scale));
      }
      ctx.fillStyle = '#151b26';
      ctx.fillRect(sx + Math.round(19 * scale), sy + Math.round(25 * scale), Math.round(10 * scale), Math.round(12 * scale));
      ctx.fillStyle = leafColor;
      ctx.fillRect(sx + Math.round(20 * scale), sy + Math.round(26 * scale), Math.round(8 * scale), Math.round(10 * scale));
      ctx.fillStyle = highlight;
      ctx.fillRect(sx + Math.round(20 * scale), sy + Math.round(26 * scale), Math.round(4 * scale), Math.round(5 * scale));
      return;
    }

    const canopyW = Math.round((14 + stageFactor * 26) * scale);
    const canopyH = Math.round((8 + stageFactor * 20) * scale);
    const canopyX = sx + Math.round((TILE_SIZE - canopyW) / 2) + sway;
    const canopyY = sy + Math.round(38 * scale) - canopyH - Math.round(stageFactor * 10 * scale);
    const trunkH = Math.round((9 + stageFactor * 25) * scale);
    const trunkW = Math.round((3 + stageFactor * 7) * scale);
    ctx.fillStyle = '#151b26';
    ctx.fillRect(sx + Math.round(24 * scale) - Math.floor(trunkW / 2), sy + TILE_SIZE - trunkH, trunkW + Math.round(2 * scale), trunkH);
    ctx.fillStyle = '#6b4222';
    ctx.fillRect(sx + Math.round(24 * scale) - Math.floor(trunkW / 2) + 1, sy + TILE_SIZE - trunkH + 1, trunkW, trunkH - 1);
    ctx.fillStyle = '#a36836';
    ctx.fillRect(sx + Math.round(24 * scale) - Math.floor(trunkW / 2) + 1, sy + TILE_SIZE - trunkH + 2, Math.round(2 * scale), trunkH - 3);

    const species = Math.abs(plant.seedId) % 3;
    const layers =
      species === 0
        ? [
            { inset: 7, y: 0, h: Math.max(3, Math.floor(canopyH * 0.38)) },
            { inset: 3, y: Math.floor(canopyH * 0.25), h: Math.max(4, Math.floor(canopyH * 0.48)) },
            { inset: 0, y: Math.floor(canopyH * 0.58), h: Math.max(3, Math.floor(canopyH * 0.42)) },
          ]
        : species === 1
          ? [
              { inset: Math.floor(canopyW * 0.34), y: 0, h: Math.max(3, Math.floor(canopyH * 0.34)) },
              { inset: Math.floor(canopyW * 0.2), y: Math.floor(canopyH * 0.25), h: Math.max(4, Math.floor(canopyH * 0.38)) },
              { inset: Math.floor(canopyW * 0.05), y: Math.floor(canopyH * 0.55), h: Math.max(3, Math.floor(canopyH * 0.45)) },
            ]
          : [
              { inset: Math.floor(canopyW * 0.24), y: 0, h: Math.max(3, Math.floor(canopyH * 0.3)) },
              { inset: Math.floor(canopyW * 0.1), y: Math.floor(canopyH * 0.22), h: Math.max(4, Math.floor(canopyH * 0.36)) },
              { inset: 0, y: Math.floor(canopyH * 0.5), h: Math.max(3, Math.floor(canopyH * 0.5)) },
            ];
    for (const layer of layers) {
      const layerW = Math.max(4, canopyW - layer.inset * 2);
      const layerX = canopyX + layer.inset;
      const layerY = canopyY + layer.y;
      ctx.fillStyle = '#151b26';
      ctx.fillRect(layerX - 2, layerY - 1, layerW + 4, layer.h + 2);
      ctx.fillStyle = shadeLeaf;
      ctx.fillRect(layerX, layerY, layerW, layer.h);
      ctx.fillStyle = leafColor;
      ctx.fillRect(layerX + 1, layerY + 1, Math.max(2, layerW - 2), Math.max(2, layer.h - 2));
    }
    ctx.fillStyle = highlight;
    ctx.fillRect(
      canopyX + Math.max(2, Math.floor(canopyW * 0.24)),
      canopyY + 2,
      Math.max(3, Math.floor(canopyW * 0.25)),
      Math.max(2, Math.floor(canopyH * 0.2))
    );
    if (visualStageIndex >= 2) {
      // Stage 2 shows small buds; Stage 3 shows ripe glowing fruits/crystals
      const fruitSz = visualStageIndex === 3 ? 5 : 3;
      for (const [fx, fy] of [
        [canopyX + Math.round(canopyW * 0.25), canopyY + Math.round(canopyH * 0.55)],
        [canopyX + Math.round(canopyW * 0.65), canopyY + Math.round(canopyH * 0.48)],
      ]) {
        ctx.fillStyle = visualStageIndex === 3 ? highlight : shadeLeaf;
        ctx.fillRect(fx, fy, fruitSz, fruitSz);
      }
    }
    if (visualStageIndex === 3) {
      const glint = 0.35 + 0.25 * Math.sin(nowMs * 0.004 + plant.x);
      ctx.fillStyle = `rgba(235,255,188,${glint})`;
      ctx.fillRect(canopyX + canopyW - 8, canopyY + 4, 4, 4);
    }
  }

  private getNameplateCanvas(name: string): HTMLCanvasElement {
    let cached = this.nameplateCache.get(name);
    if (cached) return cached;
    const c = document.createElement('canvas');
    const tmpCtx = c.getContext('2d')!;
    tmpCtx.font = 'bold 14px "Press Start 2P", monospace';
    const textW = Math.ceil(tmpCtx.measureText(name).width);
    c.width = textW + 24;
    c.height = 30;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(11, 22, 34, 0.84)';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.font = 'bold 14px "Press Start 2P", monospace';
    ctx.fillStyle = '#f4f1ea';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 12, c.height / 2 + 1);
    this.nameplateCache.set(name, c);
    return c;
  }

  private getSignBannerCanvas(text: string): HTMLCanvasElement {
    const cacheKey = `sign2x::${text}`;
    const cached = this.nameplateCache.get(cacheKey);
    if (cached) return cached;
    const c = document.createElement('canvas');
    const tmpCtx = c.getContext('2d')!;
    const font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    tmpCtx.font = font;
    const maxLineW = 440;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
      const candidate = current ? `${current} ${w}` : w;
      if (tmpCtx.measureText(candidate).width <= maxLineW || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);

    let widest = 0;
    for (const l of lines) {
      widest = Math.max(widest, Math.ceil(tmpCtx.measureText(l).width));
    }
    const lineH = 28;
    c.width = widest + 28;
    c.height = lines.length * lineH + 16;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(11, 22, 34, 0.9)';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#78c8f5';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, c.width - 2, c.height - 2);
    ctx.font = font;
    ctx.fillStyle = '#f4f1ea';
    lines.forEach((line, idx) => {
      ctx.fillText(line, 14, 28 + idx * lineH);
    });
    this.nameplateCache.set(cacheKey, c);
    return c;
  }

  private drawCharacter(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    facing: 1 | -1,
    vx: number,
    vy: number,
    grounded: boolean,
    punching: boolean,
    placing: boolean,
    shirtColor: string,
    walkPhase: number,
    nowMs: number,
    punchProgress: number,
    equipped?: EquippedWearables,
    actionKind: 'punch' | 'mine' = 'punch',
    landing = false,
    fishingState: 'none' | 'hold' | 'reel' = 'none'
  ): number {
    let pose: PlayerPose = (`idle${Math.floor(nowMs / 240) % 8}` as PlayerPose) || 'idle0';
    if (punching) {
      const pFrame = Math.min(3, Math.max(0, Math.floor(punchProgress * 4)));
      pose = (`${actionKind}${pFrame}` as PlayerPose) || 'punch3';
    } else if (placing) {
      pose = 'place';
    } else if (!grounded) {
      pose = vy < 0 ? 'jump' : 'fall';
    } else if (Math.abs(vx) > 15) {
      const step = Math.floor(walkPhase) % 8;
      pose = (`walk${step}` as PlayerPose) || 'walk0';
    } else if (fishingState === 'reel') {
      pose = 'fish_reel';
    } else if (fishingState === 'hold') {
      pose = 'fish_hold';
    } else if (landing) {
      pose = 'land';
    }

    const sprite = getPlayerSprite(pose, facing, shirtColor, equipped);
    const drawX = Math.round(screenX + (PLAYER_WIDTH - PLAYER_LOGICAL_W) * 0.5);
    const drawY = Math.round(screenY + PLAYER_HEIGHT - PLAYER_LOGICAL_H);

    // Draw crisp 1:1 nearest-neighbor 2D pixel-art character sprite matching world tile pixel density
    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, drawX, drawY, PLAYER_LOGICAL_W, PLAYER_LOGICAL_H);
    ctx.imageSmoothingEnabled = prevSmoothing;
    return drawY + 9;
  }
}
