import { CHUNK_PX, TILE_PX } from '../config';
import { BLUEPRINT_CHARS, BUILDINGS, type BuildingDef } from '../data/buildings';
import type { PlacedBuilding } from '../world/chunk';
import { parseHex, type RGB } from './color';
import { materialTexel } from './materials';

const T = TILE_PX;

const DOOR = parseHex('#5a3a22');
const DOOR_FRAME = parseHex('#3a2414');
const KNOB = parseHex('#e0b84a');
const WINDOW_FRAME = parseHex('#4a3020');
const GLASS = parseHex('#9fd3f0');
const GLASS_LIGHT = parseHex('#e4f4ff');
const CHIMNEY_CAP = parseHex('#9a948a');

/** Writes a colour into a CHUNK_PX-wide RGBA buffer (ignores pixels outside it). */
function put(out: Uint8ClampedArray, x: number, y: number, c: RGB, a = 1): void {
  if (x < 0 || y < 0 || x >= CHUNK_PX || y >= CHUNK_PX) return;
  const o = (y * CHUNK_PX + x) * 4;
  out[o] = c[0] * a + out[o] * (1 - a);
  out[o + 1] = c[1] * a + out[o + 1] * (1 - a);
  out[o + 2] = c[2] * a + out[o + 2] * (1 - a);
}

const scale = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];
const tint = (c: RGB, t: RGB | null): RGB =>
  t ? [(c[0] * t[0]) / 200, (c[1] * t[1]) / 200, (c[2] * t[2]) / 200] : c;

function rect(
  out: Uint8ClampedArray,
  x0: number,
  y0: number,
  w: number,
  h: number,
  color: (x: number, y: number) => RGB,
): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(out, x, y, color(x, y));
}

/** Soft drop shadow to the bottom-right of a footprint. */
function dropShadow(out: Uint8ClampedArray, x0: number, y0: number, W: number, H: number) {
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

function paintHouse(out: Uint8ClampedArray, def: BuildingDef, ox: number, oy: number): void {
  const x0 = ox * T;
  const y0 = oy * T;
  const W = def.blueprint[0].length * T;
  const H = def.blueprint.length * T;
  const roof = def.roof ?? 'clay';
  const wall = def.wall ?? 'plaster';
  const wallTint = def.wallTint ? parseHex(def.wallTint) : null;

  dropShadow(out, x0, y0, W, H);

  // Front wall: a band along the bottom of the footprint, darker under the eaves.
  const facadeH = Math.round(T * 0.8);
  const facadeTop = y0 + H - facadeH;
  rect(out, x0, facadeTop, W, facadeH, (x, y) => {
    const under = y - facadeTop;
    const f = under < 6 ? 0.55 + 0.075 * under : 1;
    return scale(tint(materialTexel(wall, x, y), wallTint), f);
  });

  // Windows in every tile except the door's.
  const tiles = W / T;
  const doorTile = Math.floor(tiles / 2);
  const ww = Math.round(T * 0.42);
  const wh = Math.round(T * 0.34);
  const wy = facadeTop + Math.round(facadeH * 0.28);
  for (let i = 0; i < tiles; i++) {
    if (i === doorTile) continue;
    const wx = x0 + i * T + Math.round((T - ww) / 2);
    rect(out, wx, wy, ww, wh, (x, y) => {
      const lx = x - wx;
      const ly = y - wy;
      if (lx < 2 || ly < 2 || lx >= ww - 2 || ly >= wh - 2) return WINDOW_FRAME;
      if (lx === Math.floor(ww / 2) || ly === Math.floor(wh / 2)) return WINDOW_FRAME;
      return lx + ly < 7 ? GLASS_LIGHT : GLASS;
    });
  }

  // Door: wooden planks in a frame, with a knob.
  const dw = Math.round(T * 0.45);
  const dh = Math.round(T * 0.62);
  const dx = x0 + Math.round(W / 2 - dw / 2);
  const dy = y0 + H - dh;
  rect(out, dx, dy, dw, dh, (x, y) => {
    const lx = x - dx;
    const ly = y - dy;
    if (lx < 2 || ly < 2 || lx >= dw - 2) return DOOR_FRAME;
    if (lx === dw - 5 && ly === Math.floor(dh / 2)) return KNOB;
    return scale(DOOR, lx % 4 === 0 ? 0.75 : 1);
  });

  // Roof: a gable above the front wall, with overhanging eaves.
  const top = y0 - 4;
  const bottom = facadeTop + 3;
  const left = x0 - 2;
  const right = x0 + W + 2;
  const ridge = Math.round(top + (bottom - top) * 0.45);
  const roofBase = materialTexel(roof, 0, 0);
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      if (x === left || x === right - 1 || y === top || y === bottom - 1) {
        put(out, x, y, scale(roofBase, 0.35));
        continue;
      }
      // Upper slope faces the light, lower slope is in shade and darkens towards the eaves.
      let f =
        y < ridge
          ? 1.12 + 0.06 * ((y - top) / (ridge - top))
          : 0.78 - 0.14 * ((y - ridge) / (bottom - ridge));
      if (y >= ridge - 2 && y <= ridge + 1) f = y <= ridge - 1 ? 1.32 : 0.6; // ridge cap
      if (x < left + 3 || x > right - 4) f *= 0.72; // side edges
      if (y > bottom - 4) f *= 0.6; // eaves
      put(out, x, y, scale(materialTexel(roof, x - left, y - top), f));
    }
  }

  if (def.chimney) {
    const cw = Math.round(T * 0.42);
    const ch = Math.round(T * 0.75);
    const cx = x0 + Math.round(W * 0.66);
    const cy = ridge - ch + 6;
    rect(out, cx, cy, cw, ch, (x, y) => {
      const lx = x - cx;
      const ly = y - cy;
      if (ly < 2) return CHIMNEY_CAP; // stone cap
      if (ly < 5 && lx > 1 && lx < cw - 2) return [28, 20, 16]; // dark opening
      const f = lx >= cw - 3 ? 0.55 : lx < 2 ? 0.95 : 0.78; // lit left, shaded right
      const [r, g, bl] = materialTexel('brick', x, y);
      return scale([r * 0.9 + 18, g * 0.6, bl * 0.55], f); // mortar toned down at this size
    });
  }
}

function paintOpen(out: Uint8ClampedArray, def: BuildingDef, ox: number, oy: number): void {
  for (let by = 0; by < def.blueprint.length; by++) {
    for (let bx = 0; bx < def.blueprint[by].length; bx++) {
      if (BLUEPRINT_CHARS[def.blueprint[by][bx]] !== null) continue; // only '.' floor tiles
      const x0 = (ox + bx) * T;
      const y0 = (oy + by) * T;
      rect(out, x0, y0, T, T, (x, y) => materialTexel('paving', x, y));
    }
  }
}

/** Paints a placed building into a chunk bake (CHUNK_PX-wide RGBA, local coordinates). */
export function paintBuilding(b: PlacedBuilding, out: Uint8ClampedArray): void {
  const def = BUILDINGS[b.index];
  if (def.kind === 'house') paintHouse(out, def, b.ox, b.oy);
  else paintOpen(out, def, b.ox, b.oy);
}
