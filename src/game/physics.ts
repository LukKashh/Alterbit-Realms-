import {
  COYOTE_TIME,
  GRAVITY,
  JUMP_BUFFER_TIME,
  JUMP_VELOCITY,
  MAX_FALL_SPEED,
  MAX_RUN_SPEED,
  MOVE_ACCEL,
  MOVE_DECEL,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants.ts';
import { getItemDef, isForegroundPlatform, isForegroundSolid, ITEM_IDS } from './catalog.ts';
import type { GameMechanicsConfig } from './config.ts';
import type { WorldState } from './worldGen.ts';

export interface PlayerBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  walkDistance: number;
}

export interface PhysicsInput {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  jumpJustPressed: boolean;
  down: boolean;
}

export interface PhysicsStepResult {
  jumped: boolean;
  landed: boolean;
  bounced: boolean;
  onIce: boolean;
  inFluid: 0 | 1 | 2;
  hazardHit: 'acid' | 'spikes' | null;
}

export function createPlayerBody(spawnTileX: number, spawnTileY: number): PlayerBody {
  return {
    x: spawnTileX * TILE_SIZE + (TILE_SIZE - PLAYER_WIDTH) * 0.5,
    y: spawnTileY * TILE_SIZE + (TILE_SIZE - PLAYER_HEIGHT),
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    walkDistance: 0,
  };
}

function getTileAt(world: WorldState, tx: number, ty: number): number {
  const w = world.width || WORLD_WIDTH;
  const h = world.height || WORLD_HEIGHT;
  if (tx < 0 || tx >= w || ty < 0 || ty >= h) return 0;
  return world.fg[ty * w + tx];
}

function getFluidAt(world: WorldState, tx: number, ty: number): { type: number; level: number } {
  const w = world.width || WORLD_WIDTH;
  const h = world.height || WORLD_HEIGHT;
  if (tx < 0 || tx >= w || ty < 0 || ty >= h) return { type: 0, level: 0 };
  const idx = ty * w + tx;
  return {
    type: world.fluidType?.[idx] ?? 0,
    level: world.fluidLevel?.[idx] ?? 0,
  };
}

