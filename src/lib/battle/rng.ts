export interface RNG {
  next(): number;
  int(maxExclusive: number): number;
  chance(percent: number): boolean;
  pick<T>(items: readonly T[]): T;
}

/** mulberry32 — small, fast, seedable PRNG. Deterministic per seed. */
export function createRng(seed: number): RNG {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (maxExclusive) => Math.floor(next() * maxExclusive),
    chance: (percent) => next() * 100 < percent,
    pick: (items) => items[Math.floor(next() * items.length)]!,
  };
}
