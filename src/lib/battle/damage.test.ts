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
    pick: (items) => items[0]!,
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
