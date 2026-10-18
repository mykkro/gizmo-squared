import { CAMERA_STIFFNESS, MIN_ZOOM, TARGET_TILES_SHORT_SIDE, TILE_PX } from '../config';

/** Largest integer zoom that still shows TARGET_TILES_SHORT_SIDE tiles (min MIN_ZOOM). */
export function computeZoom(deviceShortSide: number): number {
  return Math.max(MIN_ZOOM, Math.floor(deviceShortSide / (TILE_PX * TARGET_TILES_SHORT_SIDE)));
}

export class Camera {
  x = 0;
  y = 0;

  snap(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /** Frame-rate independent exponential follow. */
  follow(x: number, y: number, dt: number): void {
    const k = 1 - Math.exp(-CAMERA_STIFFNESS * dt);
    this.x += (x - this.x) * k;
    this.y += (y - this.y) * k;
  }
}
