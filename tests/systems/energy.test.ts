import { describe, expect, it } from 'vitest';
import { MAX_ENERGY } from '../../src/config';
import { Player } from '../../src/entities/Player';
import { changeEnergy, isTired, tickEnergy } from '../../src/systems/energy';

function playerWith(energy: number, moving: boolean): Player {
  const p = new Player();
  p.energy = energy;
  p.moving = moving;
  return p;
}

describe('energy', () => {
  it('drains 1 point per 6 seconds while moving', () => {
    const p = playerWith(50, true);
    tickEnergy(p, 6);
    expect(p.energy).toBeCloseTo(49);
  });

  it('does not drain while standing still', () => {
    const p = playerWith(50, false);
    tickEnergy(p, 60);
    expect(p.energy).toBe(50);
  });

  it('drains twice as fast in decay biomes', () => {
    const p = playerWith(50, true);
    tickEnergy(p, 6, 'decay');
    expect(p.energy).toBeCloseTo(48);
  });

  it('regenerates in heal biomes, even while still', () => {
    const p = playerWith(50, false);
    tickEnergy(p, 3, 'heal');
    expect(p.energy).toBeCloseTo(51);
  });

  it('clamps to [0, MAX_ENERGY] and reports tired at 0', () => {
    const p = playerWith(1, true);
    tickEnergy(p, 600);
    expect(p.energy).toBe(0);
    expect(isTired(p)).toBe(true);
    changeEnergy(p, 1000);
    expect(p.energy).toBe(MAX_ENERGY);
    expect(isTired(p)).toBe(false);
  });
});
