# Battle Team Builder (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a random pick of PokéAPI species into ready-to-battle `BattlePokemon` (level-50 stats, types, front/back pixel sprites, 4 usable moves) so the room manager can hand each player a random team of 3.

**Architecture:** Keep all decision logic in PURE, unit-tested functions (move mapping, move selection, team-id picking, `BattlePokemon` assembly from already-fetched data). Isolate network I/O in one thin orchestrator that fetches PokéAPI data and calls the pure builder — the orchestrator takes injectable fetch deps so it is testable with fakes (no real network in tests).

**Tech Stack:** TypeScript, Vitest. Consumes the Phase-1 engine types (`src/lib/battle/types.ts`) and the existing PokéAPI client (`src/lib/pokeapi/`).

## Global Constraints

- Level 50, IV 31, EV 0, neutral nature — reuse `computeStats` from `src/lib/battle/stats.ts` (do NOT reimplement).
- A `Move` is only usable if its type is one of the 18 `TypeSlug`s, and: a damaging move (`physical`/`special`) needs `power > 0`; a `status` move must inflict one of our four conditions (`paralysis`/`burn`/`poison`/`sleep`). Unusable moves are dropped.
- Every built `BattlePokemon` MUST have exactly up to 4 moves and AT LEAST ONE damaging move (fall back to a built-in Struggle-like move if the species yields none).
- Randomness ONLY via the injected `RNG` (`src/lib/battle/rng.ts`) — never `Math.random()`.
- Pure modules (`team-builder.ts` mapping/selection/assembly) must not import `next`/`react`/`socket.io`. The I/O orchestrator may import the PokéAPI client.
- Tests: `import { describe, expect, it } from "vitest"`, colocated `*.test.ts`, run `pnpm vitest run <file>`.
- Sprites: prefer PokéAPI pixel sprites (`sprites.front_default` / `sprites.back_default`); fall back to official artwork URL when a sprite is null.

---

### Task 1: Extend PokéAPI types + `getMove`

**Files:**
- Modify: `src/lib/pokeapi/types.ts`
- Modify: `src/lib/pokeapi/client.ts`

**Interfaces:**
- Produces: extended `PokemonResponse` (adds `sprites.front_default`, `sprites.back_default`, and a `moves` array); new `MoveResponse`; `getMove(idOrName): Promise<MoveResponse>`.

- [ ] **Step 1: Extend `PokemonResponse` and add `MoveResponse` in `types.ts`**

Change the `sprites` field of `PokemonResponse` and add a `moves` field, then append `MoveResponse`:

```ts
export interface PokemonResponse {
  id: number;
  name: string;
  height: number;
  weight: number;
  stats: { base_stat: number; stat: NamedApiResource }[];
  types: { slot: number; type: NamedApiResource }[];
  abilities: { ability: NamedApiResource; is_hidden: boolean }[];
  sprites: {
    front_default: string | null;
    back_default: string | null;
    other?: { "official-artwork"?: { front_default: string | null } };
  };
  moves: { move: NamedApiResource }[];
}

export interface MoveResponse {
  id: number;
  name: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  priority: number;
  type: NamedApiResource;
  damage_class: NamedApiResource; // "physical" | "special" | "status"
  meta: { ailment: NamedApiResource } | null; // ailment.name: "paralysis" | "burn" | "poison" | "sleep" | "none" | ...
}
```

- [ ] **Step 2: Add `getMove` in `client.ts`**

Add alongside the other exported fetchers (it uses the existing `fetchJson` + `MoveResponse` import):

```ts
export const getMove = (idOrName: string | number): Promise<MoveResponse> =>
  fetchJson(`/move/${idOrName}`);
```

Add `MoveResponse` to the type import from `./types` at the top of `client.ts`.

- [ ] **Step 3: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS (no errors). Existing loaders that read `pokemon.sprites.other` still compile because `other` remains present.

- [ ] **Step 4: Commit**

```bash
git add src/lib/pokeapi/types.ts src/lib/pokeapi/client.ts
git commit -m "feat(battle): PokeAPI move types + getMove; sprite/move fields on PokemonResponse"
```

---

### Task 2: Map a PokéAPI move to an engine `Move`

**Files:**
- Create: `src/lib/battle/team-builder.ts`
- Test: `src/lib/battle/team-builder.test.ts`

