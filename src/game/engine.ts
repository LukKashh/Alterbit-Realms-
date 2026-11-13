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
  onInspectTile?: (info: TileInspectInfo) => void;
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
  private scaleX = 1;
  private scaleY = 1;

  private keysHeld = new Set<string>();
  private jumpJustPressed = false;
  private touchState = { left: false, right: false, down: false, jumpHeld: false, punchHeld: false };
  private punchStick = { active: false, dx: 0, dy: 0 };

  private mouseScreenX = 0;
  private mouseScreenY = 0;
  private mouseInCanvas = false;
  private mouseDown = false;
  private activePointerId: number | null = null;
  private punchTimer = 0;
  private punchAnimTimer = 0;
  private placeAnimTimer = 0;
  private lastSyncSent = 0;
  private lastCoordTx = -1;
  private lastCoordTy = -1;
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
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(200, Math.floor(rect.height));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx.imageSmoothingEnabled = false;
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
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
    this.updatePointerCoords(e.clientX, e.clientY);
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.mode !== 'playing') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
    this.activePointerId = e.pointerId;
    this.updatePointerCoords(e.clientX, e.clientY);
    this.mouseDown = true;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events without active pointer capture
    }
    this.tryInteractAtCursor();
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
    this.mouseDown = false;
    this.activePointerId = null;
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

  public loadWorld(
    world: WorldState,
    players: RemotePlayerState[],
    drops: WorldDrop[]
  ) {
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
    this.body = createPlayerBody(world.spawnX, world.spawnY);
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
    this.snapCameraToPlayer();
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

    let firstRayTile: { tx: number; ty: number } | null = null;
    let prevKey = '';

    for (let d = 0.35; d <= reach; d += 0.15) {
      const tx = Math.max(0, Math.min(w - 1, Math.floor(pcx + dirX * d)));
      const ty = Math.max(0, Math.min(h - 1, Math.floor(pcy + dirY * d)));
      const key = `${tx},${ty}`;
      if (key === prevKey) continue;
      prevKey = key;

      if (!firstRayTile && (tx !== ptx || ty !== pty)) {
        firstRayTile = { tx, ty };
      }

      const idx = tileIndexIn(this.world, tx, ty);
      if (isBreakTool) {
        if (canBreakTile(this.world, playerCtx, tx, ty, reach).ok) {
          return { tx, ty };
        }
        const fgId = this.world.fg[idx];
        if (
          fgId !== ITEM_IDS.AIR &&
          (CATALOG[fgId]?.collision === 'solid' ||
            fgId === ITEM_IDS.VENDING_MACHINE ||
            fgId === ITEM_IDS.WORLD_LOCK ||
            fgId === ITEM_IDS.SMALL_LOCK ||
            fgId === ITEM_IDS.STONE_FURNACE ||
            fgId === ITEM_IDS.BFG_COLLECTOR ||
            fgId === ITEM_IDS.EXCHANGE_TERMINAL)
        ) {
          return { tx, ty };
        }
      } else if (this.selectedItemId === ITEM_IDS.WRENCH) {
        if (this.world.fg[idx] !== ITEM_IDS.AIR) {
          return { tx, ty };
        }
      } else if (selectedDef?.toolKind === 'rod') {
        if ((this.world.fluidLevel?.[idx] ?? 0) > 0) {
          return { tx, ty };
        }
      } else {
        if (canPlaceTile(this.world, playerCtx, this.selectedItemId, tx, ty, reach).ok) {
          return { tx, ty };
        }
        const fgId = this.world.fg[idx];
        if (
          selectedDef?.category !== 'background' &&
          fgId !== ITEM_IDS.AIR &&
          CATALOG[fgId]?.collision === 'solid'
        ) {
          return firstRayTile ?? { tx, ty };
        }
      }
    }

    return firstRayTile ?? this.getTargetTileFacing();
  }

  private tryInteractFacing() {
    const { tx, ty } = this.getTargetTileFacing();
    this.performTileInteraction(tx, ty);
  }

  private tryInteractAtCursor() {
    const { tx, ty } = this.getTargetTileFromCursor();
    this.performTileInteraction(tx, ty);
  }

  public emitInspectAt(tx: number, ty: number) {
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
      plantInfo = `${seedDef?.name ?? 'Seed'} (${g.stage} · ${Math.round(g.progress * 100)}%)`;
    }

    const coveringAreaLock = getCoveringAreaLock(this.world, tx, ty);
    const directAreaLock = this.world.areaLocks?.[key] ?? coveringAreaLock ?? null;
    const lockInfo = directAreaLock
      ? `Area Lock by ${directAreaLock.ownerName}`
      : this.world.worldLock
        ? `World Lock by ${this.world.worldLock.ownerName}`
        : 'Unlocked Area';

    soundEngine.uiClick();
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
    const viewW = (this.canvas.width || 960) / this.viewScale;
    const viewH = (this.canvas.height || 540) / this.viewScale;
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
    this.scaleX += (1 - this.scaleX) * (1 - Math.exp(-14 * dt));
    this.scaleY += (1 - this.scaleY) * (1 - Math.exp(-14 * dt));

    const viewW = this.canvas.width / this.viewScale;
    const viewH = this.canvas.height / this.viewScale;
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

    if (this.mouseDown && this.punchTimer <= 0) {
      this.tryInteractAtCursor();
    } else if (this.punchStick.active && this.punchTimer <= 0) {
      const { tx, ty } = this.getTargetTileFromJoystick();
      this.performTileInteraction(tx, ty);
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
      this.scaleX = 0.78;
      this.scaleY = 1.28;
      soundEngine.jump();
    } else if (result.jumped) {
      this.scaleX = 0.84;
      this.scaleY = 1.18;
      soundEngine.jump();
    } else if (result.landed) {
      this.scaleX = 1.2;
      this.scaleY = 0.82;
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
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const viewScale = this.viewScale;
    const viewW = w / viewScale;
    const viewH = h / viewScale;

    const shakeAmp = this.shakeTrauma * this.shakeTrauma * 6;
    const shakeX = shakeAmp > 0.1 ? (Math.random() * 2 - 1) * shakeAmp : 0;
    const shakeY = shakeAmp > 0.1 ? (Math.random() * 2 - 1) * shakeAmp : 0;

    const cx = Math.floor(this.camX + shakeX);
    const cy = Math.floor(this.camY + shakeY);

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
        ctx.fillRect(dx + 4, dy + 1, 16, 22);
        ctx.fillStyle = '#186e75';
        ctx.fillRect(dx + 6, dy + 3, 12, 18);
        ctx.fillStyle = '#38e8d8';
        ctx.fillRect(dx + 7, dy + 4, 10, 14);
        ctx.fillStyle = '#e0ffff';
        ctx.fillRect(dx + 8, dy + 5, 4, 7);
      } else {
        ctx.fillStyle = '#151b26';
        ctx.fillRect(dx - 2, dy - 2, 28, 28);
        ctx.drawImage(getTileSprite(drop.itemId), dx, dy, 24, 24);
        if (drop.qty > 1) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px monospace';
          ctx.fillText(String(drop.qty), dx + 13, dy + 23);
        }
      }
    }

    // 6. Remote players
    for (const rp of this.remotePlayers.values()) {
      this.drawCharacter(
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
        rp.name,
        1,
        1,
        nowMs * 0.007,
        nowMs,
        rp.punching ? ((nowMs % 320) / 320) : 0,
        rp.equipped
      );
    }

    // 7. Local player, nearby Sign banner & targeting reticle (3-block reach check)
    if (this.mode !== 'title') {
      const punchProgress =
        this.punchAnimTimer > 0
          ? Math.max(0, Math.min(1, 1 - this.punchAnimTimer / PUNCH_ANIM_DURATION))
          : 0;
      this.drawCharacter(
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
        this.localPlayerName,
        this.scaleX,
        this.scaleY,
        this.body.walkDistance * 0.085,
        nowMs,
        punchProgress,
        this.localEquipped
      );

      // Nearby Signboard floating caption
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
            const banner = this.getSignBannerCanvas(text);
            const rawBx = Math.round(stx * TILE_SIZE - cx + TILE_SIZE * 0.5 - banner.width * 0.5);
            const bx = Math.max(4, Math.min(Math.max(4, viewW - banner.width - 4), rawBx));
            const by = Math.max(4, Math.round(sty * TILE_SIZE - cy - banner.height - 6));
            ctx.drawImage(banner, bx, by);
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
          Math.sin(nowMs * (cast.biting ? 0.035 : 0.008)) * (cast.biting ? 5 : 2) -
          cy;
        ctx.strokeStyle = '#e8eff7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rodX, rodY);
        ctx.lineTo(bobX, bobY);
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

    if (stage === 'planted') {
      ctx.fillStyle = '#151b26';
      ctx.fillRect(sx + 14, sy + 36, 20, 12);
      ctx.fillStyle = '#6b4222';
      ctx.fillRect(sx + 16, sy + 38, 16, 8);
      ctx.fillStyle = leafColor;
      ctx.fillRect(sx + 20, sy + 28, 8, 10);
      ctx.fillStyle = highlight;
      ctx.fillRect(sx + 20, sy + 28, 4, 6);
    } else if (stage === 'sprout') {
      ctx.fillStyle = '#151b26';
      ctx.fillRect(sx + 20, sy + 22, 8, 26);
      ctx.fillStyle = '#6b4222';
      ctx.fillRect(sx + 22, sy + 24, 4, 24);
      ctx.fillStyle = '#151b26';
      ctx.fillRect(sx + 10, sy + 12, 28, 16);
      ctx.fillStyle = shadeLeaf;
      ctx.fillRect(sx + 12, sy + 14, 24, 12);
      ctx.fillStyle = leafColor;
      ctx.fillRect(sx + 12, sy + 14, 20, 9);
      ctx.fillStyle = highlight;
      ctx.fillRect(sx + 14, sy + 15, 10, 5);
    } else {
      // Mature lush tree proportioned cleanly to 48px tiles
      ctx.fillStyle = '#151b26';
      ctx.fillRect(sx + 18, sy + 14, 12, 34);
      ctx.fillStyle = '#6b4222';
      ctx.fillRect(sx + 20, sy + 16, 8, 32);
      ctx.fillStyle = '#a36836';
      ctx.fillRect(sx + 20, sy + 16, 3, 30);

      ctx.fillStyle = '#151b26';
      ctx.fillRect(sx + 4, sy - 8, 40, 28);
      ctx.fillStyle = shadeLeaf;
      ctx.fillRect(sx + 6, sy - 6, 36, 24);
      ctx.fillStyle = leafColor;
      ctx.fillRect(sx + 6, sy - 6, 32, 18);
      ctx.fillStyle = highlight;
      ctx.fillRect(sx + 10, sy - 3, 12, 8);
      ctx.fillRect(sx + 26, sy + 4, 8, 6);
    }
  }

  private getNameplateCanvas(name: string): HTMLCanvasElement {
    let cached = this.nameplateCache.get(name);
    if (cached) return cached;
    const c = document.createElement('canvas');
    const tmpCtx = c.getContext('2d')!;
    tmpCtx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
    const textW = Math.ceil(tmpCtx.measureText(name).width);
    c.width = textW + 10;
    c.height = 14;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(11, 22, 34, 0.78)';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#f4f1ea';
    ctx.fillText(name, 5, 11);
    this.nameplateCache.set(name, c);
    return c;
  }

  private getSignBannerCanvas(text: string): HTMLCanvasElement {
    const cacheKey = `sign::${text}`;
    const cached = this.nameplateCache.get(cacheKey);
    if (cached) return cached;
    const c = document.createElement('canvas');
    const tmpCtx = c.getContext('2d')!;
    const font = 'bold 10px "Plus Jakarta Sans", sans-serif';
    tmpCtx.font = font;
    const maxLineW = 210;
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
    const lineH = 13;
    c.width = widest + 12;
    c.height = lines.length * lineH + 6;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(11, 22, 34, 0.88)';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#78c8f5';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
    ctx.font = font;
    ctx.fillStyle = '#f4f1ea';
    lines.forEach((line, idx) => {
      ctx.fillText(line, 6, 13 + idx * lineH);
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
    name: string,
    scaleX: number,
    scaleY: number,
    walkPhase: number,
    nowMs: number,
    punchProgress: number,
    equipped?: EquippedWearables
  ) {
    let pose: PlayerPose = (`idle${Math.floor(nowMs / 280) % 4}` as PlayerPose) || 'idle0';
    if (punching) {
      const pFrame = Math.min(3, Math.max(0, Math.floor(punchProgress * 4)));
      pose = (`punch${pFrame}` as PlayerPose) || 'punch2';
    } else if (placing) {
      pose = 'place';
    } else if (!grounded) {
      pose = vy < 0 ? 'jump' : 'fall';
    } else if (Math.abs(vx) > 15) {
      const step = Math.floor(walkPhase) % 4;
      pose = (`walk${step}` as PlayerPose) || 'walk0';
    }

    const sprite = getPlayerSprite(pose, facing, shirtColor, equipped);
    const drawW = Math.round(sprite.width * scaleX);
    const drawH = Math.round(sprite.height * scaleY);
    const drawX = Math.round(screenX + (PLAYER_WIDTH - drawW) * 0.5);
    const drawY = Math.round(screenY + PLAYER_HEIGHT - drawH);

    ctx.drawImage(sprite, drawX, drawY, drawW, drawH);

    const nameplate = this.getNameplateCanvas(name);
    const tagX = Math.round(screenX + PLAYER_WIDTH * 0.5 - nameplate.width * 0.5);
    const tagY = Math.round(drawY - 16);
    ctx.drawImage(nameplate, tagX, tagY);
  }
}