export function stepPlayerPhysics(
  body: PlayerBody,
  world: WorldState,
  input: PhysicsInput,
  dt: number,
  mechanics?: Partial<GameMechanicsConfig>
): PhysicsStepResult {
  const clampedDt = Math.min(Math.max(dt, 0), 0.05);
  const w = world.width || WORLD_WIDTH;
  const h = world.height || WORLD_HEIGHT;
  const maxRun = mechanics?.moveSpeed ?? MAX_RUN_SPEED;
  const jumpVel = mechanics?.jumpVelocity ?? JUMP_VELOCITY;
  const grav = mechanics?.gravity ?? GRAVITY;

  let jumped = false;
  let landed = false;
  let bounced = false;
  let onIce = false;
  let hazardHit: 'acid' | 'spikes' | null = null;

  // Detect fluid overlap at center / lower body
  const centerTx = Math.floor((body.x + PLAYER_WIDTH * 0.5) / TILE_SIZE);
  const centerTy = Math.floor((body.y + PLAYER_HEIGHT * 0.55) / TILE_SIZE);
  const feetTy = Math.floor((body.y + PLAYER_HEIGHT - 4) / TILE_SIZE);
  const midFluid = getFluidAt(world, centerTx, centerTy);
  const feetFluid = getFluidAt(world, centerTx, feetTy);
  const inFluid = (
    midFluid.level > 0 ? midFluid.type : feetFluid.level > 0 ? feetFluid.type : 0
  ) as 0 | 1 | 2;

  if (inFluid === 2) {
    hazardHit = 'acid';
  }

  // Check if standing on an Ice surface tile
  if (body.grounded) {
    const underTy = Math.floor((body.y + PLAYER_HEIGHT + 3) / TILE_SIZE);
    const leftTx = Math.floor((body.x + 2) / TILE_SIZE);
    const rightTx = Math.floor((body.x + PLAYER_WIDTH - 2) / TILE_SIZE);
    for (let tx = leftTx; tx <= rightTx; tx++) {
      const def = getItemDef(getTileAt(world, tx, underTy));
      if (def?.surfaceEffect === 'ice') {
        onIce = true;
        break;
      }
    }
  }

  // Horizontal velocity (ice keeps momentum with low friction; water dampens speed slightly)
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const effectiveMaxRun = inFluid === 1 ? maxRun * 0.68 : onIce ? maxRun * 1.18 : maxRun;
  const accel = onIce ? MOVE_ACCEL * 0.52 : inFluid === 1 ? MOVE_ACCEL * 0.72 : MOVE_ACCEL;
  const decelRate = onIce ? MOVE_DECEL * 0.16 : inFluid === 1 ? MOVE_DECEL * 0.55 : MOVE_DECEL;

  if (dir !== 0) {
    body.facing = dir > 0 ? 1 : -1;
    body.vx += dir * accel * clampedDt;
    if (body.vx > effectiveMaxRun) body.vx = effectiveMaxRun;
    if (body.vx < -effectiveMaxRun) body.vx = -effectiveMaxRun;
  } else {
    const decel = decelRate * clampedDt;
    if (Math.abs(body.vx) <= decel) {
      body.vx = 0;
    } else {
      body.vx -= Math.sign(body.vx) * decel;
    }
  }

  // Coyote & Jump Buffer
  if (body.grounded) {
    body.coyoteTimer = COYOTE_TIME;
  } else {
    body.coyoteTimer = Math.max(0, body.coyoteTimer - clampedDt);
  }

  if (input.jumpJustPressed) {
    body.jumpBufferTimer = JUMP_BUFFER_TIME;
  } else {
    body.jumpBufferTimer = Math.max(0, body.jumpBufferTimer - clampedDt);
  }

  if (inFluid === 1) {
    // Water buoyancy & swim paddle
    if (input.jumpHeld || input.jumpJustPressed) {
      body.vy = Math.max(-270, body.vy - 920 * clampedDt);
      if (input.jumpJustPressed) jumped = true;
    }
    body.vy = Math.min(200, body.vy + grav * 0.36 * clampedDt);
    body.vy *= 1 - Math.min(0.4, 2.2 * clampedDt);
  } else {
    if (body.jumpBufferTimer > 0 && body.coyoteTimer > 0) {
      body.vy = jumpVel;
      body.grounded = false;
      body.coyoteTimer = 0;
      body.jumpBufferTimer = 0;
      jumped = true;
    }

    // Variable jump height cut when releasing jump early
    if (!input.jumpHeld && body.vy < -140) {
      body.vy *= 0.65;
    }

    // Gravity
    body.vy = Math.min(MAX_FALL_SPEED, body.vy + grav * clampedDt);
  }

  // Move X & resolve solid foreground horizontal collisions across full 1.75-tile height
  const prevX = body.x;
  body.x += body.vx * clampedDt;
  if (body.x < 0) {
    body.x = 0;
    body.vx = 0;
  } else if (body.x + PLAYER_WIDTH > w * TILE_SIZE) {
    body.x = w * TILE_SIZE - PLAYER_WIDTH;
    body.vx = 0;
  }

  const topTileXPass = Math.floor((body.y + 2) / TILE_SIZE);
  const bottomTileXPass = Math.floor((body.y + PLAYER_HEIGHT - 2) / TILE_SIZE);
  if (body.vx > 0) {
    const rightTile = Math.floor((body.x + PLAYER_WIDTH) / TILE_SIZE);
    for (let ty = topTileXPass; ty <= bottomTileXPass; ty++) {
      const tid = getTileAt(world, rightTile, ty);
      if (tid === ITEM_IDS.GP_DEATH_SPIKES) hazardHit = 'spikes';
      if (isForegroundSolid(tid)) {
        body.x = rightTile * TILE_SIZE - PLAYER_WIDTH - 0.01;
        body.vx = 0;
        break;
      }
    }
  } else if (body.vx < 0) {
    const leftTile = Math.floor(body.x / TILE_SIZE);
    for (let ty = topTileXPass; ty <= bottomTileXPass; ty++) {
      const tid = getTileAt(world, leftTile, ty);
      if (tid === ITEM_IDS.GP_DEATH_SPIKES) hazardHit = 'spikes';
      if (isForegroundSolid(tid)) {
        body.x = (leftTile + 1) * TILE_SIZE + 0.01;
        body.vx = 0;
        break;
      }
    }
  }

  // Move Y & resolve solid + one-way platform vertical collisions
  const wasGrounded = body.grounded;
  const prevBottom = body.y + PLAYER_HEIGHT;
  body.y += body.vy * clampedDt;
  if (body.y < 0) {
    body.y = 0;
    if (body.vy < 0) body.vy = 0;
  }
  const maxY = h * TILE_SIZE - PLAYER_HEIGHT;
  if (body.y > maxY) {
    body.y = maxY;
    body.vy = 0;
    body.grounded = true;
  } else {
    body.grounded = false;
  }

  const leftTileYPass = Math.floor((body.x + 2) / TILE_SIZE);
  const rightTileYPass = Math.floor((body.x + PLAYER_WIDTH - 2) / TILE_SIZE);

  if (body.vy >= 0) {
    const bottomTile = Math.floor((body.y + PLAYER_HEIGHT) / TILE_SIZE);
    for (let tx = leftTileYPass; tx <= rightTileYPass; tx++) {
      const tileId = getTileAt(world, tx, bottomTile);
      if (tileId === ITEM_IDS.GP_DEATH_SPIKES) hazardHit = 'spikes';
      const tileTop = bottomTile * TILE_SIZE;
      const hitSolid = isForegroundSolid(tileId);
      const hitPlatform =
        !input.down && isForegroundPlatform(tileId) && prevBottom <= tileTop + 6;
      if (hitSolid || hitPlatform) {
        body.y = tileTop - PLAYER_HEIGHT;
        if (tileId === ITEM_IDS.BOUNCE_PAD) {
          body.vy = jumpVel * 1.62;
          body.grounded = false;
          bounced = true;
        } else {
          body.vy = 0;
          body.grounded = true;
        }
        break;
      }
    }
  } else if (body.vy < 0) {
    const topTile = Math.floor(body.y / TILE_SIZE);
    for (let tx = leftTileYPass; tx <= rightTileYPass; tx++) {
      const tid = getTileAt(world, tx, topTile);
      if (tid === ITEM_IDS.GP_DEATH_SPIKES) hazardHit = 'spikes';
      if (isForegroundSolid(tid)) {
        body.y = (topTile + 1) * TILE_SIZE + 0.01;
        body.vy = 0;
        break;
      }
    }
  }

  // Also check tile at center for spikes
  if (getTileAt(world, centerTx, feetTy) === ITEM_IDS.GP_DEATH_SPIKES) {
    hazardHit = 'spikes';
  }

  if (!wasGrounded && body.grounded) {
    landed = true;
  }

  if (body.grounded || inFluid === 1) {
    body.walkDistance += Math.abs(body.x - prevX);
  }

  return { jumped, landed, bounced, onIce, inFluid, hazardHit };
}
