import { describe, expect, it } from 'vitest';
import type { ActiveEffect } from '../../src/entities/Player';
import {
  addEffect,
  effectSpeedMultiplier,
  hasEffect,
  tickEffects,
} from '../../src/systems/effects';

describe('effects', () => {
  it('refreshes an active effect instead of stacking it', () => {
    const fx: ActiveEffect[] = [];
    addEffect(fx, 'zoom', 10);
    tickEffects(fx, 6);
    addEffect(fx, 'zoom', 10);
    expect(fx).toEqual([{ kind: 'zoom', remaining: 10 }]);
  });

  it('expires effects and restores speed (old sticky-never-expires bug)', () => {
    const fx: ActiveEffect[] = [];
    addEffect(fx, 'sap', 6);
    expect(effectSpeedMultiplier(fx)).toBeCloseTo(0.6);
    tickEffects(fx, 6);
    expect(hasEffect(fx, 'sap')).toBe(false);
    expect(effectSpeedMultiplier(fx)).toBe(1);
  });

  it('multiplies speed of concurrent effects', () => {
    const fx: ActiveEffect[] = [];
    addEffect(fx, 'zoom', 10);
    addEffect(fx, 'sap', 6);
    expect(effectSpeedMultiplier(fx)).toBeCloseTo(1.8 * 0.6);
  });
});
