import type { EffectKind } from '../data/items';
import type { ActiveEffect } from '../entities/Player';

export const EFFECT_SPEED: Record<EffectKind, number> = {
  zoom: 1.8,
  sap: 0.6,
  magnet: 1,
  wobble: 1,
};

/** Adds an effect, or refreshes its timer if already active (never stacks). */
export function addEffect(effects: ActiveEffect[], kind: EffectKind, duration: number): void {
  const existing = effects.find((e) => e.kind === kind);
  if (existing) existing.remaining = Math.max(existing.remaining, duration);
  else effects.push({ kind, remaining: duration });
}

export function tickEffects(effects: ActiveEffect[], dt: number): void {
  for (const e of effects) e.remaining -= dt;
  for (let i = effects.length - 1; i >= 0; i--) {
    if (effects[i].remaining <= 0) effects.splice(i, 1);
  }
}

export function hasEffect(effects: readonly ActiveEffect[], kind: EffectKind): boolean {
  return effects.some((e) => e.kind === kind);
}

export function effectSpeedMultiplier(effects: readonly ActiveEffect[]): number {
  return effects.reduce((m, e) => m * EFFECT_SPEED[e.kind], 1);
}