**Interfaces:**
- Consumes: `MoveResponse` (`@/lib/pokeapi/types`); `Move`, `MoveCategory`, `StatusCondition` (`./types`); `isTypeSlug` (`@/lib/domain/types`).
- Produces:
  - `mapAilment(name: string): Exclude<StatusCondition, "none"> | null`.
  - `toMove(res: MoveResponse): Move | null` — returns null for moves we cannot represent (non-TypeSlug type; damaging move with no power; status move whose ailment is not one of our four).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/battle/team-builder.test.ts
import { describe, expect, it } from "vitest";
import type { MoveResponse } from "@/lib/pokeapi/types";
import { mapAilment, toMove } from "./team-builder";

function moveRes(partial: Partial<MoveResponse> = {}): MoveResponse {
  return {
    id: 1, name: "tackle", power: 40, accuracy: 100, pp: 35, priority: 0,
    type: { name: "normal", url: "" },
    damage_class: { name: "physical", url: "" },
    meta: { ailment: { name: "none", url: "" } },
    ...partial,
  };
}

describe("mapAilment", () => {
  it("maps the four supported ailments", () => {
    expect(mapAilment("paralysis")).toBe("paralysis");
    expect(mapAilment("burn")).toBe("burn");
    expect(mapAilment("poison")).toBe("poison");
    expect(mapAilment("sleep")).toBe("sleep");
  });
  it("returns null for unsupported ailments", () => {
    expect(mapAilment("freeze")).toBeNull();
    expect(mapAilment("none")).toBeNull();
  });
});

