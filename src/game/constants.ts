export const WORLD_WIDTH = 100;
export const WORLD_HEIGHT = 60;
export const BEDROCK_ROWS = 6;
export const PLAYABLE_ROWS = WORLD_HEIGHT - BEDROCK_ROWS; // 54 rows above bedrock
export const WORLD_TILE_COUNT = WORLD_WIDTH * WORLD_HEIGHT; // 6,000 tiles

export const TILE_SIZE = 60; // World tile size increased 25% larger (48px -> 60px)
export const DEFAULT_VIEW_SCALE = 1.5; // Crisps upscaled pixel view
export const MIN_PLAYER_ZOOM = 0.75;
export const MAX_PLAYER_ZOOM = 2.25;
export const MAX_WORLD_PLAYERS = 20;
export const MAX_REACH_TILES = 3.05; // 3-block interaction radius

// Player hitbox dimensions strictly 0.8 tiles wide x 1.75 tiles tall
export const PLAYER_WIDTH_TILES = 0.8;
export const PLAYER_HEIGHT_TILES = 1.75;
export const PLAYER_WIDTH = 48; // 0.8 * 60
export const PLAYER_HEIGHT = 105; // 1.75 * 60

export const MOVE_ACCEL = 1280;
export const MOVE_DECEL = 1480;
export const MAX_RUN_SPEED = 228;
export const GRAVITY = 1480;
export const MAX_FALL_SPEED = 820;
export const JUMP_VELOCITY = -769;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER_TIME = 0.12;

export const PUNCH_COOLDOWN_MS = 310;
export const PLANT_DEFAULT_GROWTH_MS = 20_000;
export const DROP_MAGNET_RADIUS = 69;
export const DROP_PICKUP_RADIUS = 36;
export const MAX_INVENTORY_SLOTS = 20;
export const MAX_INVENTORY_STACK = 500;

