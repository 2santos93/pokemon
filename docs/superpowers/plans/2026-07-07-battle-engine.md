# Battle Engine (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, deterministic, transport-agnostic Pokémon battle engine (3v3, with switching and the four core status conditions) as offline unit-tested modules.

**Architecture:** A set of pure functions under `src/lib/battle/`. No I/O, no React, no sockets. All randomness flows through a seeded RNG passed in by the caller, so every function is fully reproducible in tests. Later phases (team builder, room manager, Socket.IO, UI) consume this engine unchanged.

**Tech Stack:** TypeScript, Vitest (already configured — `pnpm test`). Reuses `TypeSlug` / `StatSlug` from `src/lib/domain/types.ts`.

## Global Constraints

- All Pokémon are **level 50**, **IV 31**, **EV 0**, neutral nature (verbatim from spec).
- Randomness is **only** via the injected `RNG` — never call `Math.random()` in engine code.
- Engine modules must not import from `next`, `react`, `socket.io`, or any I/O module.
- Tests: `import { describe, expect, it } from "vitest"`, colocated `*.test.ts`, relative imports (matches `src/lib/domain/*`).
- Status conditions supported: `paralysis`, `burn`, `poison`, `sleep` only. No stat stages, items, abilities, weather.
- Type chart is Gen VI+ (Fairy included).

---

### Task 1: Battle types + seeded RNG

**Files:**
- Create: `src/lib/battle/types.ts`
- Create: `src/lib/battle/rng.ts`
- Test: `src/lib/battle/rng.test.ts`

**Interfaces:**
- Consumes: `TypeSlug`, `StatSlug` from `@/lib/domain/types`.
- Produces:
  - Types: `MoveCategory`, `StatusCondition`, `Move`, `MoveSlot`, `BattlePokemon`, `PlayerSide`, `BattleState`, `TurnAction`, `BattleEvent`, `TurnResult`.
  - `RNG` interface: `next(): number` (0..1), `int(maxExclusive): number`, `chance(percent): boolean`, `pick<T>(items: readonly T[]): T`.
  - `createRng(seed: number): RNG`.

- [ ] **Step 1: Write `types.ts`** (no test; pure type declarations consumed by every later task)

```ts
import type { StatSlug, TypeSlug } from "@/lib/domain/types";

export type MoveCategory = "physical" | "special" | "status";
export type StatusCondition = "none" | "paralysis" | "burn" | "poison" | "sleep";

export interface Move {
  id: number;
  name: string;
  type: TypeSlug;
  category: MoveCategory;
  power: number; // 0 for status moves
  accuracy: number; // 0..100; 0 means "never misses"
  pp: number; // max PP
  priority: number;
  /** For status moves: the condition inflicted on the target. */
  inflicts?: Exclude<StatusCondition, "none">;
}

export interface MoveSlot {
  move: Move;
  pp: number; // current PP
}

export interface BattlePokemon {
  id: number; // species id
  name: string;
  types: TypeSlug[];
  level: number;
  stats: Record<StatSlug, number>;
  maxHp: number;
  currentHp: number;
  moves: MoveSlot[];
  status: StatusCondition;
  sleepTurns: number; // remaining forced-sleep turns
  frontSprite: string;
  backSprite: string;
}

export interface PlayerSide {
  team: BattlePokemon[];
  activeIndex: number;
}

export interface BattleState {
  sides: [PlayerSide, PlayerSide];
  turn: number;
  /** A side flagged true must choose a replacement before the next turn. */
  forcedSwitch: [boolean, boolean];
  winner: 0 | 1 | null;
}

export type SideIndex = 0 | 1;

export type TurnAction =
  | { kind: "move"; moveIndex: number } // 0..3
  | { kind: "switch"; teamIndex: number }; // 0..2

export type EffectivenessLabel = "super" | "normal" | "notvery" | "immune";

export type BattleEvent =
  | { type: "move"; side: SideIndex; pokemon: string; move: string }
  | {
      type: "damage";
      side: SideIndex; // the side taking damage
      pokemon: string;
      amount: number;
      remainingHp: number;
      effectiveness: EffectivenessLabel;
      crit: boolean;
    }
  | { type: "miss"; side: SideIndex; pokemon: string }
  | { type: "status"; side: SideIndex; pokemon: string; status: StatusCondition }
  | { type: "statusDamage"; side: SideIndex; pokemon: string; status: StatusCondition; amount: number; remainingHp: number }
  | { type: "statusPrevent"; side: SideIndex; pokemon: string; status: StatusCondition }
  | { type: "wake"; side: SideIndex; pokemon: string }
  | { type: "faint"; side: SideIndex; pokemon: string }
  | { type: "switch"; side: SideIndex; from: string; to: string }
  | { type: "forcedSwitch"; side: SideIndex }
  | { type: "win"; side: SideIndex };

export interface TurnResult {
  state: BattleState;
  events: BattleEvent[];
}
```

- [ ] **Step 2: Write the failing RNG test**

```ts
// src/lib/battle/rng.test.ts
import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

describe("createRng", () => {
  it("is deterministic for a given seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0,1)", () => {
    const r = createRng(7);
    for (let i = 0; i < 100; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int(n) stays within [0,n)", () => {
    const r = createRng(1);
    for (let i = 0; i < 100; i++) expect(r.int(6)).toBeLessThan(6);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/rng.test.ts`
