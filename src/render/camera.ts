import { CAMERA_STIFFNESS, MAX_ZOOM, MIN_ZOOM, TARGET_TILES_SHORT_SIDE, TILE_PX } from '../config';

/** Continuous zoom (device px per world px) showing TARGET_TILES_SHORT_SIDE tiles. */
export function computeZoom(deviceShortSide: number): number {
  const z = deviceShortSide / (TILE_PX * TARGET_TILES_SHORT_SIDE);
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/** Unrounded device position of world coordinate 0 on a screen axis. */
export function originOf(cameraWorld: number, zoom: number, screenSize: number): number {
  return screenSize / 2 - cameraWorld * zoom;
}

/**
 * Device rectangle [start, size] of chunk `index` along one axis. Start and end are rounded
 * independently, so neighbouring chunks share an edge exactly: no gaps or overlaps at
 * fractional zoom.
 */
export function chunkRect(
  index: number,
  chunkPx: number,
  zoom: number,
  origin: number,
): [number, number] {
  return spanRect(index * chunkPx, (index + 1) * chunkPx, zoom, origin);
}

/** Device rectangle [start, size] covering world span [startWorld, endWorld), both ends rounded once. */
export function spanRect(
  startWorld: number,
  endWorld: number,
  zoom: number,
  origin: number,
): [number, number] {
  const start = Math.round(origin + startWorld * zoom);
  return [start, Math.round(origin + endWorld * zoom) - start];
}

export function interpolate(prev: number, cur: number, alpha: number): number {
  return prev + (cur - prev) * alpha;
}

/**
 * Device-pixel position of world coordinate 0 on a screen axis. Rounding to whole device
 * pixels (not texture pixels) keeps the scroll smooth while art drawn at integer world
 * coordinates with an integer zoom stays crisp.
 */
export function screenOrigin(cameraWorld: number, zoom: number, screenSize: number): number {
  return Math.round(screenSize / 2 - cameraWorld * zoom);
}

/**
 * Device-pixel position of a moving sprite. Rounded once, relative to the camera, so a sprite
 * the camera follows holds still on screen instead of wobbling between two roundings.
 */
export function toScreen(
  world: number,
  cameraWorld: number,
  zoom: number,
  screenSize: number,
): number {
  return Math.round(screenSize / 2 + (world - cameraWorld) * zoom);
}

export class Camera {
  x = 0;
  y = 0;
  /** Position at the previous tick, for render interpolation. */
  prevX = 0;
  prevY = 0;

  snap(x: number, y: number): void {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
  }

  /** Frame-rate independent exponential follow. */
  follow(x: number, y: number, dt: number): void {
    this.prevX = this.x;
    this.prevY = this.y;
    const k = 1 - Math.exp(-CAMERA_STIFFNESS * dt);
    this.x += (x - this.x) * k;
    this.y += (y - this.y) * k;
  }
}
