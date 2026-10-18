import type { BuildingDef } from '../../data/buildings';
import { materialTexel } from '../materials';
import { T, dropShadow, fill, hex, inArch, inCircle, put, rect, scale } from './draw';

const DOOR = hex('#3a2616');
const GLASS = hex('#5a8fd0');
const GLASS_LIGHT = hex('#b8dcff');
const LEAD = hex('#2a2a30');
const GOLD = hex('#e0b84a');

/**
 * Church: a nave whose slate roof runs front-to-back (ridge vertical, left slope lit), and a
 * square bell tower at the front with an arched door, a rose window and a pyramid roof.
 */
export function paintChurch(out: Uint8ClampedArray, def: BuildingDef, ox: number, oy: number) {
  const x0 = ox * T;
  const y0 = oy * T;
  const W = def.w * T;
  const H = def.h * T;
  const roof = def.roof ?? 'slate';
  const wall = def.wall ?? 'stone';
  const cx = x0 + W / 2;
  const bottom = y0 + H;
  const facadeTop = bottom - Math.round(T * 0.8);

  dropShadow(out, x0, y0, W, H);

  // Nave roof (ridge running north-south).
  const top = y0 - 4;
  const roofBase = materialTexel(roof, 0, 0);
  for (let y = top; y < facadeTop + 3; y++) {
    for (let x = x0 - 2; x < x0 + W + 2; x++) {
      if (x === x0 - 2 || x === x0 + W + 1 || y === top) {
        put(out, x, y, scale(roofBase, 0.35));
        continue;
      }
      let f = x < cx ? 1.14 - 0.1 * ((cx - x) / (W / 2)) : 0.74;
      if (Math.abs(x - cx) < 2) f = x < cx ? 1.3 : 0.6; // ridge cap
      if (y > facadeTop - 1) f *= 0.6; // eaves
      put(out, x, y, scale(materialTexel(roof, x - x0, y - top), f));
    }
  }

  // Nave front wall with tall arched windows on either side of the tower.
  rect(out, x0, facadeTop, W, bottom - facadeTop, (x, y) =>
    scale(materialTexel(wall, x, y), y - facadeTop < 5 ? 0.6 + 0.08 * (y - facadeTop) : 1),
  );
  for (const wx of [x0 + T * 0.5, x0 + W - T * 0.5]) {
    fill(
      out,
      wx - 5,
      facadeTop + 4,
      wx + 5,
      bottom - 4,
      (x, y) => inArch(x, y, wx, bottom - 6, 8, 18),
      (x, y) => ((x + y) % 5 === 0 ? LEAD : GLASS),
    );
  }

  // Bell tower in front of the nave.
  const tw = Math.round(T * 1.8);
  const tx = Math.round(cx - tw / 2);
  const faceTop = facadeTop - Math.round(T * 1.4);
  rect(out, tx, faceTop, tw, bottom - faceTop, (x, y) => {
    const lx = x - tx;
    const f = lx < 3 ? 1.12 : lx >= tw - 4 ? 0.7 : 0.95;
    return scale(materialTexel(wall, x, y + 7), f);
  });
  // Cornice under the tower roof.
  rect(out, tx - 2, faceTop - 3, tw + 4, 4, (x) =>
    scale(materialTexel(wall, x, faceTop), x < cx ? 1.2 : 0.8),
  );

  // Rose window.
  const ry = faceTop + Math.round(T * 0.45);
  const rr = T * 0.28;
  fill(
    out,
    cx - rr - 2,
    ry - rr - 2,
    cx + rr + 2,
    ry + rr + 2,
    (x, y) => inCircle(x, y, cx, ry, rr + 1.5),
    (x, y) => {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - ry);
      if (d > rr - 0.5) return LEAD; // frame
      const spoke = Math.abs(Math.sin(Math.atan2(y + 0.5 - ry, x + 0.5 - cx) * 4)) < 0.18;
      if (spoke || d < 2) return LEAD;
      return d < rr * 0.5 ? GLASS_LIGHT : GLASS;
    },
  );

  // Arched door.
  const dw = Math.round(T * 0.5);
  const dh = Math.round(T * 0.75);
  fill(
    out,
    cx - dw / 2 - 2,
    bottom - dh - 2,
    cx + dw / 2 + 2,
    bottom,
    (x, y) => inArch(x, y, cx, bottom, dw + 4, dh + 2),
    () => scale(materialTexel(wall, 0, 0), 0.55),
  );
  fill(
    out,
    cx - dw / 2,
    bottom - dh,
    cx + dw / 2,
    bottom,
    (x, y) => inArch(x, y, cx, bottom, dw, dh),
    (x) => scale(DOOR, (x - Math.round(cx)) % 4 === 0 ? 0.7 : 1),
  );

  // Pyramid roof on the tower: left face lit, right face shaded, front face in between.
  const pb = faceTop - 3;
  const ph = Math.round(T * 1.25);
  const half = tw / 2 + 3;
  fill(
    out,
    cx - half,
    pb - ph,
    cx + half,
    pb,
    (x, y) => Math.abs(x - cx) <= half * ((y - (pb - ph)) / ph),
    (x, y) => {
      const k = (y - (pb - ph)) / ph;
      const front = y + 0.5 > pb - ph * 0.3 && Math.abs(x + 0.5 - cx) < half * k - (pb - y) * 0.6;
      const f = front ? 0.95 : x + 0.5 < cx ? 1.2 : 0.65;
      return scale(materialTexel(roof, x, y), f);
    },
  );
  // Cross on the apex.
  rect(out, Math.round(cx) - 1, pb - ph - 10, 2, 10, () => GOLD);
  rect(out, Math.round(cx) - 4, pb - ph - 7, 8, 2, () => GOLD);
}
