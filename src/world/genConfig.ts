/** Generation tuning. Change values here only; tune with the debug overlay (?debug). */
export const GEN_CONFIG = {
  warp: { scale: 120, octaves: 2, amplitude: 20 },
  elevation: { scale: 150, octaves: 4 },
  temperature: { scale: 300, octaves: 3 },
  moisture: { scale: 200, octaves: 3 },
  landmark: { scale: 60, octaves: 2 },
  /** Stretches climate noise so extreme bands (peaks, lowlands) actually occur. */
  contrast: 2.0,
  temp: { cold: 0.35, hot: 0.65 },
  moist: { dry: 0.3, medium: 0.5, wet: 0.7 },
  elev: { low: 0.2, high: 0.75, foothills: 0.82, volcano: 0.88 },
  ruins: 0.85,
  /** Multiplies biome.itemChance to get the per-tile item probability. */
  itemDensity: 0.06,
  obstacle: { chance: 0.04, minSpacing: 2 },
  /** Per chunk; chunks are 16x16 tiles, so this keeps roughly the earlier density per area. */
  building: { attempts: 1, chance: 0.18 },
  terrainDetail: { minScale: 4, maxScale: 12, octaves: 2 },
} as const;
