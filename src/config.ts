/** Texture pixels per tile. Sprites are drawn at this resolution (Gizmo 32x32, items 16x16). */
export const TILE_PX = 32;
/** Tiles per chunk side; 16 x 32 px keeps baked chunk canvases at 512 x 512. */
export const CHUNK_SIZE = 16;
export const CHUNK_PX = TILE_PX * CHUNK_SIZE;

export const TICK_DT = 1 / 60;
export const MAX_FRAME_SECONDS = 0.25;
export const MAX_TICKS_PER_FRAME = 5;

/** Base walking speed in world pixels per second (4.5 tiles/s). */
export const BASE_SPEED = 4.5 * TILE_PX;
export const TIRED_SPEED_MULT = 0.5;
export const MAX_ENERGY = 100;
export const MAGNET_RADIUS_TILES = 4;

export const CHUNK_CACHE_LIMIT = 256;
export const BAKED_CACHE_LIMIT = 32;
export const BAKES_PER_FRAME = 2;
export const PREFETCH_GENERATIONS_PER_FRAME = 1;

export const TARGET_TILES_SHORT_SIDE = 14;
export const MIN_ZOOM = 1;
export const CAMERA_STIFFNESS = 8;

export const SAVE_KEY = 'gizmo.save';
export const AUTOSAVE_SECONDS = 10;
