import { CHUNK_PX, TILE_PX } from '../../config';
import { parseHex, type RGB } from '../color';

/** Shared helpers for painting buildings into a CHUNK_PX-wide RGBA chunk buffer. */

export const T = TILE_PX;
export const hex = parseHex;

/** Blends a colour into the buffer (pixels outside it are ignored). */
export function put(out: Uint8ClampedArray, x: number, y: number, c: RGB, a = 1): void {
  if (x < 0 || y < 0 || x >= CHUNK_PX || y >= CHUNK_PX) return;
  const o = (y * CHUNK_PX + x) * 4;
  out[o] = c[0] * a + out[o] * (1 - a);
  out[o + 1] = c[1] * a + out[o + 1] * (1 - a);
  out[o + 2] = c[2] * a + out[o + 2] * (1 - a);
}

export const scale = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];
export const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
/** Multiplies a colour by a tint (200 = neutral). */
export const tint = (c: RGB, t: RGB | null): RGB =>
  t ? [(c[0] * t[0]) / 200, (c[1] * t[1]) / 200, (c[2] * t[2]) / 200] : c;

/** Fills an axis-aligned rectangle of whole pixels. */
export function rect(
  out: Uint8ClampedArray,
  x0: number,
  y0: number,
  w: number,
  h: number,
  color: (x: number, y: number) => RGB,
): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(out, x, y, color(x, y));
}

const SUBS = [0.25, 0.75];

/**
 * Fills an arbitrary shape with 2x2 supersampled coverage (anti-aliased edges).
 * `inside` receives continuous coordinates; `color` the pixel's integer coordinates.
 */
export function fill(
  out: Uint8ClampedArray,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  inside: (x: number, y: number) => boolean,
  color: (x: number, y: number) => RGB,
  alpha = 1,
): void {
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
      let n = 0;
      for (const sy of SUBS) for (const sx of SUBS) if (inside(x + sx, y + sy)) n++;
      if (n) put(out, x, y, color(x, y), (n / 4) * alpha);
    }
  }
}

/** Soft drop shadow to the bottom-right of a footprint. */
export function dropShadow(out: Uint8ClampedArray, x0: number, y0: number, W: number, H: number) {
  const sx = Math.round(T * 0.3);
  const sy = Math.round(T * 0.22);
  for (let y = y0 + sy; y < y0 + H + sy; y++) {
    for (let x = x0 + sx; x < x0 + W + sx; x++) {
      if (x < x0 + W && y < y0 + H) continue; // under the building itself
      const edge = Math.min(x0 + W + sx - x, y0 + H + sy - y, 6) / 6;
      put(out, x, y, [0, 0, 0], 0.32 * edge);
    }
  }
}

/** An arched opening (rectangle with a semicircular top). */
export const inArch = (x: number, y: number, cx: number, bottom: number, w: number, h: number) => {
  const r = w / 2;
  const top = bottom - h;
  if (x < cx - r || x > cx + r || y > bottom) return false;
  if (y >= top + r) return true;
  return (x - cx) ** 2 + (y - (top + r)) ** 2 <= r * r;
};

export const inCircle = (x: number, y: number, cx: number, cy: number, r: number) =>
  (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