Expected: FAIL — cannot find module `./rng`.

- [ ] **Step 4: Write `rng.ts`**

```ts
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
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/lib/battle/rng.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/battle/types.ts src/lib/battle/rng.ts src/lib/battle/rng.test.ts
git commit -m "feat(battle): battle domain types + seeded RNG"
```

---

### Task 2: Type effectiveness chart

**Files:**
- Create: `src/lib/battle/type-chart.ts`
- Test: `src/lib/battle/type-chart.test.ts`

**Interfaces:**
- Consumes: `TypeSlug` from `@/lib/domain/types`.
- Produces:
  - `TYPE_CHART: Record<TypeSlug, Partial<Record<TypeSlug, number>>>` (only non-1 multipliers listed).
  - `effectiveness(moveType: TypeSlug, defenderTypes: TypeSlug[]): number`.
  - `effectivenessLabel(multiplier: number): EffectivenessLabel`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/battle/type-chart.test.ts
import { describe, expect, it } from "vitest";
import { effectiveness, effectivenessLabel } from "./type-chart";

describe("effectiveness", () => {
  it("is 1 for neutral matchups", () => {
    expect(effectiveness("normal", ["normal"])).toBe(1);
  });
  it("doubles for super-effective single type", () => {
    expect(effectiveness("water", ["fire"])).toBe(2);
  });
  it("multiplies across dual types (4x)", () => {
    expect(effectiveness("rock", ["fire", "flying"])).toBe(4);
  });
  it("is 0 for immunities", () => {
    expect(effectiveness("normal", ["ghost"])).toBe(0);
    expect(effectiveness("electric", ["ground"])).toBe(0);
  });
  it("stacks resistances (0.25x)", () => {
    expect(effectiveness("grass", ["grass", "dragon"])).toBe(0.25);
  });
});

