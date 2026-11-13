import {
  DEFAULT_VIEW_SCALE,
  DROP_PICKUP_RADIUS,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  TILE_SIZE,
} from './constants.ts';
import { CATALOG, getItemDef, ITEM_IDS } from './catalog.ts';
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
  getPlayerSprite,
  getTileSprite,
  type EquippedWearables,
  type PlayerPose,
} from './pixelArt.ts';
import {
  canBreakTile,
  canPlaceTile,
  getCoveringAreaLock,
  getPlantGrowthState,
  inBoundsWorld,
  tileIndexIn,
  worldHeight,
  worldWidth,
} from './rules.ts';
import {
  generateWorld,
  type AreaLockRecord,
  type BfgCollectorRecord,
  type FurnaceRecord,
  type PlantedTree,
  type VendingMachineRecord,
  type WorldLockRecord,
  type WorldState,
} from './worldGen.ts';
import { soundEngine } from './audio.ts';
import { BLOCKGROVE_ART_THEME } from './artTheme.ts';
import {
  createDungeonMap,
  getDungeonEnemyStats,
  type DungeonSnapshot,
} from './dungeon.ts';
import type { ActiveBuff, FishingCastState, RemotePlayerState, WorldDrop } from './network.ts';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
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
  vendingMachine?: VendingMachineRecord | null;
  furnace?: FurnaceRecord | null;
  bfgCollector?: BfgCollectorRecord | null;
  isExchangeTerminal?: boolean;
  signText?: string | null;
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
  onPunchTile?: (tx: number, ty: number, toolItemId?: number) => void;
  onPlaceTile?: (tx: number, ty: number, itemId: number) => void;
  onPickupDrop?: (dropId: string) => void;
  onInspectTile?: (info: TileInspectInfo | null) => void;
  onCoordsChange?: (tx: number, ty: number) => void;
  onCastFishing?: (tx: number, ty: number, rodItemId: number) => void;
  onReelFishing?: () => void;
  onUseConsumable?: (itemId: number) => void;
  onHazardHit?: (hazard: 'acid' | 'spikes') => void;
}