describe("toMove", () => {
  it("maps a damaging move", () => {
    const m = toMove(moveRes({ name: "flamethrower", type: { name: "fire", url: "" }, damage_class: { name: "special", url: "" }, power: 90 }));
    expect(m).toEqual({ id: 1, name: "flamethrower", type: "fire", category: "special", power: 90, accuracy: 100, pp: 35, priority: 0 });
  });
  it("maps a status move with a supported ailment", () => {
    const m = toMove(moveRes({ name: "thunder-wave", type: { name: "electric", url: "" }, damage_class: { name: "status", url: "" }, power: null, meta: { ailment: { name: "paralysis", url: "" } } }));
    expect(m?.category).toBe("status");
    expect(m?.inflicts).toBe("paralysis");
    expect(m?.power).toBe(0);
  });
  it("drops moves with a non-standard type", () => {
    expect(toMove(moveRes({ type: { name: "shadow", url: "" } }))).toBeNull();
  });
  it("drops damaging moves with no power", () => {
    expect(toMove(moveRes({ power: null }))).toBeNull();
  });
  it("drops status moves whose ailment is unsupported", () => {
    expect(toMove(moveRes({ damage_class: { name: "status", url: "" }, power: null, meta: { ailment: { name: "confusion", url: "" } } }))).toBeNull();
  });
  it("treats null accuracy as never-miss (0)", () => {
    expect(toMove(moveRes({ accuracy: null }))?.accuracy).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/team-builder.test.ts`
Expected: FAIL — cannot find module `./team-builder`.

- [ ] **Step 3: Write `team-builder.ts` (this task's slice)**

```ts
import { isTypeSlug } from "@/lib/domain/types";
import type { MoveResponse } from "@/lib/pokeapi/types";
import type { Move, MoveCategory, StatusCondition } from "./types";

const AILMENTS: Record<string, Exclude<StatusCondition, "none">> = {
  paralysis: "paralysis",
  burn: "burn",
  poison: "poison",
  sleep: "sleep",
};

export function mapAilment(name: string): Exclude<StatusCondition, "none"> | null {
  return AILMENTS[name] ?? null;
}

function toCategory(name: string): MoveCategory | null {
  return name === "physical" || name === "special" || name === "status" ? name : null;
}

export function toMove(res: MoveResponse): Move | null {
  if (!isTypeSlug(res.type.name)) return null;
  const category = toCategory(res.damage_class.name);
  if (category === null) return null;

  const move: Move = {
    id: res.id,
    name: res.name,
    type: res.type.name,
    category,
    power: res.power ?? 0,
    accuracy: res.accuracy ?? 0, // 0 = never misses (engine convention)
    pp: res.pp ?? 5,
    priority: res.priority,
  };

  if (category === "status") {
    const inflicts = mapAilment(res.meta?.ailment.name ?? "none");
    if (inflicts === null) return null; // status move we can't model
    move.inflicts = inflicts;
    return move;
  }

  if (move.power <= 0) return null; // damaging move with no usable power
  return move;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/battle/team-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/battle/team-builder.ts src/lib/battle/team-builder.test.ts
git commit -m "feat(battle): map PokeAPI moves to engine moves"
```

---

### Task 3: Pick random distinct team ids

**Files:**
- Modify: `src/lib/battle/team-builder.ts`
- Modify: `src/lib/battle/team-builder.test.ts`

**Interfaces:**
- Consumes: `RNG` (`./rng`).
- Produces: `pickTeamIds(rng: RNG, count: number, maxId: number): number[]` — `count` distinct ids in `1..maxId`.

- [ ] **Step 1: Add the failing test** (append to existing test file)

```ts
import { createRng } from "./rng";
import { pickTeamIds } from "./team-builder";

describe("pickTeamIds", () => {
  it("returns the requested count of distinct ids within range", () => {
    const ids = pickTeamIds(createRng(5), 3, 1025);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) {
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(1025);
    }
  });
  it("is deterministic for a seed", () => {
    expect(pickTeamIds(createRng(9), 3, 1025)).toEqual(pickTeamIds(createRng(9), 3, 1025));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/team-builder.test.ts`
Expected: FAIL — `pickTeamIds` is not exported.

- [ ] **Step 3: Add `pickTeamIds` to `team-builder.ts`**

```ts
import type { RNG } from "./rng";

export function pickTeamIds(rng: RNG, count: number, maxId: number): number[] {
  const chosen = new Set<number>();
  while (chosen.size < count && chosen.size < maxId) {
    chosen.add(1 + rng.int(maxId));
  }
  return [...chosen];
}
```

(Add the `RNG` import to the existing import block.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/battle/team-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/battle/team-builder.ts src/lib/battle/team-builder.test.ts
git commit -m "feat(battle): random distinct team id picker"
```

---

### Task 4: Select 4 moves (guarantee ≥1 damaging)

**Files:**
- Modify: `src/lib/battle/team-builder.ts`
- Modify: `src/lib/battle/team-builder.test.ts`

**Interfaces:**
- Consumes: `Move`, `MoveSlot` (`./types`); `RNG` (`./rng`).
- Produces:
  - `STRUGGLE: Move` — built-in fallback damaging move.
  - `selectMoves(candidates: Move[], rng: RNG): MoveSlot[]` — up to 4 distinct moves (by `id`), always containing at least one damaging move (`category !== "status" && power > 0`); if the candidates contain no damaging move, `STRUGGLE` is included. Each slot's `pp` starts at `move.pp`.

- [ ] **Step 1: Add the failing test**

```ts
import { selectMoves, STRUGGLE } from "./team-builder";
import type { Move } from "./types";

function dmg(id: number, name: string): Move {
  return { id, name, type: "normal", category: "physical", power: 40, accuracy: 100, pp: 20, priority: 0 };
}
function status(id: number, name: string): Move {
  return { id, name, type: "electric", category: "status", power: 0, accuracy: 100, pp: 20, priority: 0, inflicts: "paralysis" };
}

describe("selectMoves", () => {
  it("returns at most 4 slots with starting pp", () => {
    const slots = selectMoves([dmg(1, "a"), dmg(2, "b"), dmg(3, "c"), dmg(4, "d"), dmg(5, "e")], createRng(1));
    expect(slots).toHaveLength(4);
    expect(slots.every((s) => s.pp === s.move.pp)).toBe(true);
    expect(new Set(slots.map((s) => s.move.id)).size).toBe(4);
  });
  it("always includes at least one damaging move", () => {
    const slots = selectMoves([status(1, "a"), status(2, "b"), status(3, "c"), status(4, "d")], createRng(1));
    expect(slots.some((s) => s.move.category !== "status" && s.move.power > 0)).toBe(true);
  });
  it("uses STRUGGLE as the damaging fallback when there are no damaging candidates", () => {
    const slots = selectMoves([status(1, "a")], createRng(1));
    expect(slots.some((s) => s.move.id === STRUGGLE.id)).toBe(true);
  });
  it("returns at least one slot even with no candidates", () => {
    const slots = selectMoves([], createRng(1));
    expect(slots).toHaveLength(1);
    expect(slots[0].move.id).toBe(STRUGGLE.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/team-builder.test.ts`
Expected: FAIL — `selectMoves`/`STRUGGLE` not exported.

- [ ] **Step 3: Add `STRUGGLE` and `selectMoves` to `team-builder.ts`**

```ts
import type { MoveSlot } from "./types";

export const STRUGGLE: Move = {
  id: 165,
  name: "struggle",
  type: "normal",
  category: "physical",
  power: 50,
  accuracy: 0, // never misses
  pp: 1,
  priority: 0,
};

function isDamaging(move: Move): boolean {
  return move.category !== "status" && move.power > 0;
}

function shuffle<T>(items: T[], rng: RNG): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function selectMoves(candidates: Move[], rng: RNG): MoveSlot[] {
  // Dedupe by id, then shuffle for variety.
  const unique = [...new Map(candidates.map((m) => [m.id, m])).values()];
  const shuffled = shuffle(unique, rng);

  const picked: Move[] = shuffled.slice(0, 4);
  if (!picked.some(isDamaging)) {
    // Guarantee a damaging option: swap in a damaging candidate, else STRUGGLE.
    const damaging = shuffled.find(isDamaging) ?? STRUGGLE;
    if (picked.length < 4) picked.push(damaging);
    else picked[picked.length - 1] = damaging;
  }
  if (picked.length === 0) picked.push(STRUGGLE);

  return picked.map((move) => ({ move, pp: move.pp }));
}
```

(Add `MoveSlot` to the `./types` import.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/battle/team-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/battle/team-builder.ts src/lib/battle/team-builder.test.ts
git commit -m "feat(battle): 4-move selection with damaging-move guarantee"
```

---

### Task 5: Assemble a `BattlePokemon` from fetched data (pure)

**Files:**
- Modify: `src/lib/battle/team-builder.ts`
- Modify: `src/lib/battle/team-builder.test.ts`

**Interfaces:**
- Consumes: `PokemonResponse` (`@/lib/pokeapi/types`); `computeStats` (`./stats`); `formatPokemonName`, `officialArtworkUrl` (`@/lib/domain/format`); `isTypeSlug`, `STAT_SLUGS`, `StatSlug` (`@/lib/domain/types`); `Move`, `BattlePokemon` (`./types`); `RNG` (`./rng`).
- Produces: `buildBattlePokemon(pokemon: PokemonResponse, candidateMoves: Move[], rng: RNG): BattlePokemon` — level 50; stats via `computeStats`; `currentHp = maxHp = stats.hp`; types filtered to `TypeSlug`; front/back sprites (fallback to official artwork when null); moves via `selectMoves`.

- [ ] **Step 1: Add the failing test**

```ts
import type { PokemonResponse } from "@/lib/pokeapi/types";
import { buildBattlePokemon } from "./team-builder";

function charizardResponse(): PokemonResponse {
  return {
    id: 6, name: "charizard", height: 17, weight: 905,
    stats: [
      { base_stat: 78, stat: { name: "hp", url: "" } },
      { base_stat: 84, stat: { name: "attack", url: "" } },
      { base_stat: 78, stat: { name: "defense", url: "" } },
      { base_stat: 109, stat: { name: "special-attack", url: "" } },
      { base_stat: 85, stat: { name: "special-defense", url: "" } },
      { base_stat: 100, stat: { name: "speed", url: "" } },
    ],
    types: [
      { slot: 1, type: { name: "fire", url: "" } },
      { slot: 2, type: { name: "flying", url: "" } },
    ],
    abilities: [],
    sprites: { front_default: "front.png", back_default: "back.png" },
    moves: [],
  };
}

describe("buildBattlePokemon", () => {
  it("builds a level-50 battler with computed stats and full HP", () => {
    const mon = buildBattlePokemon(charizardResponse(), [dmg(1, "ember")], createRng(1));
    expect(mon.level).toBe(50);
    expect(mon.name).toBe("Charizard");
    expect(mon.types).toEqual(["fire", "flying"]);
    expect(mon.maxHp).toBe(153);
    expect(mon.currentHp).toBe(153);
    expect(mon.stats.speed).toBe(120);
    expect(mon.moves.length).toBeGreaterThanOrEqual(1);
    expect(mon.status).toBe("none");
  });
  it("uses pixel sprites and falls back to artwork when null", () => {
    const withSprites = buildBattlePokemon(charizardResponse(), [dmg(1, "ember")], createRng(1));
    expect(withSprites.frontSprite).toBe("front.png");
    expect(withSprites.backSprite).toBe("back.png");
    const noSprites = charizardResponse();
    noSprites.sprites = { front_default: null, back_default: null };
    const built = buildBattlePokemon(noSprites, [dmg(1, "ember")], createRng(1));
    expect(built.frontSprite).toContain("6.png");
    expect(built.backSprite).toContain("6.png");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/team-builder.test.ts`
Expected: FAIL — `buildBattlePokemon` not exported.

- [ ] **Step 3: Add `buildBattlePokemon` to `team-builder.ts`**

```ts
import { STAT_SLUGS, isTypeSlug, type StatSlug } from "@/lib/domain/types";
import { formatPokemonName, officialArtworkUrl } from "@/lib/domain/format";
import { computeStats } from "./stats";
import type { BattlePokemon } from "./types";

const LEVEL = 50;

export function buildBattlePokemon(
  pokemon: PokemonResponse,
  candidateMoves: Move[],
  rng: RNG,
): BattlePokemon {
  const base = {} as Record<StatSlug, number>;
  for (const slug of STAT_SLUGS) base[slug] = 0;
  for (const entry of pokemon.stats) {
    if ((STAT_SLUGS as readonly string[]).includes(entry.stat.name)) {
      base[entry.stat.name as StatSlug] = entry.base_stat;
    }
  }
  const stats = computeStats(base, LEVEL);
  const artwork = officialArtworkUrl(pokemon.id);

  return {
    id: pokemon.id,
    name: formatPokemonName(pokemon.name),
    types: pokemon.types
      .slice()
      .sort((a, b) => a.slot - b.slot)
      .map((t) => t.type.name)
      .filter(isTypeSlug),
    level: LEVEL,
    stats,
    maxHp: stats.hp,
    currentHp: stats.hp,
    moves: selectMoves(candidateMoves, rng),
    status: "none",
    sleepTurns: 0,
    frontSprite: pokemon.sprites.front_default ?? artwork,
    backSprite: pokemon.sprites.back_default ?? artwork,
  };
}
```

(Merge the new imports into the existing import block; `STAT_SLUGS`/`isTypeSlug` may already be imported.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/battle/team-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/battle/team-builder.ts src/lib/battle/team-builder.test.ts
git commit -m "feat(battle): assemble BattlePokemon from PokeAPI data"
```

---

### Task 6: I/O orchestration — load a battler and roll a team

**Files:**
- Modify: `src/lib/battle/team-builder.ts`
- Modify: `src/lib/battle/team-builder.test.ts`

**Interfaces:**
- Consumes: `getPokemon`, `getMove` (`@/lib/pokeapi/client`); `inBatches` (`@/lib/pokeapi/batch`); `PokemonResponse`, `MoveResponse` (`@/lib/pokeapi/types`); the pure helpers above.
- Produces:
  - `chooseMoveNames(pokemon: PokemonResponse, rng: RNG, sampleSize: number): string[]` — up to `sampleSize` distinct move names, shuffled (pure).
  - `type BattleFetchers = { getPokemon: (id: number) => Promise<PokemonResponse>; getMove: (name: string) => Promise<MoveResponse> }`.
  - `loadBattlePokemon(id: number, rng: RNG, deps?: BattleFetchers): Promise<BattlePokemon>` — fetches the species, samples up to 12 candidate move names, fetches them, maps via `toMove`, and builds. Defaults `deps` to the real client.
  - `rollBattleTeam(rng: RNG, opts?: { count?: number; maxId?: number; deps?: BattleFetchers }): Promise<BattlePokemon[]>` — picks ids and loads each (default count 3, maxId 1025).

- [ ] **Step 1: Add the failing test** (fakes the fetchers — no real network)

```ts
import { chooseMoveNames, loadBattlePokemon } from "./team-builder";
import type { MoveResponse } from "@/lib/pokeapi/types";

describe("chooseMoveNames", () => {
  it("returns up to sampleSize distinct names", () => {
    const p = charizardResponse();
    p.moves = [
      { move: { name: "ember", url: "" } },
      { move: { name: "fly", url: "" } },
      { move: { name: "slash", url: "" } },
    ];
    const names = chooseMoveNames(p, createRng(2), 2);
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
  });
});

describe("loadBattlePokemon", () => {
  it("fetches species + moves through injected deps and builds a battler", async () => {
    const p = charizardResponse();
    p.moves = [{ move: { name: "flamethrower", url: "" } }];
    const deps = {
      getPokemon: async () => p,
      getMove: async (): Promise<MoveResponse> => ({
        id: 53, name: "flamethrower", power: 90, accuracy: 100, pp: 15, priority: 0,
        type: { name: "fire", url: "" }, damage_class: { name: "special", url: "" },
        meta: { ailment: { name: "none", url: "" } },
      }),
    };
    const mon = await loadBattlePokemon(6, createRng(1), deps);
    expect(mon.name).toBe("Charizard");
    expect(mon.moves.some((s) => s.move.name === "flamethrower")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/battle/team-builder.test.ts`
Expected: FAIL — `chooseMoveNames`/`loadBattlePokemon` not exported.

- [ ] **Step 3: Add the orchestration to `team-builder.ts`**

```ts
import { getMove, getPokemon } from "@/lib/pokeapi/client";
import { inBatches } from "@/lib/pokeapi/batch";
import type { MoveResponse } from "@/lib/pokeapi/types";

const MOVE_SAMPLE = 12;
const MOVE_FETCH_BATCH = 6;

export interface BattleFetchers {
  getPokemon: (id: number) => Promise<PokemonResponse>;
  getMove: (name: string) => Promise<MoveResponse>;
}

const defaultFetchers: BattleFetchers = { getPokemon, getMove };

export function chooseMoveNames(pokemon: PokemonResponse, rng: RNG, sampleSize: number): string[] {
  const names = pokemon.moves.map((m) => m.move.name);
  return shuffle(names, rng).slice(0, sampleSize);
}

export async function loadBattlePokemon(
  id: number,
  rng: RNG,
  deps: BattleFetchers = defaultFetchers,
): Promise<BattlePokemon> {
  const pokemon = await deps.getPokemon(id);
  const names = chooseMoveNames(pokemon, rng, MOVE_SAMPLE);
  const fetched = await inBatches(names, MOVE_FETCH_BATCH, (name) => deps.getMove(name));
  const candidates = fetched
    .map(toMove)
    .filter((m): m is Move => m !== null);
  return buildBattlePokemon(pokemon, candidates, rng);
}

export async function rollBattleTeam(
  rng: RNG,
  opts: { count?: number; maxId?: number; deps?: BattleFetchers } = {},
): Promise<BattlePokemon[]> {
  const { count = 3, maxId = 1025, deps = defaultFetchers } = opts;
  const ids = pickTeamIds(rng, count, maxId);
  return inBatches(ids, count, (id) => loadBattlePokemon(id, rng, deps));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/battle/team-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole suite + typecheck + lint**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/battle/team-builder.ts src/lib/battle/team-builder.test.ts
git commit -m "feat(battle): load battler + roll random team (injectable fetchers)"
```

---

## Self-Review

**Spec coverage (Phase 2 scope):**
- Random 3 Pokémon, any gen/any type → `pickTeamIds` (Task 3) + `rollBattleTeam` (Task 6). ✓
- Level-50 battler with real stats → `buildBattlePokemon` reuses `computeStats` (Task 5). ✓
- 4 moves per Pokémon, ≥1 damaging → `selectMoves` + `STRUGGLE` (Task 4). ✓
- Moves mapped from PokéAPI, only representable ones, statuses limited to our four → `toMove`/`mapAilment` (Task 2). ✓
- Pixel front/back sprites for the retro screen, artwork fallback → Task 5. ✓
- Testable without network (injected fetchers) → Task 6. ✓
- Deferred to later phases: room manager + Socket.IO (Phase 3), retro battle UI (Phase 4).

**Placeholder scan:** none — every step ships real code.

**Type consistency:** `Move`, `MoveSlot`, `BattlePokemon`, `StatusCondition`, `RNG` come from Phase 1 and are used verbatim. `MoveResponse`/`PokemonResponse` defined in Task 1 and consumed in Tasks 2/5/6. `toMove`/`selectMoves`/`buildBattlePokemon`/`pickTeamIds`/`chooseMoveNames`/`shuffle` are all defined before the task that consumes them. `officialArtworkUrl` and `formatPokemonName` already exist in `@/lib/domain/format` (used by existing loaders).
```
