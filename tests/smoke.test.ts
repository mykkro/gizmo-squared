import { describe, expect, it } from 'vitest';
import { CHUNK_PX, CHUNK_SIZE, TILE_PX } from '../src/config';

describe('config', () => {
  it('derives chunk pixel size from tile and chunk size', () => {
    expect(TILE_PX).toBe(16);
    expect(CHUNK_SIZE).toBe(32);
    expect(CHUNK_PX).toBe(512);
  });
});
