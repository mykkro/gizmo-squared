import { BIOMES } from '../data/biomes';

/** A new biome must persist this long before it counts (prevents border flicker). */
export const BIOME_STABLE_SECONDS = 0.4;

export interface DiscoveryState {
  currentBiome: number | null;
  candidate: number | null;
  candidateTime: number;
  discovered: Set<string>;
}

export interface BiomeChange {
  biome: number;
  isNew: boolean;
}

export function createDiscoveryState(discovered: Iterable<string> = []): DiscoveryState {
  return { currentBiome: null, candidate: null, candidateTime: 0, discovered: new Set(discovered) };
}

export function updateDiscovery(s: DiscoveryState, biome: number, dt: number): BiomeChange | null {
  if (biome === s.currentBiome) {
    s.candidate = null;
    s.candidateTime = 0;
    return null;
  }
  if (s.currentBiome !== null) {
    if (s.candidate !== biome) {
      s.candidate = biome;
      s.candidateTime = 0;
      return null;
    }
    s.candidateTime += dt;
    if (s.candidateTime < BIOME_STABLE_SECONDS) return null;
  }
  s.currentBiome = biome;
  s.candidate = null;
  s.candidateTime = 0;
  const name = BIOMES[biome].name;
  const isNew = !s.discovered.has(name);
  s.discovered.add(name);
  return { biome, isNew };
}
