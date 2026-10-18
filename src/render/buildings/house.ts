import type { BuildingDef } from '../../data/buildings';
import { materialTexel } from '../materials';
import { T, dropShadow, fill, hex, put, rect, scale, tint } from './draw';

const DOOR = hex('#5a3a22');
const DOOR_FRAME = hex('#3a2414');
const KNOB = hex('#e0b84a');
const WINDOW_FRAME = hex('#4a3020');
const GLASS = hex('#9fd3f0');
const GLASS_LIGHT = hex('#e4f4ff');
const CHIMNEY_CAP = hex('#9a948a');
const SAIL_WOOD = hex('#4a3020');
const SAIL_CLOTH = hex('#eadfc6');

/** Front-wall band height and where the roof sits for a footprint. */
export function houseFrame(y0: number, H: number) {
  const facadeH = Math.round(T * 0.8);
  const facadeTop = y0 + H - facadeH;
  const top = y0 - 4;
  const bottom = facadeTop + 3;
  const ridge = Math.round(top + (bottom - top) * 0.45);
  return { facadeH, facadeTop, top, bottom, ridge };
}

export function paintHouse(out: Uint8ClampedArray, def: BuildingDef, ox: number, oy: number) {
  const x0 = ox * T;
  const y0 = oy * T;
  const W = def.w * T;
  const H = def.h * T;
  const roof = def.roof ?? 'clay';
  const wall = def.wall ?? 'plaster';
  const wallTint = def.wallTint ? hex(def.wallTint) : null;
  const { facadeH, facadeTop, top, bottom, ridge } = houseFrame(y0, H);

  dropShadow(out, x0, y0, W, H);

  // Front wall, darker under the eaves.
  rect(out, x0, facadeTop, W, facadeH, (x, y) => {
    const under = y - facadeTop;
    return scale(tint(materialTexel(wall, x, y), wallTint), under < 6 ? 0.55 + 0.075 * under : 1);
  });

  // Windows in every tile except the door's.
  const tiles = def.w;
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

  // Gable roof: lit upper slope, shaded lower slope, ridge cap, dark eaves and edges.
  const left = x0 - 2;
  const right = x0 + W + 2;
  const roofBase = materialTexel(roof, 0, 0);
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      if (x === left || x === right - 1 || y === top || y === bottom - 1) {
        put(out, x, y, scale(roofBase, 0.35));
        continue;
      }
      let f =
        y < ridge
          ? 1.12 + 0.06 * ((y - top) / (ridge - top))
          : 0.78 - 0.14 * ((y - ridge) / (bottom - ridge));
      if (y >= ridge - 2 && y <= ridge + 1) f = y <= ridge - 1 ? 1.32 : 0.6;
      if (x < left + 3 || x > right - 4) f *= 0.72;
      if (y > bottom - 4) f *= 0.6;
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
      if (ly < 2) return CHIMNEY_CAP;
      if (ly < 5 && lx > 1 && lx < cw - 2) return [28, 20, 16];
      const f = lx >= cw - 3 ? 0.55 : lx < 2 ? 0.95 : 0.78;
      const [r, g, b] = materialTexel('brick', x, y);
      return scale([r * 0.9 + 18, g * 0.6, b * 0.55], f);
    });
  }

  if (def.sails) paintSails(out, x0 + W / 2, top + (bottom - top) * 0.4);
}

/** Four windmill sails in an X: a spar plus a lattice blade on one side. */
function paintSails(out: Uint8ClampedArray, hx: number, hy: number) {
  const L = T * 3;
  const blade = T * 0.45;
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    fill(
      out,
      hx - L,
      hy - L,
      hx + L,
      hy + L,
      (x, y) => {
        const t = (x - hx) * dx + (y - hy) * dy;
        const s = -(x - hx) * dy + (y - hy) * dx;
        return t > 0 && t < L && ((s > -1.5 && s < 1.5) || (t > L * 0.25 && s > 0 && s < blade));
      },
      (x, y) => {
        const t = (x - hx) * dx + (y - hy) * dy;
        const s = -(x - hx) * dy + (y - hy) * dx;
        const lattice = Math.abs(s) < 1.5 || (t | 0) % 6 === 0 || (s | 0) % 6 === 0;
        return lattice ? SAIL_WOOD : SAIL_CLOTH;
      },
    );
  }
  fill(
    out,
    hx - 5,
    hy - 5,
    hx + 5,
    hy + 5,
    (x, y) => (x - hx) ** 2 + (y - hy) ** 2 < 16,
    () => hex('#2a1a10'),
  );
}
