import { CAMERA_STIFFNESS, MIN_ZOOM, TARGET_TILES_SHORT_SIDE, TILE_PX } from '../config';

/** Never zoom in so far that fewer than this many tiles fit on the short side. */
const MIN_TILES_SHORT_SIDE = 10;

/**
 * Integer zoom closest to showing TARGET_TILES_SHORT_SIDE tiles. With 32 px tiles one zoom
 * step changes the view a lot, so rounding down (as before) left small windows far too
 * zoomed out.
 */
export function computeZoom(deviceShortSide: number): number {
  const nearest = Math.round(deviceShortSide / (TILE_PX * TARGET_TILES_SHORT_SIDE));
  const maxZoom = Math.floor(deviceShortSide / (TILE_PX * MIN_TILES_SHORT_SIDE));
  return Math.max(MIN_ZOOM, Math.min(nearest, maxZoom));
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
