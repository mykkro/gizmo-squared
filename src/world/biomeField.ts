import { makeFractalNoise, type Noise2D } from '../core/noise';
import { BIOME_INDEX, type BiomeName } from '../data/biomes';
import { GEN_CONFIG } from './genConfig';

export interface Climate {
  elevation: number;
  temperature: number;
  moisture: number;
  landmark: number;
}

type Band = 'cold' | 'temperate' | 'hot';

const TABLE: Record<Band, readonly BiomeName[]> = {
  cold: ['Tundra', 'Snowfield', 'Frozen Lake', 'Frozen Lake'],
  temperate: ['Grassland', 'Forest', 'Marsh', 'Swamp'],
  hot: ['Desert', 'Savanna', 'Jungle', 'Swamp Forest'],
};

export function classifyBiomeName(c: Climate): BiomeName {
  const g = GEN_CONFIG;
  const band: Band =
    c.temperature < g.temp.cold ? 'cold' : c.temperature < g.temp.hot ? 'temperate' : 'hot';
  const moist =
    c.moisture < g.moist.dry
      ? 0
      : c.moisture < g.moist.medium
        ? 1
        : c.moisture < g.moist.wet
          ? 2
          : 3;

  if (c.elevation < g.elev.low) return band === 'cold' ? 'Iceberg' : 'Beach';
  if (c.elevation > g.elev.high) {
    if (band !== 'hot') return 'Mountains';
    if (c.elevation > g.elev.volcano) return 'Volcano';
    if (c.elevation > g.elev.foothills) return 'Volcanic Plains';
    return moist === 0 ? 'Badlands' : 'Canyon';
  }
  if (band === 'temperate' && c.landmark > g.ruins) return 'Ruins';
  return TABLE[band][moist];
}

export function classifyBiome(c: Climate): number {
  return BIOME_INDEX[classifyBiomeName(c)];
}

/** Seamless climate fields sampled in world tile coordinates. */
export class BiomeField {
  private readonly warpX: Noise2D;
  private readonly warpY: Noise2D;
  private readonly elevation: Noise2D;
  private readonly temperature: Noise2D;
  private readonly moisture: Noise2D;
  private readonly landmark: Noise2D;

  constructor(seed: number) {
    const g = GEN_CONFIG;
    const contrast = g.contrast;
    this.warpX = makeFractalNoise(seed + 11, g.warp);
    this.warpY = makeFractalNoise(seed + 12, g.warp);
    this.elevation = makeFractalNoise(seed + 21, { ...g.elevation, contrast });
    this.temperature = makeFractalNoise(seed + 22, { ...g.temperature, contrast });
    this.moisture = makeFractalNoise(seed + 23, { ...g.moisture, contrast });
    this.landmark = makeFractalNoise(seed + 24, { ...g.landmark, contrast });
  }

  climateAt(tx: number, ty: number): Climate {
    const a = GEN_CONFIG.warp.amplitude;
    const x = tx + (this.warpX(tx, ty) * 2 - 1) * a;
    const y = ty + (this.warpY(tx, ty) * 2 - 1) * a;
    return {
      elevation: this.elevation(x, y),
      temperature: this.temperature(x, y),
      moisture: this.moisture(x, y),
      landmark: this.landmark(x, y),
    };
  }

  biomeAt(tx: number, ty: number): number {
    return classifyBiome(this.climateAt(tx, ty));
  }
}