const MAX_PARTICLES = 128;
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
  private lastSyncSent = 0;
  private lastCoordTx = -1;
  private lastCoordTy = -1;
  private lastPlantInspectKey: string | null = null;
  private lastPlantInspectAt = 0;
  private titlePanTime = 0;
  private gameConfig: GameConfig = cloneGameConfig(DEFAULT_GAME_CONFIG);
  private viewScale = DEFAULT_VIEW_SCALE;

  private particles: Particle[] = [];
  private particleCursor = 0;

  private rafId: number | null = null;
  private throttleTimerId: number | null = null;
  private lastFrameMs = 0;
  private callbacks: EngineCallbacks;
  private nameplateCache = new Map<string, HTMLCanvasElement>();

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
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 0.4,
        size: 4,
        color: '#ffffff',
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
    equipped?: EquippedWearables
  ) {
    this.localPlayerId = id;
    this.localPlayerName = name;
    this.localShirtColor = shirtColor;
    if (equipped) this.localEquipped = equipped;
  }

  public setLocalEquipped(equipped: EquippedWearables) {
    this.localEquipped = equipped;
  }

  public setSelectedItem(itemId: number) {
    this.selectedItemId = itemId;
  }

  public applyGameConfig(cfg: GameConfig) {
    this.gameConfig = cloneGameConfig(cfg);
    this.viewScale = Math.max(1, Math.min(2.5, cfg.mechanics.viewScale || DEFAULT_VIEW_SCALE));
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
    const idx = ty * w + tx;
    const px = tx * TILE_SIZE;
    const py = ty * TILE_SIZE;
    this.worldLayerCtx.clearRect(px, py, TILE_SIZE, TILE_SIZE);
    const bgId = this.world.bg[idx];
    const fgId = this.world.fg[idx];
    const fgTransparent =
      fgId === ITEM_IDS.AIR ||
      !!CATALOG[fgId]?.transparent ||
      fgId === ITEM_IDS.ENTRANCE_PORTAL ||
      fgId === ITEM_IDS.SMALL_LOCK;

    if (bgId !== ITEM_IDS.BG_SKY && fgTransparent) {
      this.worldLayerCtx.drawImage(getTileSprite(bgId), px, py, TILE_SIZE, TILE_SIZE);
    }
    if (fgId !== ITEM_IDS.AIR) {
      this.worldLayerCtx.drawImage(getTileSprite(fgId), px, py, TILE_SIZE, TILE_SIZE);
    }
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
    this.cracks.set(`${tx},${ty}`, { hits, maxHits, expiresAt: performance.now() + 4000 });
    const idx = tileIndexIn(this.world, tx, ty);
    const fgId = this.world.fg[idx];
    const def =
      getEffectiveItemDef(fgId, this.gameConfig) ??
      getEffectiveItemDef(this.world.bg[idx], this.gameConfig);
    this.spawnParticles(
      tx * TILE_SIZE + TILE_SIZE * 0.5,
      ty * TILE_SIZE + TILE_SIZE * 0.5,
      6,
      def?.colorPrimary ?? '#a88462'
    );
  }

  public applyTileUpdated(
    tx: number,
    ty: number,
    fg: number,
    bg: number,
    plant: PlantedTree | null,
    worldLock?: WorldLockRecord | null,
    areaLock?: AreaLockRecord | null,
    vendingMachine?: VendingMachineRecord | null,
    signText?: string | null,
    fluidType?: number,
    fluidLevel?: number,
    furnace?: FurnaceRecord | null,
    bfgCollector?: BfgCollectorRecord | null
  ) {
    const idx = tileIndexIn(this.world, tx, ty);
    const key = `${tx},${ty}`;
    const prevFg = this.world.fg[idx];
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
    this.world.signs = this.world.signs ?? {};
    if (signText !== undefined) {
      if (signText) this.world.signs[key] = signText;
      else delete this.world.signs[key];
    }

    this.paintLayerTile(tx, ty);
    this.cracks.delete(key);

    if (prevFg !== ITEM_IDS.AIR && fg === ITEM_IDS.AIR) {
      const def = getItemDef(prevFg);
      this.spawnParticles(
        tx * TILE_SIZE + TILE_SIZE * 0.5,
        ty * TILE_SIZE + TILE_SIZE * 0.5,
        16,
        def?.colorPrimary ?? '#9c6e49'
      );
      this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.25);
      this.hitstopTimer = 0.035;
      soundEngine.breakBlock();
    } else if (fg !== ITEM_IDS.AIR) {
      const def = getItemDef(fg);
      this.spawnParticles(
        tx * TILE_SIZE + TILE_SIZE * 0.5,
        ty * TILE_SIZE + TILE_SIZE * 0.5,
        7,
        def?.colorAccent ?? '#ffffff'
      );
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
    const playerCtx = { id: this.localPlayerId, x: this.body.x, y: this.body.y };
    const reach = this.gameConfig.mechanics.reachTiles;
    const w = worldWidth(this.world);
    const h = worldHeight(this.world);
    const selectedDef = getItemDef(this.selectedItemId);
    const isBreakTool = this.selectedItemId === ITEM_IDS.FIST || selectedDef?.toolKind === 'pickaxe';
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
        if (fgId !== ITEM_IDS.AIR || hasPlant) {
          if (canBreakTile(this.world, playerCtx, tx, ty, reach).ok) {
            return { tx, ty };
          }
          if (
            CATALOG[fgId]?.collision === 'solid' ||
            fgId === ITEM_IDS.VENDING_MACHINE ||
            fgId === ITEM_IDS.WORLD_LOCK ||
            fgId === ITEM_IDS.SMALL_LOCK ||
            fgId === ITEM_IDS.STONE_FURNACE ||
            fgId === ITEM_IDS.BFG_COLLECTOR ||
            fgId === ITEM_IDS.EXCHANGE_TERMINAL
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

    if (this.selectedItemId === ITEM_IDS.WRENCH) {
      for (const { tx, ty } of inFrontTiles) {
        const idx = tileIndexIn(this.world, tx, ty);
        if (this.world.fg[idx] !== ITEM_IDS.AIR) {
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
      if (canPlaceTile(this.world, playerCtx, this.selectedItemId, tx, ty, reach).ok) {
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
      if (canPlaceTile(this.world, playerCtx, this.selectedItemId, tx, ty, reach).ok) {
        return { tx, ty };
      }
    }

    return firstFrontTile;
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
    const fgId = this.world.fg[idx];
    const fgDef = getItemDef(fgId);
    const bgDef = getItemDef(this.world.bg[idx]);
    const plant = this.world.plants[key];
    let plantInfo: string | undefined;
    if (plant) {
      const g = getPlantGrowthState(plant, Date.now());
      const seedDef = getItemDef(plant.seedId);
      const remaining = Math.max(0, Math.ceil(g.remainingMs / 1000));
      const timeLabel = remaining >= 60 ? `${Math.floor(remaining / 60)}m ${remaining % 60}s` : `${remaining}s`;
      plantInfo = `${seedDef?.name ?? 'Seed'} · ${g.stage} · ${Math.round(g.progress * 100)}% · ${g.stage === 'mature' ? 'Ready to harvest' : timeLabel + ' remaining'}`;
    }

    const coveringAreaLock = getCoveringAreaLock(this.world, tx, ty);
    const directAreaLock = this.world.areaLocks?.[key] ?? coveringAreaLock ?? null;
    const lockInfo = directAreaLock
      ? `Area Lock by ${directAreaLock.ownerName}`
      : this.world.worldLock
        ? `World Lock by ${this.world.worldLock.ownerName}`
        : 'Unlocked Area';

    if (!quiet) soundEngine.uiClick();
    this.callbacks.onInspectTile?.({
      tx,
      ty,
      fgId,
      fgName: fgDef?.name ?? 'Air',
      bgName: bgDef?.name ?? 'Open Sky',
      plantInfo,
      lockInfo,
      worldLock: fgId === ITEM_IDS.WORLD_LOCK ? this.world.worldLock : null,
      areaLock: fgId === ITEM_IDS.SMALL_LOCK ? (this.world.areaLocks?.[key] ?? null) : coveringAreaLock,
      vendingMachine: fgId === ITEM_IDS.VENDING_MACHINE ? (this.world.vendingMachines?.[key] ?? null) : null,
      furnace: fgId === ITEM_IDS.STONE_FURNACE ? (this.world.furnaces?.[key] ?? null) : null,
      bfgCollector: fgId === ITEM_IDS.BFG_COLLECTOR ? (this.world.bfgCollectors?.[key] ?? null) : null,
      isExchangeTerminal: fgId === ITEM_IDS.EXCHANGE_TERMINAL,
      signText: !!CATALOG[fgId]?.key.includes('sign') ? (this.world.signs?.[key] ?? '') : null,
    });
  }

  private performTileInteraction(tx: number, ty: number) {
    if (this.punchTimer > 0) return;
    if (!inBoundsWorld(this.world, tx, ty)) return;
    const playerCtx = { id: this.localPlayerId, x: this.body.x, y: this.body.y };
    const reach = this.gameConfig.mechanics.reachTiles;
    const selectedDef = getItemDef(this.selectedItemId);

    if (this.selectedItemId === ITEM_IDS.WRENCH) {
      this.punchTimer = 0.25;
      this.emitInspectAt(tx, ty);
      return;
    }

    if (selectedDef?.category === 'consumable') {
      this.punchTimer = 0.4;
      soundEngine.uiClick();
      this.callbacks.onUseConsumable?.(this.selectedItemId);
      return;
    }

    if (selectedDef?.toolKind === 'rod') {
      if (this.activeCasts.has(this.localPlayerId)) {
        this.punchTimer = 0.35;
        soundEngine.uiClick();
        this.callbacks.onReelFishing?.();
      } else {
        this.punchTimer = 0.45;
        soundEngine.punch();
        this.callbacks.onCastFishing?.(tx, ty, this.selectedItemId);
      }
      return;
    }

    if (this.selectedItemId === ITEM_IDS.FIST || selectedDef?.toolKind === 'pickaxe') {
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
      this.punchTimer = Math.max(0.08, baseCd * toolFactor * buffFactor);
      this.punchAnimTimer = PUNCH_ANIM_DURATION;
      const check = canBreakTile(this.world, playerCtx, tx, ty, reach);
      soundEngine.punch();
      if (check.ok) {
        this.callbacks.onPunchTile?.(tx, ty, this.selectedItemId);
      } else {
        const fgId = this.world.fg[tileIndexIn(this.world, tx, ty)];
        if (
          fgId === ITEM_IDS.VENDING_MACHINE ||
          fgId === ITEM_IDS.WORLD_LOCK ||
          fgId === ITEM_IDS.SMALL_LOCK ||
          fgId === ITEM_IDS.STONE_FURNACE ||
          fgId === ITEM_IDS.BFG_COLLECTOR ||
          fgId === ITEM_IDS.EXCHANGE_TERMINAL
        ) {
          this.emitInspectAt(tx, ty);
        }
      }
      return;
    }

    // Placing block / background / seed / lock / fluid / machine
    this.punchTimer = PLACE_COOLDOWN;
    const check = canPlaceTile(this.world, playerCtx, this.selectedItemId, tx, ty, reach);
    if (check.ok) {
      this.placeAnimTimer = PLACE_ANIM_DURATION;
      if (check.layer === 'seed') soundEngine.plant();
      else soundEngine.placeBlock();
      this.callbacks.onPlaceTile?.(tx, ty, this.selectedItemId);
    }
  }

  private spawnParticles(x: number, y: number, count: number, color: string) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;
      p.active = true;
      p.x = x;
      p.y = y;
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 140;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd - 60;
      p.maxLife = 0.28 + Math.random() * 0.25;
      p.life = p.maxLife;
      p.size = 3 + Math.floor(Math.random() * 3);
      p.color = color;
    }
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
      p.vy += 420 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
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

    if (result.bounced) {
      soundEngine.jump();
    } else if (result.jumped) {
      soundEngine.jump();
    } else if (result.landed) {
      soundEngine.land();
    }

    if (result.hazardHit) {
      this.spawnParticles(
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
        if (drop.isGem) soundEngine.gem();
        else soundEngine.pickup();
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

    // 1. Sky or Deep Cavern backdrop (unscaled full viewport)
    if (this.world.worldKind === 'mine_shaft') {
      ctx.fillStyle = '#121824';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = this.skyGradient ?? '#7ec8f2';
      ctx.fillRect(0, 0, w, h);

      // 2. Parallax pixel clouds & distant mountain silhouettes
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      for (let i = 0; i < 8; i++) {
        const cloudX = ((i * 260 - cx * 0.18 + nowMs * 0.008) % (w + 300)) - 140;
        const cloudY = 128 + (i % 3) * 48 - cy * 0.05;
        ctx.fillRect(Math.floor(cloudX), Math.floor(cloudY), 92, 18);
        ctx.fillRect(Math.floor(cloudX + 18), Math.floor(cloudY - 12), 54, 14);
      }

      ctx.fillStyle = 'rgba(72, 130, 168, 0.28)';
      for (let i = 0; i < 12; i++) {
        const mx = i * 240 - Math.floor(cx * 0.25);
        const my = Math.floor(24 * TILE_SIZE - cy * 0.35 - 70);
        ctx.beginPath();
        ctx.moveTo(mx - 60, h);
        ctx.lineTo(mx + 80, my);
        ctx.lineTo(mx + 220, h);
        ctx.closePath();
        ctx.fill();
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

    // 3b. Dynamic Water & Acid fluid cells in viewport
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
            ctx.fillStyle = fTyp === 2 ? 'rgba(98, 219, 60, 0.72)' : 'rgba(41, 148, 217, 0.68)';
            ctx.fillRect(fx, fy, TILE_SIZE, fillH);
            const waveOffset = Math.round(Math.sin(nowMs * 0.006 + tx * 0.9) * 2);
            ctx.fillStyle = fTyp === 2 ? 'rgba(196, 255, 118, 0.85)' : 'rgba(148, 224, 255, 0.82)';
            ctx.fillRect(fx, fy + waveOffset, TILE_SIZE, 4);
          }
        }
      }
    }

    // 4. Dynamic planted trees, machine status cues, vending machine stock & damage cracks
    for (const key in this.world.plants) {
      const plant = this.world.plants[key];
      const sx = plant.x * TILE_SIZE - cx;
      const sy = plant.y * TILE_SIZE - cy;
      if (sx >= -TILE_SIZE && sx <= viewW && sy >= -TILE_SIZE && sy <= viewH) {
        this.drawPlantedTree(ctx, plant, sx, sy, nowMs);
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

    // 5. Collectible Drops floating where they originate
    for (const drop of this.drops.values()) {
      const bob = Math.sin(nowMs * 0.005 + drop.x) * 4;
      const dx = Math.floor(drop.x - cx - 12);
      const dy = Math.floor(drop.y - cy - 12 + bob);
      if (drop.isGem) {
        ctx.fillStyle = '#151b26';
        ctx.fillRect(dx + 5, dy + 2, 14, 18);
        ctx.fillStyle = '#186e75';
        ctx.fillRect(dx + 6, dy + 3, 12, 16);
        ctx.fillStyle = '#38e8d8';
        ctx.fillRect(dx + 7, dy + 4, 10, 13);
        ctx.fillStyle = '#e0ffff';
        ctx.fillRect(dx + 8, dy + 5, 4, 7);
      } else {
        ctx.fillStyle = '#151b26';
        ctx.fillRect(dx + 1, dy + 1, 21, 21);
        ctx.drawImage(getTileSprite(drop.itemId), dx + 3, dy + 3, 18, 18);
        if (drop.qty > 1) {
          const label = drop.qty > 999 ? '999+' : String(drop.qty);
          ctx.font = 'bold 9px monospace';
          const badgeW = Math.max(15, Math.ceil(ctx.measureText(label).width) + 8);
          const badgeX = dx + 18 - badgeW + 5;
          const badgeY = dy + 15;
          ctx.fillStyle = '#101923';
          ctx.fillRect(badgeX - 1, badgeY - 1, badgeW + 2, 12);
          ctx.fillStyle = '#e8f2fa';
          ctx.fillRect(badgeX, badgeY, badgeW, 10);
          ctx.fillStyle = '#172536';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, badgeX + badgeW / 2, badgeY + 5);
          ctx.textAlign = 'start';
          ctx.textBaseline = 'alphabetic';
        }
      }
    }

    const queuedNameplates: Array<{ name: string; screenX: number; screenY: number }> = [];

    // 6. Remote players
    for (const rp of this.remotePlayers.values()) {
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
        nowMs * 0.007,
        nowMs,
        rp.punching ? ((nowMs % 320) / 320) : 0,
        rp.equipped
      );
      queuedNameplates.push({
        name: rp.name,
        screenX: (rp.renderX - cx + PLAYER_WIDTH * 0.5) * viewScale,
        screenY: topY * viewScale,
      });
    }

    // 7. Local player, nearby Sign banner & targeting reticle (3-block reach check)
    const queuedSignBanners: Array<{ text: string; screenX: number; screenY: number }> = [];
    if (this.mode !== 'title') {
      const punchProgress =
        this.punchAnimTimer > 0
          ? Math.max(0, Math.min(1, 1 - this.punchAnimTimer / PUNCH_ANIM_DURATION))
          : 0;
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
        this.body.walkDistance * 0.085,
        nowMs,
        punchProgress,
        this.localEquipped
      );
      queuedNameplates.push({
        name: this.localPlayerName,
        screenX: (this.body.x - cx + PLAYER_WIDTH * 0.5) * viewScale,
        screenY: localTopY * viewScale,
      });

      // Nearby Signboard floating caption (queued for crisp screen-space pass)
      if (this.world.signs) {
        const ptx = (this.body.x + PLAYER_WIDTH * 0.5) / TILE_SIZE;
        const pty = (this.body.y + PLAYER_HEIGHT * 0.5) / TILE_SIZE;
        for (const key in this.world.signs) {
          const text = this.world.signs[key];
          if (!text) continue;
          const [sxStr, syStr] = key.split(',');
          const stx = Number(sxStr);
          const sty = Number(syStr);
          if (Math.hypot(ptx - (stx + 0.5), pty - (sty + 0.5)) <= 2.6) {
            queuedSignBanners.push({
              text,
              screenX: (stx * TILE_SIZE - cx + TILE_SIZE * 0.5) * viewScale,
              screenY: (sty * TILE_SIZE - cy) * viewScale,
            });
          }
        }
      }

      // Fishing lines + bobbers + ! bite alerts
      for (const cast of this.activeCasts.values()) {
        let rodX = 0;
        let rodY = 0;
        if (cast.playerId === this.localPlayerId) {
          rodX = this.body.x + PLAYER_WIDTH * 0.5 + this.body.facing * 14 - cx;
          rodY = this.body.y + 34 - cy;
        } else {
          const rp = this.remotePlayers.get(cast.playerId);
          if (!rp) continue;
          rodX = rp.renderX + PLAYER_WIDTH * 0.5 + rp.facing * 14 - cx;
          rodY = rp.renderY + 34 - cy;
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

      // Tile targeting reticle
      const { tx, ty } = this.punchStick.active
        ? this.getTargetTileFromJoystick()
        : this.getTargetTileFromCursor();
      if (inBoundsWorld(this.world, tx, ty)) {
        const playerCtx = { id: this.localPlayerId, x: this.body.x, y: this.body.y };
        const reach = this.gameConfig.mechanics.reachTiles;
        const sDef = getItemDef(this.selectedItemId);
        const canAct =
          this.selectedItemId === ITEM_IDS.FIST || sDef?.toolKind === 'pickaxe'
            ? canBreakTile(this.world, playerCtx, tx, ty, reach).ok
            : this.selectedItemId === ITEM_IDS.WRENCH || sDef?.category === 'consumable' || sDef?.toolKind === 'rod'
              ? true
              : canPlaceTile(this.world, playerCtx, this.selectedItemId, tx, ty, reach).ok;

        ctx.strokeStyle = canAct ? 'rgba(255, 240, 128, 0.92)' : 'rgba(255, 110, 110, 0.55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(tx * TILE_SIZE - cx + 1, ty * TILE_SIZE - cy + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      }
    }

    // 8. Pooled particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.floor(p.x - cx), Math.floor(p.y - cy), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 9. Crisp HiDPI screen-space nameplates & signboard overlays (never distorted by world viewScale)
    if (queuedNameplates.length > 0 || queuedSignBanners.length > 0) {
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      for (const np of queuedNameplates) {
        const nameplate = this.getNameplateCanvas(np.name);
        const nw = nameplate.width / 2;
        const nh = nameplate.height / 2;
        const tagX = Math.round(np.screenX - nw * 0.5);
        const tagY = Math.round(np.screenY - nh - 6);
        ctx.drawImage(nameplate, tagX, tagY, nw, nh);
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

  private drawPlantedTree(
    ctx: CanvasRenderingContext2D,
    plant: PlantedTree,
    sx: number,
    sy: number,
    nowMs: number
  ) {
    const def = getItemDef(plant.seedId);
    const { stage } = getPlantGrowthState(plant, nowMs);
    const leafColor = def?.colorPrimary ?? '#4ea84e';
    const shadeLeaf = def?.colorSecondary ?? '#286b35';
    const highlight = def?.colorAccent ?? '#b8f58c';

    const sway = Math.round(Math.sin(nowMs * 0.0025 + plant.x * 0.7) * (stage === 'mature' ? 2 : 1));
    const growthScale = stage === 'planted' ? 0 : stage === 'sprout' ? 0.28 : stage === 'young' ? 0.48 : stage === 'developing' ? 0.76 : 1;
    const canopyW = Math.round(14 + growthScale * 26);
    const canopyH = Math.round(8 + growthScale * 20);
    const canopyX = sx + Math.round((48 - canopyW) / 2) + sway;
    const canopyY = sy + 38 - canopyH - Math.round(growthScale * 10);
    if (stage === 'planted') {
      ctx.fillStyle = '#151b26'; ctx.fillRect(sx + 14, sy + 36, 20, 12);
      ctx.fillStyle = '#6b4222'; ctx.fillRect(sx + 16, sy + 38, 16, 8);
      ctx.fillStyle = leafColor; ctx.fillRect(sx + 20, sy + 28, 8, 10);
      ctx.fillStyle = highlight; ctx.fillRect(sx + 20, sy + 28, 4, 6);
      return;
    }
    const trunkH = Math.round(9 + growthScale * 25);
    const trunkW = Math.round(3 + growthScale * 7);
    ctx.fillStyle = '#151b26'; ctx.fillRect(sx + 24 - Math.floor(trunkW / 2), sy + 48 - trunkH, trunkW + 2, trunkH);
    ctx.fillStyle = '#6b4222'; ctx.fillRect(sx + 24 - Math.floor(trunkW / 2) + 1, sy + 48 - trunkH + 1, trunkW, trunkH - 1);
    ctx.fillStyle = '#a36836'; ctx.fillRect(sx + 24 - Math.floor(trunkW / 2) + 1, sy + 48 - trunkH + 2, 2, trunkH - 3);
    // Seed IDs select a stable species silhouette while each species keeps its own palette.
    const species = Math.abs(plant.seedId) % 3;
    const layers = species === 0
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
    ctx.fillRect(canopyX + Math.max(2, Math.floor(canopyW * 0.24)), canopyY + 2,
      Math.max(3, Math.floor(canopyW * 0.25)), Math.max(2, Math.floor(canopyH * 0.2)));
    if (stage === 'mature') {
      const glint = 0.35 + 0.25 * Math.sin(nowMs * 0.004 + plant.x);
      ctx.fillStyle = `rgba(235,255,188,${glint})`;
      ctx.fillRect(canopyX + canopyW - 8, canopyY + 4, 3, 3);
    }
  }

  private getNameplateCanvas(name: string): HTMLCanvasElement {
    let cached = this.nameplateCache.get(name);
    if (cached) return cached;
    const c = document.createElement('canvas');
    const tmpCtx = c.getContext('2d')!;
    tmpCtx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
    const textW = Math.ceil(tmpCtx.measureText(name).width);
    c.width = textW + 24;
    c.height = 32;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(11, 22, 34, 0.84)';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
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
    equipped?: EquippedWearables
  ): number {
    let pose: PlayerPose = (`idle${Math.floor(nowMs / 280) % 4}` as PlayerPose) || 'idle0';
    if (punching) {
      const pFrame = Math.min(3, Math.max(0, Math.floor(punchProgress * 4)));
      pose = (`mine${pFrame}` as PlayerPose) || 'mine2';
    } else if (placing) {
      pose = 'place';
    } else if (!grounded) {
      pose = vy < 0 ? 'jump' : 'fall';
    } else if (Math.abs(vx) > 15) {
      const step = Math.floor(walkPhase) % 4;
      pose = (`walk${step}` as PlayerPose) || 'walk0';
    }

    const sprite = getPlayerSprite(pose, facing, shirtColor, equipped);
    const drawX = Math.round(screenX + (PLAYER_WIDTH - sprite.width) * 0.5);
    const drawY = Math.round(screenY + PLAYER_HEIGHT - sprite.height);

    // 1:1 native pixel blit with zero fractional resampling or squash/stretch blur
    ctx.drawImage(sprite, drawX, drawY);
    return drawY;
  }

  public renderDungeonFrame(
    targetCtx: CanvasRenderingContext2D,
    width: number,
    height: number,
    snapshot: DungeonSnapshot | null,
    playerId: string,
    yaw: number,
    opts?: DungeonRenderOptions
  ) {
    renderDungeonRaycaster(targetCtx, width, height, snapshot, playerId, yaw, opts);
  }
}

export interface DungeonRenderOptions {
  nowMs?: number;
  bobPhase?: number;
  slashTimer?: number;
  hitFlash?: number;
  fovRadians?: number;
  previewTier?: number;
}

interface DungeonTierPalette {
  wallBase: string;
  wallLight: string;
  wallDark: string;
  trim: string;
  accent: string;
  ceilTop: string;
  ceilBot: string;
  floorTop: string;
  floorBot: string;
  fogHex: string;
}

const DUNGEON_TIER_PALETTES: DungeonTierPalette[] = [
  {
    wallBase: '#3d4f66',
    wallLight: '#566f8c',
    wallDark: '#263242',
    trim: '#d8824c',
    accent: '#ffe18c',
    ceilTop: '#08101a',
    ceilBot: '#132030',
    floorTop: '#161e29',
    floorBot: '#293545',
    fogHex: '#0a121c',
  },
  {
    wallBase: '#4c5f73',
    wallLight: '#6b839c',
    wallDark: '#303d4b',
    trim: '#a4d4ec',
    accent: '#8cf7ee',
    ceilTop: '#09121c',
    ceilBot: '#152638',
    floorTop: '#18212b',
    floorBot: '#2c3a4a',
    fogHex: '#0b141f',
  },
  {
    wallBase: '#27473a',
    wallLight: '#3c6b58',
    wallDark: '#172b23',
    trim: '#42e88a',
    accent: '#b6ffcf',
    ceilTop: '#07140f',
    ceilBot: '#10261d',
    floorTop: '#12211a',
    floorBot: '#213d31',
    fogHex: '#081610',
  },
  {
    wallBase: '#2f2952',
    wallLight: '#49407d',
    wallDark: '#1c1833',
    trim: '#f2b738',
    accent: '#7df5ff',
    ceilTop: '#0b091a',
    ceilBot: '#181433',
    floorTop: '#18142b',
    floorBot: '#2d264f',
    fogHex: '#0c0a1c',
  },
  {
    wallBase: '#421d2b',
    wallLight: '#632c41',
    wallDark: '#261018',
    trim: '#ff5e7e',
    accent: '#ffd166',
    ceilTop: '#14070c',
    ceilBot: '#260d17',
    floorTop: '#210d14',
    floorBot: '#3d1926',
    fogHex: '#16080e',
  },
];

const dungeonTextureCache = new Map<string, HTMLCanvasElement>();
let rayBufferCanvas: HTMLCanvasElement | null = null;
let rayBufferCtx: CanvasRenderingContext2D | null = null;

function getDungeonTexture(
  kind: 'wall' | 'pillar' | 'entry' | 'exit_locked' | 'exit_open',
  tier: number
): HTMLCanvasElement {
  const safeTier = Math.max(1, Math.min(5, tier));
  const key = `${kind}_t${safeTier}`;
  const cached = dungeonTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const c = canvas.getContext('2d')!;
  c.imageSmoothingEnabled = false;

  const pal = DUNGEON_TIER_PALETTES[safeTier - 1];
  const ink = BLOCKGROVE_ART_THEME.ink.outline;
  const px = (vx: number, vy: number, vw: number, vh: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(vx * 3, vy * 3, vw * 3, vh * 3);
  };

  // Base masonry block in Blockgrove's 16x16 @ 3px crisp pixel style
  px(0, 0, 16, 16, pal.wallBase);
  // Top-left bevel highlight & bottom-right occlusion
  px(0, 0, 16, 1, pal.wallLight);
  px(0, 0, 1, 16, pal.wallLight);
  px(0, 15, 16, 1, pal.wallDark);
  px(15, 0, 1, 16, pal.wallDark);

  // Midnight-ink brick mortar seams
  for (const row of [4, 8, 12]) {
    px(0, row, 16, 1, ink);
    px(0, row - 1, 16, 1, pal.wallDark);
  }
  px(8, 0, 1, 4, ink);
  px(4, 4, 1, 4, ink);
  px(12, 4, 1, 4, ink);
  px(7, 8, 1, 4, ink);
  px(3, 12, 1, 4, ink);
  px(11, 12, 1, 4, ink);

  // Warm pixel stone specular chips
  px(2, 1, 3, 1, pal.wallLight);
  px(10, 2, 2, 1, pal.wallLight);
  px(6, 5, 3, 1, pal.wallLight);
  px(1, 9, 3, 1, pal.wallLight);
  px(9, 13, 3, 1, pal.wallLight);

  if (kind === 'pillar') {
    // Carved tier rune column with glowing ore veins & trim
    px(2, 1, 12, 14, pal.wallDark);
    px(3, 2, 10, 12, pal.wallBase);
    px(3, 2, 10, 1, pal.trim);
    px(3, 13, 10, 1, pal.trim);
    px(5, 4, 6, 8, ink);
    px(6, 5, 4, 6, pal.wallDark);
    // Glowing diamond rune core
    px(7, 6, 2, 4, pal.trim);
    px(6, 7, 4, 2, pal.trim);
    px(7, 7, 2, 2, pal.accent);
  } else if (kind === 'entry' || kind === 'exit_locked' || kind === 'exit_open') {
    const isEntry = kind === 'entry';
    const isOpen = kind === 'exit_open';
    const frameColor = isEntry ? '#78c8f5' : isOpen ? '#42e88a' : '#d96459';
    const glowColor = isEntry ? '#c2edff' : isOpen ? '#ffe18c' : '#ff9b8f';
    // Arch frame
    px(1, 2, 14, 14, ink);
    px(2, 3, 12, 13, frameColor);
    px(3, 4, 10, 12, '#09131d');
    // Inner portal energy
    px(4, 6, 8, 9, isEntry ? '#1d4f7a' : isOpen ? '#1d6949' : '#42191e');
    px(5, 7, 6, 7, isEntry ? '#3896d6' : isOpen ? '#37ba79' : '#73262e');
    px(7, 8, 2, 5, glowColor);

    // Top Silkscreen pixel banner nameplate matching Blockgrove's UI typography
    c.fillStyle = ink;
    c.fillRect(3, 1, 42, 12);
    c.fillStyle = '#0f1d2c';
    c.fillRect(4, 2, 40, 10);
    c.font = 'bold 7px "Silkscreen", monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = glowColor;
    c.fillText(isEntry ? 'ENTRY' : isOpen ? 'EXIT!' : 'LOCKED', 24, 7.5);
  } else {
    // Occasional tier crystal studding on outer perimeter wall
    px(1, 5, 2, 2, pal.trim);
    px(13, 10, 2, 2, pal.trim);
  }

  dungeonTextureCache.set(key, canvas);
  return canvas;
}

function getDungeonSpriteCanvas(
  kind: 'dweller' | 'drone' | 'boss' | 'portal_open' | 'portal_locked' | 'entry_pad',
  tier: number
): HTMLCanvasElement {
  const safeTier = Math.max(1, Math.min(5, tier));
  const key = `spr_${kind}_t${safeTier}`;
  const cached = dungeonTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const c = canvas.getContext('2d')!;
  c.imageSmoothingEnabled = false;

  const pal = DUNGEON_TIER_PALETTES[safeTier - 1];
  const ink = BLOCKGROVE_ART_THEME.ink.outline;
  const px = (vx: number, vy: number, vw: number, vh: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(vx * 3, vy * 3, vw * 3, vh * 3);
  };

  if (kind === 'portal_open' || kind === 'portal_locked' || kind === 'entry_pad') {
    const ring = kind === 'portal_open' ? '#42e88a' : kind === 'entry_pad' ? '#78c8f5' : '#e05b4f';
    const core = kind === 'portal_open' ? '#ffe18c' : kind === 'entry_pad' ? '#c9f0ff' : '#ff9e8f';
    // Floating pixel beacon pedestal
    px(4, 13, 8, 2, ink);
    px(5, 13, 6, 1, '#5a7087');
    px(5, 2, 6, 11, ink);
    px(6, 3, 4, 9, ring);
    px(7, 4, 2, 7, core);
    px(4, 5, 1, 5, ring);
    px(11, 5, 1, 5, ring);
  } else if (kind === 'drone') {
    // Brass & cyan hover drone
    px(3, 4, 10, 6, ink);
    px(4, 5, 8, 4, '#b8763e');
    px(4, 5, 8, 1, '#f5c07a');
    px(6, 6, 4, 2, '#102233');
    px(7, 6, 2, 2, '#38e8d8');
    px(2, 6, 1, 2, '#d88c48');
    px(13, 6, 1, 2, '#d88c48');
    px(6, 10, 4, 2, '#f2b738');
  } else if (kind === 'boss') {
    // Crowned Armored Boss
    px(2, 1, 2, 3, '#ffe18c');
    px(12, 1, 2, 3, '#ffe18c');
    px(6, 1, 4, 2, '#f2b738');
    px(3, 3, 10, 12, ink);
    px(4, 4, 8, 10, pal.wallLight);
    px(4, 4, 8, 2, pal.trim);
    px(5, 6, 2, 2, '#ff4d4d');
    px(9, 6, 2, 2, '#ff4d4d');
    px(6, 7, 1, 1, '#ffffff');
    px(10, 7, 1, 1, '#ffffff');
    px(5, 10, 6, 2, ink);
    px(6, 10, 1, 1, '#fff3cf');
    px(9, 10, 1, 1, '#fff3cf');
    px(1, 6, 2, 6, ink);
    px(13, 6, 2, 6, ink);
    px(1, 7, 1, 4, pal.trim);
    px(14, 7, 1, 4, pal.trim);
  } else {
    // Cavern Dweller / Slime / Golem
    const bodyColors = ['#4ec46a', '#7c93ab', '#38c77f', '#6d5ec9', '#cf4462'];
    const body = bodyColors[safeTier - 1];
    px(3, 5, 10, 9, ink);
    px(4, 6, 8, 7, body);
    px(4, 6, 8, 2, pal.accent);
    px(5, 8, 2, 2, ink);
    px(9, 8, 2, 2, ink);
    px(5, 8, 1, 1, '#fff8e8');
    px(9, 8, 1, 1, '#fff8e8');
    px(6, 11, 4, 1, ink);
  }

  dungeonTextureCache.set(key, canvas);
  return canvas;
}

export function renderDungeonRaycaster(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  snapshot: DungeonSnapshot | null,
  playerId: string,
  yaw: number,
  opts: DungeonRenderOptions = {}
) {
  if (width <= 0 || height <= 0) return;
  const nowMs = opts.nowMs ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const previewTier = snapshot?.tier ?? Math.max(1, Math.min(5, opts.previewTier ?? 1));
  const map = snapshot?.map ?? createDungeonMap(previewTier, 0, previewTier * 911);
  const mapH = map.length;
  const mapW = map[0]?.length ?? 17;
  const localPlayer = snapshot?.players.find((p) => p.id === playerId);
  const posX = localPlayer ? localPlayer.x : 3.5;
  const posY = localPlayer ? localPlayer.y : 5.5;
  const phase = snapshot?.phase ?? 'cleared';
  const pal = DUNGEON_TIER_PALETTES[Math.max(0, Math.min(4, previewTier - 1))];

  // Internal crisp pixel-art raycast buffer (~3x virtual pixel scale matching Blockgrove)
  const rayW = Math.max(240, Math.min(360, Math.floor(width / 3)));
  const rayH = Math.max(135, Math.round(rayW * (height / width)));

  if (!rayBufferCanvas) {
    rayBufferCanvas = document.createElement('canvas');
    rayBufferCtx = rayBufferCanvas.getContext('2d');
  }
  if (rayBufferCanvas.width !== rayW || rayBufferCanvas.height !== rayH) {
    rayBufferCanvas.width = rayW;
    rayBufferCanvas.height = rayH;
  }
  const rctx = rayBufferCtx!;
  rctx.imageSmoothingEnabled = false;

  const bobOffset = Math.sin(opts.bobPhase ?? 0) * 2.2;
  const horizon = Math.round(rayH * 0.5 + bobOffset);

  // 1. Ceiling & Floor Perspective Gradients + Stone Slab Depth Strips
  const ceilGrad = rctx.createLinearGradient(0, 0, 0, Math.max(1, horizon));
  ceilGrad.addColorStop(0, pal.ceilTop);
  ceilGrad.addColorStop(1, pal.ceilBot);
  rctx.fillStyle = ceilGrad;
  rctx.fillRect(0, 0, rayW, Math.max(0, horizon));

  const floorGrad = rctx.createLinearGradient(0, horizon, 0, rayH);
  floorGrad.addColorStop(0, pal.floorTop);
  floorGrad.addColorStop(1, pal.floorBot);
  rctx.fillStyle = floorGrad;
  rctx.fillRect(0, horizon, rayW, Math.max(0, rayH - horizon));

  // Perspective floor depth banding matching stone pavers
  for (let y = horizon + 2; y < rayH; y += 2) {
    const p = (y - horizon) / Math.max(1, rayH - horizon);
    if (Math.floor(p * 14) % 3 === 0) {
      rctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
      rctx.fillRect(0, y, rayW, 1);
    }
  }

  // Horizon cavern haze
  rctx.fillStyle = pal.fogHex;
  rctx.fillRect(0, horizon - 2, rayW, 4);

  // 2. DDA Raycasting Pass for Textured Walls
  const dirX = Math.cos(yaw);
  const dirY = Math.sin(yaw);
  const fovScale = opts.fovRadians ? Math.tan(opts.fovRadians * 0.5) : 0.66;
  const planeX = -dirY * fovScale;
  const planeY = dirX * fovScale;
  const zBuffer = new Float32Array(rayW);

  const wallOuterTex = getDungeonTexture('wall', previewTier);
  const pillarTex = getDungeonTexture('pillar', previewTier);
  const entryTex = getDungeonTexture('entry', previewTier);
  const exitTex = getDungeonTexture(phase === 'cleared' ? 'exit_open' : 'exit_locked', previewTier);

  for (let x = 0; x < rayW; x++) {
    const cameraX = (2 * x) / rayW - 1;
    const rayDirX = dirX + planeX * cameraX;
    const rayDirY = dirY + planeY * cameraX;

    let mapX = Math.floor(posX);
    let mapY = Math.floor(posY);

    const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
    const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);

    let stepX = 0;
    let stepY = 0;
    let sideDistX = 0;
    let sideDistY = 0;

    if (rayDirX < 0) {
      stepX = -1;
      sideDistX = (posX - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1.0 - posX) * deltaDistX;
    }
    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (posY - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1.0 - posY) * deltaDistY;
    }

    let hit = false;
    let side = 0;
    let steps = 0;
    while (!hit && steps < 48) {
      steps++;
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }
      if (mapX < 0 || mapY < 0 || mapX >= mapW || mapY >= mapH) {
        hit = true;
        break;
      }
      if (map[mapY][mapX] === '#') {
        hit = true;
      }
    }

    const rawDist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
    const perpWallDist = Math.max(0.18, rawDist);
    zBuffer[x] = perpWallDist;

    const lineHeight = Math.round(rayH / perpWallDist);
    const drawStart = Math.round(horizon - lineHeight * 0.5);

    let wallX = side === 0 ? posY + perpWallDist * rayDirY : posX + perpWallDist * rayDirX;
    wallX -= Math.floor(wallX);

    let texX = Math.floor(wallX * 48);
    if (side === 0 && rayDirX > 0) texX = 48 - texX - 1;
    if (side === 1 && rayDirY < 0) texX = 48 - texX - 1;
    texX = Math.max(0, Math.min(47, texX));

    // Pick textured wall face (gate banners at west/east portal walls, interior pillars, or outer masonry)
    let tex = wallOuterTex;
    if (mapX === 0 && mapY === 5) {
      tex = entryTex;
    } else if (mapX === mapW - 1 && mapY === 5) {
      tex = exitTex;
    } else if (mapX > 0 && mapX < mapW - 1 && mapY > 0 && mapY < mapH - 1) {
      tex = pillarTex;
    }

    rctx.drawImage(tex, texX, 0, 1, 48, x, drawStart, 1, lineHeight);

    // Directional N/S vs E/W lighting + depth fog
    const fogAlpha = Math.min(0.72, Math.max(0, (perpWallDist - 2.2) / 14));
    const sideShade = side === 1 ? 0.24 : 0;
    const totalShade = Math.min(0.82, fogAlpha + sideShade);
    if (totalShade > 0.02) {
      rctx.fillStyle = `rgba(7, 13, 22, ${totalShade.toFixed(3)})`;
      rctx.fillRect(x, drawStart, 1, lineHeight);
    }
  }

  // 3. Collect & Sort 3D Billboard Sprites (Portals, Teammates, Enemies)
  interface BillboardSprite {
    x: number;
    y: number;
    distSq: number;
    scale: number;
    vShift: number;
    tex: HTMLCanvasElement;
    label?: string;
    hpRatio?: number;
    isBoss?: boolean;
  }

  const sprites: BillboardSprite[] = [];
  const exitBeacon = getDungeonSpriteCanvas(phase === 'cleared' ? 'portal_open' : 'portal_locked', previewTier);
  const entryBeacon = getDungeonSpriteCanvas('entry_pad', previewTier);

  const exX = mapW - 1.5;
  const exY = 5.5;
  sprites.push({
    x: exX,
    y: exY,
    distSq: (exX - posX) ** 2 + (exY - posY) ** 2,
    scale: phase === 'cleared' ? 0.92 + Math.sin(nowMs * 0.006) * 0.05 : 0.78,
    vShift: 0.08,
    tex: exitBeacon,
    label: phase === 'cleared' ? 'EXTRACT' : 'GATE LOCKED',
  });

  const enX = 1.5;
  const enY = 5.5;
  if (Math.hypot(enX - posX, enY - posY) > 0.65) {
    sprites.push({
      x: enX,
      y: enY,
      distSq: (enX - posX) ** 2 + (enY - posY) ** 2,
      scale: 0.65,
      vShift: 0.16,
      tex: entryBeacon,
    });
  }

  if (snapshot) {
    for (const enemy of snapshot.enemies) {
      if (enemy.hp <= 0) continue;
      const eKind = enemy.boss ? 'boss' : enemy.kind === 'drone' ? 'drone' : 'dweller';
      sprites.push({
        x: enemy.x,
        y: enemy.y,
        distSq: (enemy.x - posX) ** 2 + (enemy.y - posY) ** 2,
        scale: enemy.boss ? 1.18 : enemy.kind === 'drone' ? 0.72 : 0.85,
        vShift: enemy.kind === 'drone' ? -0.05 + Math.sin(nowMs * 0.006 + enemy.x) * 0.04 : 0.06,
        tex: getDungeonSpriteCanvas(eKind, previewTier),
        label: enemy.name,
        hpRatio: Math.max(0, enemy.hp / Math.max(1, enemy.maxHp)),
        isBoss: enemy.boss,
      });
    }

    for (const member of snapshot.players) {
      if (member.id === playerId || member.hp <= 0) continue;
      const pSprite = getPlayerSprite('idle0', 1, '#3fa876');
      sprites.push({
        x: member.x,
        y: member.y,
        distSq: (member.x - posX) ** 2 + (member.y - posY) ** 2,
        scale: 0.85,
        vShift: 0.05,
        tex: pSprite,
        label: member.name,
        hpRatio: Math.max(0, member.hp / Math.max(1, member.maxHp)),
      });
    }
  } else {
    // Preview chamber guardian for the Gate Command Deck backdrop
    const gx = 8.5;
    const gy = 5.5 + Math.sin(nowMs * 0.0014) * 1.4;
    sprites.push({
      x: gx,
      y: gy,
      distSq: (gx - posX) ** 2 + (gy - posY) ** 2,
      scale: 1.05,
      vShift: 0.04,
      tex: getDungeonSpriteCanvas('boss', previewTier),
      label: getDungeonEnemyStats(previewTier, true).name,
      hpRatio: 1,
      isBoss: true,
    });
  }

  sprites.sort((a, b) => b.distSq - a.distSq);

  const invDet = 1.0 / (planeX * dirY - dirX * planeY || 1e-6);
  const spriteLabels: Array<{
    screenX: number;
    screenY: number;
    label: string;
    hpRatio?: number;
    isBoss?: boolean;
  }> = [];

  for (const sp of sprites) {
    const relX = sp.x - posX;
    const relY = sp.y - posY;
    const transformX = invDet * (dirY * relX - dirX * relY);
    const transformY = invDet * (-planeY * relX + planeX * relY);
    if (transformY <= 0.2) continue;

    const screenX = Math.round((rayW * 0.5) * (1 + transformX / transformY));
    const sprH = Math.abs(Math.round((rayH / transformY) * sp.scale));
    const sprW = Math.max(1, Math.round(sprH * (sp.tex.width / Math.max(1, sp.tex.height))));
    const drawStartY = Math.round(horizon - sprH * 0.5 + (rayH / transformY) * sp.vShift);
    const drawStartX = Math.round(screenX - sprW * 0.5);
    const drawEndX = drawStartX + sprW;

    let visibleStripes = 0;
    for (let stripe = Math.max(0, drawStartX); stripe < Math.min(rayW, drawEndX); stripe++) {
      if (transformY < zBuffer[stripe]) {
        visibleStripes++;
        const texX = Math.max(
          0,
          Math.min(sp.tex.width - 1, Math.floor(((stripe - drawStartX) * sp.tex.width) / sprW))
        );
        rctx.drawImage(sp.tex, texX, 0, 1, sp.tex.height, stripe, drawStartY, 1, sprH);
      }
    }

    if (visibleStripes > 2 && transformY < 10.5 && sp.label) {
      spriteLabels.push({
        screenX: (screenX / rayW) * width,
        screenY: (drawStartY / rayH) * height,
        label: sp.label,
        hpRatio: sp.hpRatio,
        isBoss: sp.isBoss,
      });
    }
  }

  // Blit crisp low-res raycast buffer to target viewport canvas without blur
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(rayBufferCanvas, 0, 0, width, height);

  // 4. First-Person Held Weapon & Slash Viewmodel (Bottom-Right Foreground)
  const slashProgress = Math.max(0, Math.min(1, opts.slashTimer ?? 0));
  const weaponSprite = getTileSprite(
    previewTier >= 4 ? ITEM_IDS.CRYSTAL_PICKAXE : previewTier >= 2 ? ITEM_IDS.IRON_PICKAXE : ITEM_IDS.STONE_PICKAXE
  );
  const weaponScale = Math.max(2.5, Math.min(4.2, width / 260));
  const swingAngle = slashProgress > 0 ? -0.95 + Math.sin(slashProgress * Math.PI) * 1.45 : -0.18;
  const weaponX = width * 0.72 - slashProgress * width * 0.16;
  const weaponY = height * 0.76 + Math.abs(Math.sin(opts.bobPhase ?? 0)) * 10 - slashProgress * 26;

  ctx.save();
  ctx.translate(Math.round(weaponX), Math.round(weaponY));
  ctx.rotate(swingAngle);
  ctx.drawImage(
    weaponSprite,
    -24 * weaponScale * 0.5,
    -24 * weaponScale * 0.5,
    48 * (weaponScale * 0.55),
    48 * (weaponScale * 0.55)
  );
  ctx.restore();

  if (slashProgress > 0.05) {
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.52, Math.min(width, height) * 0.18, -0.75, 0.75);
    ctx.stroke();
  }

  // Center 1P Crosshair
  ctx.fillStyle = 'rgba(255, 248, 232, 0.75)';
  const cxMid = Math.round(width * 0.5);
  const cyMid = Math.round(height * 0.5);
  ctx.fillRect(cxMid - 6, cyMid - 1, 4, 2);
  ctx.fillRect(cxMid + 2, cyMid - 1, 4, 2);
  ctx.fillRect(cxMid - 1, cyMid - 6, 2, 4);
  ctx.fillRect(cxMid - 1, cyMid + 2, 2, 4);

  // 5. Crisp Silkscreen Sprite Labels & Enemy HP Bars (Matching Blockgrove Font Style)
  ctx.font = 'bold 11px "Silkscreen", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (const lbl of spriteLabels) {
    const yPos = Math.max(26, Math.round(lbl.screenY) - 6);
    const xPos = Math.round(lbl.screenX);
    if (typeof lbl.hpRatio === 'number') {
      const barW = lbl.isBoss ? 86 : 56;
      const barH = 6;
      ctx.fillStyle = '#09131d';
      ctx.fillRect(xPos - barW * 0.5 - 1, yPos - 1, barW + 2, barH + 2);
      ctx.fillStyle = lbl.isBoss ? '#f59e0b' : '#e6482e';
      ctx.fillRect(xPos - barW * 0.5, yPos, Math.round(barW * lbl.hpRatio), barH);
    }
    ctx.fillStyle = '#09131d';
    ctx.fillText(lbl.label, xPos + 1, yPos - 4);
    ctx.fillStyle = lbl.isBoss ? '#ffe18c' : '#f4f1ea';
    ctx.fillText(lbl.label, xPos, yPos - 5);
  }

  // 6. Top-Right Pixel Minimap for Effortless 1P Orientation
  if (snapshot) {
    const cell = width < 640 ? 5 : 7;
    const mmW = mapW * cell;
    const mmH = mapH * cell;
    const mmX = width - mmW - 12;
    const mmY = 62;
    ctx.fillStyle = 'rgba(9, 19, 29, 0.88)';
    ctx.fillRect(mmX - 3, mmY - 3, mmW + 6, mmH + 6);
    ctx.strokeStyle = '#c89d54';
    ctx.lineWidth = 2;
    ctx.strokeRect(mmX - 3, mmY - 3, mmW + 6, mmH + 6);

    for (let gy = 0; gy < mapH; gy++) {
      for (let gx = 0; gx < mapW; gx++) {
        const tile = map[gy][gx];
        if (tile === '#') {
          ctx.fillStyle = pal.wallBase;
        } else if (tile === '>') {
          ctx.fillStyle = phase === 'cleared' ? '#42e88a' : '#d96459';
        } else if (tile === '<') {
          ctx.fillStyle = '#78c8f5';
        } else {
          ctx.fillStyle = '#111c29';
        }
        ctx.fillRect(mmX + gx * cell, mmY + gy * cell, cell, cell);
      }
    }

    for (const enemy of snapshot.enemies) {
      if (enemy.hp <= 0) continue;
      ctx.fillStyle = enemy.boss ? '#f2b738' : '#ff5555';
      ctx.fillRect(
        Math.round(mmX + enemy.x * cell - 2),
        Math.round(mmY + enemy.y * cell - 2),
        enemy.boss ? 5 : 4,
        enemy.boss ? 5 : 4
      );
    }

    const pxMm = mmX + posX * cell;
    const pyMm = mmY + posY * cell;
    ctx.strokeStyle = 'rgba(140, 247, 238, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pxMm, pyMm);
    ctx.lineTo(pxMm + Math.cos(yaw - 0.5) * cell * 2.4, pyMm + Math.sin(yaw - 0.5) * cell * 2.4);
    ctx.moveTo(pxMm, pyMm);
    ctx.lineTo(pxMm + Math.cos(yaw + 0.5) * cell * 2.4, pyMm + Math.sin(yaw + 0.5) * cell * 2.4);
    ctx.stroke();

    ctx.fillStyle = '#8cf7ee';
    ctx.fillRect(Math.round(pxMm - 2), Math.round(pyMm - 2), 4, 4);
  }

  // Hit vignette flash
  if ((opts.hitFlash ?? 0) > 0.01) {
    ctx.fillStyle = `rgba(230, 72, 46, ${(opts.hitFlash ?? 0) * 0.35})`;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}
