import { MAGNET_RADIUS_TILES, MAX_ENERGY, TILE_PX } from '../config';
import { NO_ITEM, itemById, type ItemDef } from '../data/items';
import { HITBOX_H, HITBOX_HALF_W, type Player } from '../entities/Player';
import { addEffect, hasEffect } from './effects';
import { changeEnergy } from './energy';

export interface PickupEvent {
  itemId: number;
  tx: number;
  ty: number;
  /** True when pulled in by the magnet (the renderer animates these flying in). */
  magnet: boolean;
}

export interface PickupWorld {
  itemAt(tx: number, ty: number): number;
  takeItem(tx: number, ty: number): number;
}

const EPS = 1e-6;

export function applyItem(p: Player, item: ItemDef): void {
  p.treasures += item.treasure;
  for (const e of item.effects) {
    switch (e.kind) {
      case 'energy':
        changeEnergy(p, e.amount);
        break;
      case 'energyFull':
        p.energy = MAX_ENERGY;
        break;
      case 'timed':
        addEffect(p.effects, e.effect, e.duration);
        break;
    }
  }
}

export function collectItems(p: Player, world: PickupWorld): PickupEvent[] {
  const events: PickupEvent[] = [];
  const take = (tx: number, ty: number, magnet: boolean) => {
    if (world.itemAt(tx, ty) === NO_ITEM) return;
    const id = world.takeItem(tx, ty);
    const def = itemById(id);
    if (!def) return;
    applyItem(p, def);
    events.push({ itemId: id, tx, ty, magnet });
  };

  const x0 = Math.floor((p.x - HITBOX_HALF_W) / TILE_PX);
  const x1 = Math.floor((p.x + HITBOX_HALF_W - EPS) / TILE_PX);
  const y0 = Math.floor((p.y - HITBOX_H) / TILE_PX);
  const y1 = Math.floor((p.y - EPS) / TILE_PX);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) take(tx, ty, false);

  if (hasEffect(p.effects, 'magnet')) {
    const r = MAGNET_RADIUS_TILES;
    const cx = p.tileX();
    const cy = p.tileY();
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) take(cx + dx, cy + dy, true);
      }
    }
  }
  return events;
}
