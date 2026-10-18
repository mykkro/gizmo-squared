import { MAX_ENERGY } from '../config';
import type { BiomeEffect } from '../data/biomes';
import type { Player } from '../entities/Player';

export const ENERGY_DRAIN_PER_SEC = 1 / 6;
export const ENERGY_REGEN_PER_SEC = 1 / 3;

export function changeEnergy(player: Player, amount: number): void {
  player.energy = Math.min(MAX_ENERGY, Math.max(0, player.energy + amount));
}

export function tickEnergy(player: Player, dt: number, biomeEffect?: BiomeEffect): void {
  let delta = 0;
  if (player.moving) delta -= ENERGY_DRAIN_PER_SEC * (biomeEffect === 'decay' ? 2 : 1) * dt;
  if (biomeEffect === 'heal') delta += ENERGY_REGEN_PER_SEC * dt;
  changeEnergy(player, delta);
}

export function isTired(player: Player): boolean {
  return player.energy <= 0;
}
