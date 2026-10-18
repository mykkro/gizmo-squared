import { describe, expect, it } from 'vitest';
import { Input } from '../../src/input/Input';
import { Keyboard, keysToVector } from '../../src/input/keyboard';
import { joystickVector } from '../../src/input/touchJoystick';

describe('keysToVector', () => {
  it('maps WASD and arrows, normalising diagonals', () => {
    expect(keysToVector(new Set(['KeyD']))).toEqual({ x: 1, y: 0 });
    expect(keysToVector(new Set(['ArrowUp']))).toEqual({ x: 0, y: -1 });
    const diag = keysToVector(new Set(['KeyW', 'KeyA']));
    expect(Math.hypot(diag.x, diag.y)).toBeCloseTo(1);
    expect(diag.x).toBeLessThan(0);
    expect(diag.y).toBeLessThan(0);
  });

  it('cancels opposite keys', () => {
    expect(keysToVector(new Set(['KeyA', 'KeyD']))).toEqual({ x: 0, y: 0 });
  });
});

describe('Keyboard', () => {
  it('clear() releases held keys (window blur)', () => {
    const kb = new Keyboard();
    kb.press('KeyW');
    kb.clear();
    expect(keysToVector(kb.keys)).toEqual({ x: 0, y: 0 });
  });
});

describe('joystickVector', () => {
  it('returns zero inside the dead zone', () => {
    expect(joystickVector(3, 0, 50, 0.1)).toEqual({ x: 0, y: 0 });
  });

  it('scales with distance and clamps to length 1', () => {
    expect(joystickVector(25, 0, 50, 0.1).x).toBeCloseTo(0.5);
    const far = joystickVector(300, 400, 50, 0.1);
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(1);
    expect(far.x).toBeCloseTo(0.6);
  });
});

describe('Input', () => {
  it('prefers an active joystick over the keyboard', () => {
    const kb = new Keyboard();
    kb.press('KeyD');
    const joy = { vector: { x: 0, y: 0 } };
    const input = new Input(kb, joy);
    expect(input.direction()).toEqual({ x: 1, y: 0 });
    joy.vector = { x: 0, y: 1 };
    expect(input.direction()).toEqual({ x: 0, y: 1 });
  });
});