describe("effectivenessLabel", () => {
  it("labels buckets", () => {
    expect(effectivenessLabel(2)).toBe("super");
    expect(effectivenessLabel(1)).toBe("normal");
    expect(effectivenessLabel(0.5)).toBe("notvery");
    expect(effectivenessLabel(0)).toBe("immune");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/type-chart.test.ts`
Expected: FAIL — cannot find module `./type-chart`.

- [ ] **Step 3: Write `type-chart.ts`**

```ts
import type { TypeSlug } from "@/lib/domain/types";
import type { EffectivenessLabel } from "./types";

/** Attacking type → defending type → multiplier. Omitted pairs are 1x. Gen VI+. */
export const TYPE_CHART: Record<TypeSlug, Partial<Record<TypeSlug, number>>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: {
    fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5,
    bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5,
  },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: {
    normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5,
    rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5,
  },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: {
    fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2,
    ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5,
  },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

export function effectiveness(moveType: TypeSlug, defenderTypes: TypeSlug[]): number {
  return defenderTypes.reduce((mult, t) => mult * (TYPE_CHART[moveType][t] ?? 1), 1);
}

export function effectivenessLabel(multiplier: number): EffectivenessLabel {
  if (multiplier === 0) return "immune";
  if (multiplier > 1) return "super";
  if (multiplier < 1) return "notvery";
  return "normal";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/battle/type-chart.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/battle/type-chart.ts src/lib/battle/type-chart.test.ts
git commit -m "feat(battle): full 18-type effectiveness chart"
```

---

### Task 3: Stat computation at level

**Files:**
- Create: `src/lib/battle/stats.ts`
- Test: `src/lib/battle/stats.test.ts`

**Interfaces:**
- Consumes: `StatSlug` from `@/lib/domain/types`.
- Produces: `computeStats(base: Record<StatSlug, number>, level: number): Record<StatSlug, number>`.

- [ ] **Step 1: Write the failing test**

Reference value: Charizard base stats `{hp:78, attack:84, defense:78, "special-attack":109, "special-defense":85, speed:100}` at level 50, IV 31, EV 0 →
`hp = floor((2*78+31)*50/100) + 50 + 10 = floor(93.5) + 60 = 93 + 60 = 153`;
`speed = floor((2*100+31)*50/100) + 5 = floor(115.5) + 5 = 115 + 5 = 120`.

```ts
// src/lib/battle/stats.test.ts
import { describe, expect, it } from "vitest";
import { computeStats } from "./stats";

const charizardBase = {
  hp: 78, attack: 84, defense: 78,
  "special-attack": 109, "special-defense": 85, speed: 100,
} as const;

describe("computeStats", () => {
  it("computes HP with the +level+10 formula", () => {
    expect(computeStats(charizardBase, 50).hp).toBe(153);
  });
  it("computes non-HP stats with the +5 formula", () => {
    expect(computeStats(charizardBase, 50).speed).toBe(120);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/stats.test.ts`
Expected: FAIL — cannot find module `./stats`.

- [ ] **Step 3: Write `stats.ts`**

```ts
import { STAT_SLUGS, type StatSlug } from "@/lib/domain/types";

const IV = 31;
const EV = 0;

/** Standard main-series stat formula. IV 31, EV 0, neutral nature. */
export function computeStats(
  base: Record<StatSlug, number>,
  level: number,
): Record<StatSlug, number> {
  const common = (b: number) => Math.floor(((2 * b + IV + Math.floor(EV / 4)) * level) / 100);
  const result = {} as Record<StatSlug, number>;
  for (const slug of STAT_SLUGS) {
    result[slug] = slug === "hp" ? common(base[slug]) + level + 10 : common(base[slug]) + 5;
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/battle/stats.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/battle/stats.ts src/lib/battle/stats.test.ts
git commit -m "feat(battle): level-50 stat computation"
```

---

### Task 4: Damage calculation

**Files:**
- Create: `src/lib/battle/damage.ts`
- Test: `src/lib/battle/damage.test.ts`

**Interfaces:**
- Consumes: `BattlePokemon`, `Move` (`./types`); `RNG` (`./rng`); `effectiveness` (`./type-chart`).
- Produces: `computeDamage(params: { attacker: BattlePokemon; defender: BattlePokemon; move: Move; rng: RNG }): { damage: number; effectiveness: number; crit: boolean }`.

- [ ] **Step 1: Write the failing test** (uses a stub RNG to make crit/random deterministic)

```ts
// src/lib/battle/damage.test.ts
import { describe, expect, it } from "vitest";
import type { RNG } from "./rng";
import type { BattlePokemon, Move } from "./types";
import { computeDamage } from "./damage";

// RNG stub: chance() controls crit, next() controls the random factor.
function stubRng(overrides: Partial<RNG> = {}): RNG {
  return {
    next: () => 0.999, // random factor → 100/100 = 1.0
    int: (n) => n - 1, // random factor bucket → 15 → (85+15)/100 = 1.0
    chance: () => false, // no crit
    pick: (items) => items[0],
    ...overrides,
  };
}

function mon(partial: Partial<BattlePokemon>): BattlePokemon {
  return {
    id: 1, name: "Test", types: ["normal"], level: 50,
    stats: { hp: 150, attack: 100, defense: 100, "special-attack": 100, "special-defense": 100, speed: 100 },
    maxHp: 150, currentHp: 150, moves: [], status: "none", sleepTurns: 0,
    frontSprite: "", backSprite: "", ...partial,
  };
}

const tackle: Move = { id: 1, name: "Tackle", type: "normal", category: "physical", power: 40, accuracy: 100, pp: 35, priority: 0 };

describe("computeDamage", () => {
  it("applies STAB and type effectiveness", () => {
    const attacker = mon({ types: ["fire"] });
    const fireMove: Move = { ...tackle, type: "fire", power: 90 };
    const grassDefender = mon({ types: ["grass"] });
    const normalDefender = mon({ types: ["normal"] });
    const superHit = computeDamage({ attacker, defender: grassDefender, move: fireMove, rng: stubRng() });
    const neutralHit = computeDamage({ attacker, defender: normalDefender, move: fireMove, rng: stubRng() });
    // super-effective (2x) should be double the neutral hit
    expect(superHit.effectiveness).toBe(2);
    expect(superHit.damage).toBe(neutralHit.damage * 2);
  });

  it("deals 0 to immune targets", () => {
    const ghost = mon({ types: ["ghost"] });
    const hit = computeDamage({ attacker: mon({}), defender: ghost, move: tackle, rng: stubRng() });
    expect(hit.damage).toBe(0);
  });

  it("halves physical damage when the attacker is burned", () => {
    const healthy = computeDamage({ attacker: mon({}), defender: mon({}), move: tackle, rng: stubRng() });
    const burned = computeDamage({ attacker: mon({ status: "burn" }), defender: mon({}), move: tackle, rng: stubRng() });
    expect(burned.damage).toBe(Math.max(1, Math.floor(healthy.damage * 0.5)));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/damage.test.ts`
Expected: FAIL — cannot find module `./damage`.

- [ ] **Step 3: Write `damage.ts`**

```ts
import type { RNG } from "./rng";
import { effectiveness } from "./type-chart";
import type { BattlePokemon, Move } from "./types";

const CRIT_CHANCE_PERCENT = 6.25; // ~1/16
const CRIT_MULTIPLIER = 1.5;

export function computeDamage(params: {
  attacker: BattlePokemon;
  defender: BattlePokemon;
  move: Move;
  rng: RNG;
}): { damage: number; effectiveness: number; crit: boolean } {
  const { attacker, defender, move, rng } = params;
  const eff = effectiveness(move.type, defender.types);
  if (eff === 0 || move.power === 0) return { damage: 0, effectiveness: eff, crit: false };

  const isPhysical = move.category === "physical";
  const atk = isPhysical ? attacker.stats.attack : attacker.stats["special-attack"];
  const def = isPhysical ? defender.stats.defense : defender.stats["special-defense"];

  const level = attacker.level;
  const base =
    Math.floor(Math.floor((Math.floor((2 * level) / 5) + 2) * move.power * atk) / def / 50) + 2;

  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const crit = rng.chance(CRIT_CHANCE_PERCENT);
  const critMod = crit ? CRIT_MULTIPLIER : 1;
  const burn = attacker.status === "burn" && isPhysical ? 0.5 : 1;
  const randomFactor = (85 + rng.int(16)) / 100; // 0.85..1.00

  // STAB is floored on its own so type effectiveness scales an INTEGER base
  // (per-stage rounding, as the main-series games do). Without this separate
  // floor a neutral 61.5 truncates to 61 while its super-effective counterpart
  // is 123 — not exactly double. Flooring after STAB keeps the x2 / x0.5
  // effectiveness relationship exact.
  const stabbed = Math.floor(base * stab);
  const damage = Math.max(1, Math.floor(stabbed * eff * critMod * burn * randomFactor));
  return { damage, effectiveness: eff, crit };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/battle/damage.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/battle/damage.ts src/lib/battle/damage.test.ts
git commit -m "feat(battle): damage formula with STAB, type, crit, burn"
```

---

### Task 5: Action ordering

**Files:**
- Create: `src/lib/battle/order.ts`
- Test: `src/lib/battle/order.test.ts`

**Interfaces:**
- Consumes: `BattleState`, `TurnAction`, `SideIndex` (`./types`); `RNG` (`./rng`).
- Produces: `orderActions(state: BattleState, actions: [TurnAction, TurnAction], rng: RNG): SideIndex[]` — returns the side indices in the order they act. Switches always precede moves; among moves, higher `priority` first, then higher effective Speed (paralysis halves Speed), ties broken by `rng`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/battle/order.test.ts
import { describe, expect, it } from "vitest";
import { createRng } from "./rng";
import type { BattlePokemon, BattleState, Move, TurnAction } from "./types";
import { orderActions } from "./order";

function mon(speed: number, partial: Partial<BattlePokemon> = {}): BattlePokemon {
  return {
    id: 1, name: "M", types: ["normal"], level: 50,
    stats: { hp: 150, attack: 100, defense: 100, "special-attack": 100, "special-defense": 100, speed },
    maxHp: 150, currentHp: 150, moves: [], status: "none", sleepTurns: 0, frontSprite: "", backSprite: "",
    ...partial,
  };
}
function state(a: BattlePokemon, b: BattlePokemon): BattleState {
  return {
    sides: [{ team: [a], activeIndex: 0 }, { team: [b], activeIndex: 0 }],
    turn: 1, forcedSwitch: [false, false], winner: null,
  };
}
const move: TurnAction = { kind: "move", moveIndex: 0 };
const swap: TurnAction = { kind: "switch", teamIndex: 1 };

describe("orderActions", () => {
  it("faster mon moves first", () => {
    const s = state(mon(120), mon(80));
    expect(orderActions(s, [move, move], createRng(1))[0]).toBe(0);
  });
  it("switches go before moves regardless of speed", () => {
    const s = state(mon(200), mon(1));
    expect(orderActions(s, [move, swap], createRng(1))[0]).toBe(1);
  });
  it("paralysis halves effective speed", () => {
    const s = state(mon(100, { status: "paralysis" }), mon(60));
    // 100 * 0.5 = 50 < 60 → side 1 first
    expect(orderActions(s, [move, move], createRng(1))[0]).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/order.test.ts`
Expected: FAIL — cannot find module `./order`.

- [ ] **Step 3: Write `order.ts`**

```ts
import type { RNG } from "./rng";
import type { BattlePokemon, BattleState, SideIndex, TurnAction } from "./types";

function effectiveSpeed(mon: BattlePokemon): number {
  return mon.status === "paralysis" ? Math.floor(mon.stats.speed * 0.5) : mon.stats.speed;
}

function movePriority(action: TurnAction, mon: BattlePokemon): number {
  return action.kind === "switch" ? 6 : mon.moves[action.moveIndex]?.move.priority ?? 0;
}

export function orderActions(
  state: BattleState,
  actions: [TurnAction, TurnAction],
  rng: RNG,
): SideIndex[] {
  const active0 = state.sides[0].team[state.sides[0].activeIndex];
  const active1 = state.sides[1].team[state.sides[1].activeIndex];
  const p0 = movePriority(actions[0], active0);
  const p1 = movePriority(actions[1], active1);
  if (p0 !== p1) return p0 > p1 ? [0, 1] : [1, 0];

  const s0 = effectiveSpeed(active0);
  const s1 = effectiveSpeed(active1);
  if (s0 !== s1) return s0 > s1 ? [0, 1] : [1, 0];

  return rng.next() < 0.5 ? [0, 1] : [1, 0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/battle/order.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/battle/order.ts src/lib/battle/order.test.ts
git commit -m "feat(battle): turn action ordering (priority, speed, paralysis)"
```

---

### Task 6: Execute a single move (accuracy, damage, PP, status, sleep/paralysis prevention)

**Files:**
- Create: `src/lib/battle/execute-move.ts`
- Test: `src/lib/battle/execute-move.test.ts`

**Interfaces:**
- Consumes: `BattleState`, `SideIndex`, `BattleEvent` (`./types`); `RNG` (`./rng`); `computeDamage` (`./damage`); `effectivenessLabel` (`./type-chart`).
- Produces: `executeMove(state: BattleState, side: SideIndex, moveIndex: number, rng: RNG): BattleEvent[]` — **mutates** `state` in place (callers pass a working clone). Handles: sleep countdown/wake, sleep & paralysis "can't move", accuracy miss, PP decrement, damage application (sets `currentHp`, emits `damage`, emits `faint` and flips the target's `forcedSwitch` if it has healthy team members left, else sets `winner`), and status infliction for status moves.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/battle/execute-move.test.ts
import { describe, expect, it } from "vitest";
import type { RNG } from "./rng";
import type { BattlePokemon, BattleState, Move, MoveSlot } from "./types";
import { executeMove } from "./execute-move";

function slot(move: Move, pp = move.pp): MoveSlot {
  return { move, pp };
}
function mon(partial: Partial<BattlePokemon> = {}): BattlePokemon {
  return {
    id: 1, name: "M", types: ["normal"], level: 50,
    stats: { hp: 150, attack: 120, defense: 60, "special-attack": 100, "special-defense": 60, speed: 100 },
    maxHp: 150, currentHp: 150, moves: [], status: "none", sleepTurns: 0, frontSprite: "", backSprite: "",
    ...partial,
  };
}
function state(a: BattlePokemon, b: BattlePokemon, teamB: BattlePokemon[] = [b]): BattleState {
  return {
    sides: [{ team: [a], activeIndex: 0 }, { team: teamB, activeIndex: 0 }],
    turn: 1, forcedSwitch: [false, false], winner: null,
  };
}
const hit: RNG = { next: () => 0.99, int: (n) => n - 1, chance: () => false, pick: (i) => i[0] };
const tackle: Move = { id: 1, name: "Tackle", type: "normal", category: "physical", power: 40, accuracy: 100, pp: 35, priority: 0 };
const thunderWave: Move = { id: 2, name: "Thunder Wave", type: "electric", category: "status", power: 0, accuracy: 100, pp: 20, priority: 0, inflicts: "paralysis" };

describe("executeMove", () => {
  it("deals damage and decrements PP", () => {
    const attacker = mon({ moves: [slot(tackle)] });
    const s = state(attacker, mon());
    const events = executeMove(s, 0, 0, hit);
    expect(s.sides[1].team[0].currentHp).toBeLessThan(150);
    expect(s.sides[0].team[0].moves[0].pp).toBe(34);
    expect(events.some((e) => e.type === "damage")).toBe(true);
  });

  it("faints the target and flags forced switch when the bench is alive", () => {
    const attacker = mon({ moves: [slot(tackle)] });
    const target = mon({ currentHp: 1 });
    const bench = mon({ name: "Bench" });
    const s = state(attacker, target, [target, bench]);
    const events = executeMove(s, 0, 0, hit);
    expect(s.sides[1].team[0].currentHp).toBe(0);
    expect(s.forcedSwitch[1]).toBe(true);
    expect(s.winner).toBeNull();
    expect(events.some((e) => e.type === "faint")).toBe(true);
  });

  it("sets the winner when the last mon faints", () => {
    const attacker = mon({ moves: [slot(tackle)] });
    const target = mon({ currentHp: 1 });
    const s = state(attacker, target); // only one mon on side 1
    executeMove(s, 0, 0, hit);
    expect(s.winner).toBe(0);
  });

  it("applies a status condition from a status move", () => {
    const attacker = mon({ moves: [slot(thunderWave)] });
    const s = state(attacker, mon());
    executeMove(s, 0, 0, hit);
    expect(s.sides[1].team[0].status).toBe("paralysis");
  });

  it("misses when accuracy roll fails", () => {
    const attacker = mon({ moves: [slot({ ...tackle, accuracy: 50 })] });
    const s = state(attacker, mon());
    const miss: RNG = { ...hit, next: () => 0.99 }; // 0.99*100=99 >= 50 → miss
    const events = executeMove(s, 0, 0, miss);
    expect(s.sides[1].team[0].currentHp).toBe(150);
    expect(events.some((e) => e.type === "miss")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/execute-move.test.ts`
Expected: FAIL — cannot find module `./execute-move`.

- [ ] **Step 3: Write `execute-move.ts`**

```ts
import { computeDamage } from "./damage";
import type { RNG } from "./rng";
import { effectivenessLabel } from "./type-chart";
import type { BattleEvent, BattleState, SideIndex } from "./types";

function activeOf(state: BattleState, side: SideIndex) {
  return state.sides[side].team[state.sides[side].activeIndex];
}

function hasHealthyBench(state: BattleState, side: SideIndex): boolean {
  return state.sides[side].team.some((m, i) => i !== state.sides[side].activeIndex && m.currentHp > 0);
}

/** Mutates `state`. Resolves one move by `side`'s active Pokémon against the opponent. */
export function executeMove(
  state: BattleState,
  side: SideIndex,
  moveIndex: number,
  rng: RNG,
): BattleEvent[] {
  const events: BattleEvent[] = [];
  const attacker = activeOf(state, side);
  const foeSide = (side === 0 ? 1 : 0) as SideIndex;
  const defender = activeOf(state, foeSide);
  const slot = attacker.moves[moveIndex];
  if (!slot) return events;

  // Sleep: a Pokémon asleep for N turns is prevented for N turns, then wakes
  // and acts on turn N+1. Decrement-and-return while asleep; wake only once the
  // counter has already reached 0 (so sleepTurns=1 costs exactly one turn).
  if (attacker.status === "sleep") {
    if (attacker.sleepTurns > 0) {
      attacker.sleepTurns -= 1;
      events.push({ type: "statusPrevent", side, pokemon: attacker.name, status: "sleep" });
      return events;
    }
    attacker.status = "none";
    events.push({ type: "wake", side, pokemon: attacker.name });
  }

  // Paralysis: 25% full-turn stop.
  if (attacker.status === "paralysis" && rng.chance(25)) {
    events.push({ type: "statusPrevent", side, pokemon: attacker.name, status: "paralysis" });
    return events;
  }

  slot.pp = Math.max(0, slot.pp - 1);
  events.push({ type: "move", side, pokemon: attacker.name, move: slot.move.name });

  // Accuracy check (accuracy 0 = never miss).
  if (slot.move.accuracy > 0 && !rng.chance(slot.move.accuracy)) {
    events.push({ type: "miss", side, pokemon: attacker.name });
    return events;
  }

  if (slot.move.category === "status") {
    if (slot.move.inflicts && defender.status === "none") {
      defender.status = slot.move.inflicts;
      if (slot.move.inflicts === "sleep") defender.sleepTurns = 1 + rng.int(3); // 1..3
      events.push({ type: "status", side: foeSide, pokemon: defender.name, status: slot.move.inflicts });
    }
    return events;
  }

  const { damage, effectiveness, crit } = computeDamage({ attacker, defender, move: slot.move, rng });
  defender.currentHp = Math.max(0, defender.currentHp - damage);
  events.push({
    type: "damage",
    side: foeSide,
    pokemon: defender.name,
    amount: damage,
    remainingHp: defender.currentHp,
    effectiveness: effectivenessLabel(effectiveness),
    crit,
  });

  if (defender.currentHp === 0) {
    events.push({ type: "faint", side: foeSide, pokemon: defender.name });
    if (hasHealthyBench(state, foeSide)) {
      state.forcedSwitch[foeSide] = true;
      events.push({ type: "forcedSwitch", side: foeSide });
    } else {
      state.winner = side;
      events.push({ type: "win", side });
    }
  }
  return events;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/battle/execute-move.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/battle/execute-move.ts src/lib/battle/execute-move.test.ts
git commit -m "feat(battle): single-move execution with accuracy, PP, faint, status"
```

---

### Task 7: End-of-turn status damage

**Files:**
- Create: `src/lib/battle/end-of-turn.ts`
- Test: `src/lib/battle/end-of-turn.test.ts`

**Interfaces:**
- Consumes: `BattleState`, `SideIndex`, `BattleEvent` (`./types`).
- Produces: `applyEndOfTurn(state: BattleState, order: SideIndex[]): BattleEvent[]` — **mutates** `state`. For each active in the given side order: burn deals `floor(maxHp/16)`, poison deals `floor(maxHp/8)` (min 1). If it faints, emits `faint` and flips `forcedSwitch` or sets `winner`. Skips sides already flagged for forced switch (their active already fainted this turn).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/battle/end-of-turn.test.ts
import { describe, expect, it } from "vitest";
import type { BattlePokemon, BattleState } from "./types";
import { applyEndOfTurn } from "./end-of-turn";

function mon(partial: Partial<BattlePokemon> = {}): BattlePokemon {
  return {
    id: 1, name: "M", types: ["normal"], level: 50,
    stats: { hp: 160, attack: 100, defense: 100, "special-attack": 100, "special-defense": 100, speed: 100 },
    maxHp: 160, currentHp: 160, moves: [], status: "none", sleepTurns: 0, frontSprite: "", backSprite: "",
    ...partial,
  };
}
function state(a: BattlePokemon, b: BattlePokemon): BattleState {
  return {
    sides: [{ team: [a], activeIndex: 0 }, { team: [b], activeIndex: 0 }],
    turn: 1, forcedSwitch: [false, false], winner: null,
  };
}

describe("applyEndOfTurn", () => {
  it("burn removes maxHp/16", () => {
    const s = state(mon({ status: "burn" }), mon());
    applyEndOfTurn(s, [0, 1]);
    expect(s.sides[0].team[0].currentHp).toBe(160 - 10);
  });
  it("poison removes maxHp/8", () => {
    const s = state(mon({ status: "poison" }), mon());
    applyEndOfTurn(s, [0, 1]);
    expect(s.sides[0].team[0].currentHp).toBe(160 - 20);
  });
  it("declares a winner if status KOs the last mon", () => {
    const s = state(mon({ status: "poison", currentHp: 5 }), mon());
    applyEndOfTurn(s, [0, 1]);
    expect(s.sides[0].team[0].currentHp).toBe(0);
    expect(s.winner).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/end-of-turn.test.ts`
Expected: FAIL — cannot find module `./end-of-turn`.

- [ ] **Step 3: Write `end-of-turn.ts`**

```ts
import type { BattleEvent, BattleState, SideIndex } from "./types";

function hasHealthyBench(state: BattleState, side: SideIndex): boolean {
  return state.sides[side].team.some((m, i) => i !== state.sides[side].activeIndex && m.currentHp > 0);
}

export function applyEndOfTurn(state: BattleState, order: SideIndex[]): BattleEvent[] {
  const events: BattleEvent[] = [];
  for (const side of order) {
    if (state.winner !== null) break;
    if (state.forcedSwitch[side]) continue; // active already fainted this turn
    const mon = state.sides[side].team[state.sides[side].activeIndex];
    if (mon.currentHp <= 0) continue;

    let amount = 0;
    if (mon.status === "burn") amount = Math.max(1, Math.floor(mon.maxHp / 16));
    else if (mon.status === "poison") amount = Math.max(1, Math.floor(mon.maxHp / 8));
    if (amount === 0) continue;

    mon.currentHp = Math.max(0, mon.currentHp - amount);
    events.push({
      type: "statusDamage",
      side, pokemon: mon.name, status: mon.status,
      amount, remainingHp: mon.currentHp,
    });

    if (mon.currentHp === 0) {
      events.push({ type: "faint", side, pokemon: mon.name });
      if (hasHealthyBench(state, side)) {
        state.forcedSwitch[side] = true;
        events.push({ type: "forcedSwitch", side });
      } else {
        state.winner = (side === 0 ? 1 : 0) as SideIndex;
        events.push({ type: "win", side: state.winner });
      }
    }
  }
  return events;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/battle/end-of-turn.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/battle/end-of-turn.ts src/lib/battle/end-of-turn.test.ts
git commit -m "feat(battle): end-of-turn burn/poison damage"
```

---

### Task 8: Engine orchestrator (createBattle, resolveTurn, chooseReplacement, legalActions)

**Files:**
- Create: `src/lib/battle/engine.ts`
- Test: `src/lib/battle/engine.test.ts`

**Interfaces:**
- Consumes: everything above — `orderActions` (`./order`), `executeMove` (`./execute-move`), `applyEndOfTurn` (`./end-of-turn`); types from `./types`; `RNG` from `./rng`.
- Produces:
  - `createBattle(a: { team: BattlePokemon[]; lead: number }, b: { team: BattlePokemon[]; lead: number }): BattleState`.
  - `resolveTurn(state: BattleState, actions: [TurnAction, TurnAction], rng: RNG): TurnResult` — requires neither side flagged `forcedSwitch`. Applies switches/moves in order, then end-of-turn, then `turn += 1`. If a side faints mid-turn and would have acted second with a move, that action is skipped.
  - `chooseReplacement(state: BattleState, side: SideIndex, teamIndex: number): TurnResult` — sets `activeIndex`, clears that side's `forcedSwitch`, emits a `switch` event.
  - `legalActions(state: BattleState, side: SideIndex): TurnAction[]` — moves with PP > 0 for the active, plus switches to any non-fainted, non-active bench member. If `forcedSwitch[side]`, only switches.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/battle/engine.test.ts
import { describe, expect, it } from "vitest";
import { createRng } from "./rng";
import type { BattlePokemon, Move, MoveSlot } from "./types";
import { chooseReplacement, createBattle, legalActions, resolveTurn } from "./engine";

const tackle: Move = { id: 1, name: "Tackle", type: "normal", category: "physical", power: 40, accuracy: 100, pp: 35, priority: 0 };
function slot(move: Move, pp = move.pp): MoveSlot {
  return { move, pp };
}
function mon(name: string, partial: Partial<BattlePokemon> = {}): BattlePokemon {
  return {
    id: 1, name, types: ["normal"], level: 50,
    stats: { hp: 150, attack: 110, defense: 70, "special-attack": 100, "special-defense": 70, speed: 100 },
    maxHp: 150, currentHp: 150, moves: [slot(tackle)], status: "none", sleepTurns: 0, frontSprite: "", backSprite: "",
    ...partial,
  };
}
function team(prefix: string): BattlePokemon[] {
  return [mon(`${prefix}1`), mon(`${prefix}2`), mon(`${prefix}3`)];
}

describe("engine", () => {
  it("createBattle sets both leads and turn 1", () => {
    const s = createBattle({ team: team("A"), lead: 1 }, { team: team("B"), lead: 0 });
    expect(s.sides[0].activeIndex).toBe(1);
    expect(s.sides[1].activeIndex).toBe(0);
    expect(s.turn).toBe(1);
  });

  it("resolveTurn applies both moves and advances the turn without mutating input", () => {
    const s = createBattle({ team: team("A"), lead: 0 }, { team: team("B"), lead: 0 });
    const { state } = resolveTurn(s, [{ kind: "move", moveIndex: 0 }, { kind: "move", moveIndex: 0 }], createRng(3));
    expect(state.turn).toBe(2);
    expect(state.sides[0].team[0].currentHp).toBeLessThan(150);
    expect(state.sides[1].team[0].currentHp).toBeLessThan(150);
    expect(s.turn).toBe(1); // original untouched
  });

  it("a switch swaps the active mon and dodges nothing else", () => {
    const s = createBattle({ team: team("A"), lead: 0 }, { team: team("B"), lead: 0 });
    const { state } = resolveTurn(s, [{ kind: "switch", teamIndex: 2 }, { kind: "move", moveIndex: 0 }], createRng(3));
    expect(state.sides[0].activeIndex).toBe(2);
  });

  it("chooseReplacement clears the forced-switch flag", () => {
    const s = createBattle({ team: team("A"), lead: 0 }, { team: team("B"), lead: 0 });
    s.forcedSwitch[1] = true;
    const { state } = chooseReplacement(s, 1, 1);
    expect(state.sides[1].activeIndex).toBe(1);
    expect(state.forcedSwitch[1]).toBe(false);
  });

  it("legalActions returns only switches during a forced switch", () => {
    const s = createBattle({ team: team("A"), lead: 0 }, { team: team("B"), lead: 0 });
    s.forcedSwitch[0] = true;
    s.sides[0].team[0].currentHp = 0;
    expect(legalActions(s, 0).every((a) => a.kind === "switch")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/engine.test.ts`
Expected: FAIL — cannot find module `./engine`.

- [ ] **Step 3: Write `engine.ts`**

```ts
import { applyEndOfTurn } from "./end-of-turn";
import { executeMove } from "./execute-move";
import { orderActions } from "./order";
import type { RNG } from "./rng";
import type {
  BattleEvent,
  BattlePokemon,
  BattleState,
  SideIndex,
  TurnAction,
  TurnResult,
} from "./types";

export function createBattle(
  a: { team: BattlePokemon[]; lead: number },
  b: { team: BattlePokemon[]; lead: number },
): BattleState {
  return {
    sides: [
      { team: a.team, activeIndex: a.lead },
      { team: b.team, activeIndex: b.lead },
    ],
    turn: 1,
    forcedSwitch: [false, false],
    winner: null,
  };
}

function applySwitch(state: BattleState, side: SideIndex, teamIndex: number): BattleEvent[] {
  const s = state.sides[side];
  const from = s.team[s.activeIndex].name;
  s.activeIndex = teamIndex;
  return [{ type: "switch", side, from, to: s.team[teamIndex].name }];
}

export function resolveTurn(
  state: BattleState,
  actions: [TurnAction, TurnAction],
  rng: RNG,
): TurnResult {
  const next: BattleState = structuredClone(state);
  const events: BattleEvent[] = [];
  const order = orderActions(next, actions, rng);

  for (const side of order) {
    if (next.winner !== null) break;
    // A side whose active fainted earlier this turn can't act with a move.
    if (next.forcedSwitch[side]) continue;
    const action = actions[side];
    if (action.kind === "switch") {
      events.push(...applySwitch(next, side, action.teamIndex));
    } else {
      events.push(...executeMove(next, side, action.moveIndex, rng));
    }
  }

  if (next.winner === null) events.push(...applyEndOfTurn(next, order));
  next.turn += 1;
  return { state: next, events };
}

export function chooseReplacement(
  state: BattleState,
  side: SideIndex,
  teamIndex: number,
): TurnResult {
  const next: BattleState = structuredClone(state);
  const events = applySwitch(next, side, teamIndex);
  next.forcedSwitch[side] = false;
  return { state: next, events };
}

export function legalActions(state: BattleState, side: SideIndex): TurnAction[] {
  const s = state.sides[side];
  const switches: TurnAction[] = s.team
    .map((m, i) => ({ m, i }))
    .filter(({ m, i }) => i !== s.activeIndex && m.currentHp > 0)
    .map(({ i }) => ({ kind: "switch", teamIndex: i }));

  if (state.forcedSwitch[side]) return switches;

  const active = s.team[s.activeIndex];
  const moves: TurnAction[] = active.moves
    .map((slot, i) => ({ slot, i }))
    .filter(({ slot }) => slot.pp > 0)
    .map(({ i }) => ({ kind: "move", moveIndex: i }));

  return [...moves, ...switches];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/battle/engine.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the whole suite + typecheck + lint**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: all pass (existing 34 + new battle tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/battle/engine.ts src/lib/battle/engine.test.ts
git commit -m "feat(battle): engine orchestrator (resolveTurn, switching, win)"
```

---

## Self-Review

**Spec coverage (Phase 1 scope):**
- Level-50 stat formula → Task 3. ✓
- Damage formula + STAB + crit + burn + random factor → Task 4. ✓
- Full 18-type chart → Task 2. ✓
- Turn order (priority, Speed, paralysis, RNG tie) → Task 5. ✓
- Accuracy, PP, move execution → Task 6. ✓
- Four statuses: paralysis (speed/skip → Tasks 5 & 6), burn (damage cut in Task 4, chip in Task 7), poison (chip Task 7), sleep (skip/wake Task 6) → ✓
- Switching as an action + forced switch on faint + win condition → Tasks 6, 7, 8. ✓
- Determinism via injected RNG → all tasks. ✓
- **Deferred to later phases (not in this plan):** `team-builder.ts`, `room.ts`, `protocol.ts`, Socket.IO server, PokeAPI `getMove`, UI. These get their own plans.

**Placeholder scan:** none — every step ships real code.

**Type consistency:** `BattlePokemon`, `Move`, `BattleState`, `TurnAction`, `BattleEvent`, `TurnResult`, `SideIndex`, `RNG` defined in Task 1 and used verbatim thereafter. `effectivenessLabel` (Task 2) consumed in Task 6. `computeDamage` signature (Task 4) consumed in Task 6. `orderActions`/`executeMove`/`applyEndOfTurn` signatures (Tasks 5–7) consumed in Task 8.
