import { BUILDINGS } from '../data/buildings';
import type { PlacedBuilding } from '../world/chunk';
import { paintChurch } from './buildings/church';
import { paintHouse } from './buildings/house';
import { paintRuins } from './buildings/ruins';
import { paintShrine } from './buildings/shrine';
import { paintTemple } from './buildings/temple';
import { paintWell } from './buildings/well';

/** Paints a placed building into a chunk bake (CHUNK_PX-wide RGBA, local coordinates). */
export function paintBuilding(b: PlacedBuilding, out: Uint8ClampedArray): void {
  const def = BUILDINGS[b.index];
  switch (def.style) {
    case 'house':
      return paintHouse(out, def, b.ox, b.oy);
    case 'church':
      return paintChurch(out, def, b.ox, b.oy);
    case 'temple':
      return paintTemple(out, def, b.ox, b.oy);
    case 'ruins':
      return paintRuins(out, def, b.ox, b.oy, b.seed);
    case 'shrine':
      return paintShrine(out, def, b.ox, b.oy);
    case 'well':
      return paintWell(out, def, b.ox, b.oy);
  }
}
