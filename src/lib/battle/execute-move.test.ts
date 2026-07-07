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
const hit: RNG = { next: () => 0.99, int: (n) => n - 1, chance: (p) => 0.99 * 100 < p, pick: (i) => i[0]! };
const tackle: Move = { id: 1, name: "Tackle", type: "normal", category: "physical", power: 40, accuracy: 100, pp: 35, priority: 0 };
const thunderWave: Move = { id: 2, name: "Thunder Wave", type: "electric", category: "status", power: 0, accuracy: 100, pp: 20, priority: 0, inflicts: "paralysis" };

describe("executeMove", () => {
  it("deals damage and decrements PP", () => {
    const attacker = mon({ moves: [slot(tackle)] });
    const s = state(attacker, mon());
    const events = executeMove(s, 0, 0, hit);
    expect(s.sides[1].team[0]!.currentHp).toBeLessThan(150);
    expect(s.sides[0].team[0]!.moves[0]!.pp).toBe(34);
    expect(events.some((e) => e.type === "damage")).toBe(true);
  });

  it("faints the target and flags forced switch when the bench is alive", () => {
    const attacker = mon({ moves: [slot(tackle)] });
    const target = mon({ currentHp: 1 });
    const bench = mon({ name: "Bench" });
    const s = state(attacker, target, [target, bench]);
    const events = executeMove(s, 0, 0, hit);
    expect(s.sides[1].team[0]!.currentHp).toBe(0);
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
    expect(s.sides[1].team[0]!.status).toBe("paralysis");
  });

  it("misses when accuracy roll fails", () => {
    const attacker = mon({ moves: [slot({ ...tackle, accuracy: 50 })] });
    const s = state(attacker, mon());
    const miss: RNG = { next: () => 0.99, int: (n) => n - 1, chance: (p) => 0.99 * 100 < p, pick: (i) => i[0]! }; // 0.99*100=99 >= 50 → miss
    const events = executeMove(s, 0, 0, miss);
    expect(s.sides[1].team[0]!.currentHp).toBe(150);
    expect(events.some((e) => e.type === "miss")).toBe(true);
  });

  it("keeps an asleep pokemon from acting for its full sleepTurns count, then wakes and acts", () => {
    const attacker = mon({ moves: [slot(tackle)], status: "sleep", sleepTurns: 1 });
    const s = state(attacker, mon());

    // Turn 1: rolled 1 sleep turn — must be fully prevented this turn, no damage.
    const turn1 = executeMove(s, 0, 0, hit);
    expect(turn1).toEqual([{ type: "statusPrevent", side: 0, pokemon: "M", status: "sleep" }]);
    expect(s.sides[0].team[0]!.status).toBe("sleep");
    expect(s.sides[0].team[0]!.sleepTurns).toBe(0);
    expect(s.sides[1].team[0]!.currentHp).toBe(150);

    // Turn 2: wakes up and acts.
    const turn2 = executeMove(s, 0, 0, hit);
    expect(s.sides[0].team[0]!.status).toBe("none");
    expect(turn2.some((e) => e.type === "wake")).toBe(true);
    expect(turn2.some((e) => e.type === "damage")).toBe(true);
    expect(s.sides[1].team[0]!.currentHp).toBeLessThan(150);
  });

  it("prevents a paralyzed attacker from acting when the paralysis roll triggers", () => {
    const attacker = mon({ moves: [slot(tackle)], status: "paralysis" });
    const s = state(attacker, mon());
    const alwaysParalyzed: RNG = { next: () => 0.5, int: () => 0, chance: () => true, pick: (i) => i[0]! };
    const events = executeMove(s, 0, 0, alwaysParalyzed);
    expect(events).toEqual([{ type: "statusPrevent", side: 0, pokemon: "M", status: "paralysis" }]);
    expect(s.sides[1].team[0]!.currentHp).toBe(150);
    expect(s.sides[0].team[0]!.moves[0]!.pp).toBe(tackle.pp); // no PP spent, no action taken
  });
});
