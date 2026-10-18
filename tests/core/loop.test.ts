import { describe, expect, it } from 'vitest';
import { stepAccumulator } from '../../src/core/loop';

const TICK = 1 / 60;

describe('stepAccumulator', () => {
  it('runs one tick for one 60 Hz frame', () => {
    expect(stepAccumulator(0, TICK, TICK, 5).ticks).toBe(1);
  });

  it('carries leftover time between frames', () => {
    const a = stepAccumulator(0, TICK / 2, TICK, 5);
    expect(a.ticks).toBe(0);
    const b = stepAccumulator(a.accumulator, TICK / 2, TICK, 5);
    expect(b.ticks).toBe(1);
  });

  it('clamps huge frames and drops the backlog beyond maxTicks', () => {
    const r = stepAccumulator(0, 10, TICK, 5);
    expect(r.ticks).toBe(5);
    expect(r.accumulator).toBe(0);
  });

  it('ignores negative frame times', () => {
    const r = stepAccumulator(0, -1, TICK, 5);
    expect(r.ticks).toBe(0);
    expect(r.accumulator).toBe(0);
  });
});
