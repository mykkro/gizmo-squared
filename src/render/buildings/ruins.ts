import { hash2 } from '../../core/rng';
import type { BuildingDef } from '../../data/buildings';
import { ruinsWallMask } from '../../world/structures';
import { materialTexel } from '../materials';
import { T, fill, mix, put, scale } from './draw';

/**
 * Ruins: broken stone walls drawn as low blocks (crumbled, mossy top face plus a darker
 * front face where open floor lies in front), with rubble and a fallen column on the floor.
 * Uses the same wall mask as the generator, so drawing and collision agree.
 */
export function paintRuins(
  out: Uint8ClampedArray,
  def: BuildingDef,
  ox: number,
  oy: number,
  seed: number,
) {
  const walls = ruinsWallMask(seed, def.w, def.h);
  const isWall = (tx: number, ty: number) =>
    tx >= 0 && ty >= 0 && tx < def.w && ty < def.h && walls[ty * def.w + tx] === 1;
  const lift = Math.round(T * 0.3); // wall height shown in the slightly angled view

  // Rubble and a fallen column on the floor (drawn first, walls go on top).
  for (let ty = 0; ty < def.h; ty++) {
    for (let tx = 0; tx < def.w; tx++) {
      if (isWall(tx, ty)) continue;
      const nearWall =
        isWall(tx - 1, ty) || isWall(tx + 1, ty) || isWall(tx, ty - 1) || isWall(tx, ty + 1);
      const stones = nearWall ? 3 : hash2(seed, tx, ty, 30) < 0.3 ? 1 : 0;
      for (let k = 0; k < stones; k++) {
        const sx = (ox + tx) * T + 4 + hash2(seed, tx * 7 + k, ty, 31) * (T - 8);
        const sy = (oy + ty) * T + 4 + hash2(seed, tx, ty * 7 + k, 32) * (T - 8);
        const r = 1.5 + hash2(seed, tx + k, ty + k, 33) * 2.5;
        fill(
          out,
          sx - r,
          sy - r,
          sx + r,
          sy + r,
          (x, y) => (x - sx) ** 2 + (y - sy) ** 2 <= r * r,
          (x, y) => scale(materialTexel('stone', x, y), y < sy ? 1.15 : 0.75),
        );
      }
    }
  }
  const colTy = 1 + ((hash2(seed, 0, 0, 34) * (def.h - 3)) | 0);
  const colTx = 1 + ((hash2(seed, 0, 0, 35) * (def.w - 4)) | 0);
  if (!isWall(colTx, colTy) && !isWall(colTx + 1, colTy)) {
    const cx0 = (ox + colTx) * T + 6;
    const cx1 = (ox + colTx + 2) * T - 6;
    const cy = (oy + colTy) * T + T / 2;
    const r = T * 0.2;
    fill(
      out,
      cx0,
      cy - r,
      cx1,
      cy + r + 3,
      (x, y) => x >= cx0 && x <= cx1 && Math.abs(y - cy - 3) <= r * 0.6,
      () => [0, 0, 0],
      0.3,
    );
    fill(
      out,
      cx0,
      cy - r,
      cx1,
      cy + r,
      (x, y) => x >= cx0 && x <= cx1 && Math.abs(y - cy) <= r,
      (x, y) => {
        const f = 1.15 - 0.45 * ((y + 0.5 - (cy - r)) / (2 * r));
        return scale(materialTexel('marble', x, y), (x - cx0) % 5 === 0 ? f * 0.88 : f);
      },
    );
  }

  // Walls.
  for (let ty = 0; ty < def.h; ty++) {
    for (let tx = 0; tx < def.w; tx++) {
      if (!isWall(tx, ty)) continue;
      const x0 = (ox + tx) * T;
      const y0 = (oy + ty) * T;
      const frontOpen = !isWall(tx, ty + 1);
      // The top face ends where the front face starts (only visible with open floor in front).
      const faceStart = frontOpen ? y0 + T - lift : y0 + T;
      // Small shadow to the bottom-right.
      for (let y = y0 + 4; y < y0 + T + 4; y++)
        for (let x = x0 + T; x < x0 + T + 4; x++)
          if (!isWall(tx + 1, ty)) put(out, x, y, [0, 0, 0], 0.25);
      for (let x = x0; x < x0 + T; x++) {
        // Crumbled, uneven top edge (rises up into the tile above).
        const crumble = Math.floor(
          hash2(seed, (x >> 2) + tx * 31, ty, 36) * lift * (isWall(tx, ty - 1) ? 0.2 : 1),
        );
        const yTop = y0 - lift + crumble;
        for (let y = yTop; y < y0 + T; y++) {
          let c;
          if (y < faceStart) {
            c = scale(materialTexel('stone', x, y), y === yTop ? 1.25 : 1.08);
            const mossy = y < yTop + 6 && hash2(seed, x >> 1, y >> 1, 37) < 0.35;
            if (mossy) c = mix(c, materialTexel('moss', x, y), 0.75);
          } else {
            c = scale(materialTexel('stone', x, y), 0.68); // front face
          }
          put(out, x, y, c);
        }
      }
    }
  }
}
