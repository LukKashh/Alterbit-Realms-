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
import { isForegroundPlatform, isForegroundSolid } from './catalog.ts';
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
  if (tx < 0 || tx >= WORLD_WIDTH || ty < 0 || ty >= WORLD_HEIGHT) return 0;
  return world.fg[ty * WORLD_WIDTH + tx];
}

export function stepPlayerPhysics(
  body: PlayerBody,
  world: WorldState,
  input: PhysicsInput,
  dt: number,
  mechanics?: Partial<GameMechanicsConfig>
): { jumped: boolean; landed: boolean } {
  const clampedDt = Math.min(Math.max(dt, 0), 0.05);
  const maxRun = mechanics?.moveSpeed ?? MAX_RUN_SPEED;
  const jumpVel = mechanics?.jumpVelocity ?? JUMP_VELOCITY;
  const grav = mechanics?.gravity ?? GRAVITY;

  let jumped = false;
  let landed = false;

  // Horizontal velocity
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    body.facing = dir > 0 ? 1 : -1;
    body.vx += dir * MOVE_ACCEL * clampedDt;
    if (body.vx > maxRun) body.vx = maxRun;
    if (body.vx < -maxRun) body.vx = -maxRun;
  } else {
    const decel = MOVE_DECEL * clampedDt;
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

  // Move X & resolve solid foreground horizontal collisions across full 1.75-tile height
  const prevX = body.x;
  body.x += body.vx * clampedDt;
  if (body.x < 0) {
    body.x = 0;
    body.vx = 0;
  } else if (body.x + PLAYER_WIDTH > WORLD_WIDTH * TILE_SIZE) {
    body.x = WORLD_WIDTH * TILE_SIZE - PLAYER_WIDTH;
    body.vx = 0;
  }

  const topTileXPass = Math.floor((body.y + 2) / TILE_SIZE);
  const bottomTileXPass = Math.floor((body.y + PLAYER_HEIGHT - 2) / TILE_SIZE);
  if (body.vx > 0) {
    const rightTile = Math.floor((body.x + PLAYER_WIDTH) / TILE_SIZE);
    for (let ty = topTileXPass; ty <= bottomTileXPass; ty++) {
      if (isForegroundSolid(getTileAt(world, rightTile, ty))) {
        body.x = rightTile * TILE_SIZE - PLAYER_WIDTH - 0.01;
        body.vx = 0;
        break;
      }
    }
  } else if (body.vx < 0) {
    const leftTile = Math.floor(body.x / TILE_SIZE);
    for (let ty = topTileXPass; ty <= bottomTileXPass; ty++) {
      if (isForegroundSolid(getTileAt(world, leftTile, ty))) {
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
  const maxY = WORLD_HEIGHT * TILE_SIZE - PLAYER_HEIGHT;
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
      const tileTop = bottomTile * TILE_SIZE;
      const hitSolid = isForegroundSolid(tileId);
      const hitPlatform =
        !input.down && isForegroundPlatform(tileId) && prevBottom <= tileTop + 6;
      if (hitSolid || hitPlatform) {
        body.y = tileTop - PLAYER_HEIGHT;
        body.vy = 0;
        body.grounded = true;
        break;
      }
    }
  } else if (body.vy < 0) {
    const topTile = Math.floor(body.y / TILE_SIZE);
    for (let tx = leftTileYPass; tx <= rightTileYPass; tx++) {
      if (isForegroundSolid(getTileAt(world, tx, topTile))) {
        body.y = (topTile + 1) * TILE_SIZE + 0.01;
        body.vy = 0;
        break;
      }
    }
  }

  if (!wasGrounded && body.grounded) {
    landed = true;
  }

  if (body.grounded) {
    body.walkDistance += Math.abs(body.x - prevX);
  }

  return { jumped, landed };
}
