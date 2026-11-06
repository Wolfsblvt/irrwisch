/**
 * Small deterministic helpers shared by the Worker and the client.
 * The world uses them so that both sides derive the same clearing shape,
 * the same roof variants and the same ambient oddities from the same seeds.
 */

/** 32-bit integer hash of a string (FNV-1a). */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mix two integers into one well-distributed 32-bit value. */
export function hashInts(a: number, b: number, c = 0): number {
  let hash = (a | 0) * 0x9e3779b1 ^ (b | 0) * 0x85ebca77 ^ (c | 0) * 0xc2b2ae3d;
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
  hash = Math.imul(hash ^ (hash >>> 12), 0x297a2d39);
  return (hash ^ (hash >>> 15)) >>> 0;
}

/** Unit-interval float from any integer hash. */
export function unit(hash: number): number {
  return (hash >>> 0) / 4294967296;
}

/** Mulberry32: a tiny seeded generator good enough for scenery and hands. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one item from a list with a unit random value. */
export function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}
