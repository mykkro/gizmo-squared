import { describe, expect, it } from 'vitest';
import { ITEM_ID, NO_ITEM } from '../../src/data/items';
import { Player } from '../../src/entities/Player';
import { addEffect, hasEffect } from '../../src/systems/effects';
import { collectItems, type PickupWorld } from '../../src/systems/pickups';

class FakeWorld implements PickupWorld {
  items = new Map<string, number>();
  put(tx: number, ty: number, id: number): this {
    this.items.set(`${tx},${ty}`, id);
    return this;
  }
  itemAt(tx: number, ty: number): number {
    return this.items.get(`${tx},${ty}`) ?? NO_ITEM;
  }
  takeItem(tx: number, ty: number): number {
    const id = this.itemAt(tx, ty);
    this.items.delete(`${tx},${ty}`);
    return id;
  }
}

function playerAt(tx: number, ty: number, energy = 50): Player {
  const p = new Player();
  p.placeAtTile(tx, ty);
  p.energy = energy;
  return p;
}

describe('collectItems', () => {
  it('collects the item under Gizmo and applies a berry', () => {
    const w = new FakeWorld().put(2, 2, ITEM_ID.berry);
    const p = playerAt(2, 2);
    const events = collectItems(p, w);
    expect(events).toEqual([{ itemId: ITEM_ID.berry, tx: 2, ty: 2, magnet: false }]);
    expect(p.energy).toBe(65);
    expect(p.treasures).toBe(1);
    expect(w.itemAt(2, 2)).toBe(NO_ITEM);
  });

  it('ignores items that are not under the hitbox', () => {
    const w = new FakeWorld().put(4, 2, ITEM_ID.berry);
    expect(collectItems(playerAt(2, 2), w)).toEqual([]);
  });

  it('golden fruit fills energy; zoom leaf adds an effect', () => {
    const p = playerAt(2, 2, 10);
    collectItems(p, new FakeWorld().put(2, 2, ITEM_ID.golden));
    expect(p.energy).toBe(100);
    collectItems(p, new FakeWorld().put(2, 2, ITEM_ID.zoom));
    expect(hasEffect(p.effects, 'zoom')).toBe(true);
    expect(p.treasures).toBe(5 + 2);
  });

  it('sour berry costs energy and wobbles, never below zero', () => {
    const p = playerAt(2, 2, 5);
    collectItems(p, new FakeWorld().put(2, 2, ITEM_ID.sour));
    expect(p.energy).toBe(0);
    expect(hasEffect(p.effects, 'wobble')).toBe(true);
  });

  it('magnet collects items within 4 tiles and flags them', () => {
    const w = new FakeWorld().put(5, 2, ITEM_ID.berry).put(7, 2, ITEM_ID.berry);
    const p = playerAt(2, 2);
    addEffect(p.effects, 'magnet', 15);
    const events = collectItems(p, w);
    expect(events).toEqual([{ itemId: ITEM_ID.berry, tx: 5, ty: 2, magnet: true }]);
    expect(w.itemAt(7, 2)).toBe(ITEM_ID.berry);
  });
});
