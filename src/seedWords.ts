const ADJECTIVES = [
  'maple',
  'mossy',
  'sunny',
  'misty',
  'amber',
  'cozy',
  'breezy',
  'dusky',
  'frosty',
  'golden',
  'hazel',
  'lucky',
  'mellow',
  'pebble',
  'quiet',
  'rusty',
  'sandy',
  'tiny',
  'velvet',
  'windy',
];
const NOUNS = [
  'meadow',
  'brook',
  'hollow',
  'grove',
  'dune',
  'fjord',
  'glade',
  'heath',
  'isle',
  'knoll',
  'marsh',
  'orchard',
  'ridge',
  'thicket',
  'vale',
];

function pick<T>(arr: readonly T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

/** A memorable seed such as "mossy-glade-42". Uses Math.random by default (not generation). */
export function randomSeedText(rand: () => number = Math.random): string {
  return `${pick(ADJECTIVES, rand)}-${pick(NOUNS, rand)}-${Math.floor(rand() * 100)}`;
}
