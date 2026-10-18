import type { ItemKey } from '../data/items';

/** A pixel sprite: each char in `rows` is a palette key, '.' is transparent. */
export interface PixelSprite {
  w: number;
  h: number;
  palette: Record<string, string>;
  rows: readonly string[];
}

export function spriteErrors(s: PixelSprite): string[] {
  const errors: string[] = [];
  if (s.rows.length !== s.h) errors.push(`expected ${s.h} rows, got ${s.rows.length}`);
  s.rows.forEach((row, i) => {
    if (row.length !== s.w) errors.push(`row ${i} has ${row.length} columns`);
    for (const ch of row) {
      if (ch !== '.' && !(ch in s.palette)) errors.push(`row ${i}: unknown '${ch}'`);
    }
  });
  return errors;
}

export function spriteToCanvas(s: PixelSprite): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = s.w;
  canvas.height = s.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  s.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = s.palette[ch];
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

const GIZMO_PALETTE = {
  k: '#1d2b2a',
  g: '#5fd16b',
  G: '#3a9c4a',
  w: '#ffffff',
  e: '#1d2b2a',
  a: '#ffd23f',
  c: '#ff8fa3',
};

const GIZMO_TOP = [
  '.......aa.......',
  '.......kk.......',
  '....kkkkkkkk....',
  '...kggggggggk...',
  '..kggggggggggk..',
];
const GIZMO_EYES_OPEN = ['..kgwwggggwwgk..', '..kgweggggewgk..'];
const GIZMO_EYES_SHUT = ['..kggggggggggk..', '..kgkkggggkkgk..'];
const GIZMO_BODY = [
  '..kggggggggggk..',
  '..kgcggkkggcgk..',
  '..kggggggggggk..',
  '...kGGGGGGGGk...',
  '....kkkkkkkk....',
];
const LEGS_TOGETHER = ['.....kG..Gk.....', '.....kk..kk.....'];
const LEGS_APART = ['....kG....Gk....', '....kk....kk....'];
const BLANK = ['................', '................'];

const gizmo = (eyes: string[], legs: string[]): PixelSprite => ({
  w: 16,
  h: 16,
  palette: GIZMO_PALETTE,
  rows: [...GIZMO_TOP, ...eyes, ...GIZMO_BODY, ...legs, ...BLANK],
});

/** Feet (last leg row) are row 13; draw with the sprite's row 14 at the player's y. */
export const GIZMO_FEET_ROW = 13;
export const GIZMO_FRAMES: readonly PixelSprite[] = [
  gizmo(GIZMO_EYES_OPEN, LEGS_TOGETHER),
  gizmo(GIZMO_EYES_OPEN, LEGS_APART),
];
export const GIZMO_TIRED: PixelSprite = gizmo(GIZMO_EYES_SHUT, LEGS_TOGETHER);

const BERRY_ROWS = [
  '...ll...',
  '...l....',
  '..rrrr..',
  '.rhrrrr.',
  '.rrrrrr.',
  '.rrrrrd.',
  '..rddd..',
  '........',
];

const berry = (r: string, d: string, h: string): PixelSprite => ({
  w: 8,
  h: 8,
  palette: { l: '#3fa34d', r, d, h },
  rows: BERRY_ROWS,
});

export const ITEM_SPRITES: Record<ItemKey, PixelSprite> = {
  berry: berry('#e5484d', '#a3242a', '#ffb3b5'),
  golden: berry('#f5b82e', '#b07a12', '#fff1b8'),
  sour: berry('#9bd13b', '#5e8a1c', '#e2f7b5'),
  zoom: {
    w: 8,
    h: 8,
    palette: { l: '#3fd0c9', d: '#1e8f8a' },
    rows: [
      '......l.',
      '.....ll.',
      '...llll.',
      '..lllld.',
      '.llldd..',
      '.lldd...',
      '.dd.....',
      'd.......',
    ],
  },
  magnet: {
    w: 8,
    h: 8,
    palette: { p: '#b46ee8', q: '#7d3fb3', y: '#ffe066' },
    rows: [
      '...pp...',
      '..pqqp..',
      '.ppyypp.',
      'pqyyyyqp',
      'pqyyyyqp',
      '.ppyypp.',
      '..pqqp..',
      '...pp...',
    ],
  },
  sap: {
    w: 8,
    h: 8,
    palette: { a: '#d98a1c', b: '#a35f08', h: '#ffd28a' },
    rows: [
      '...a....',
      '...a....',
      '..aaa...',
      '.aahaa..',
      '.ahaaa..',
      '.aaaab..',
      '..abb...',
      '........',
    ],
  },
};
