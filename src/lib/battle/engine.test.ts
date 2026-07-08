import { describe, expect, it } from "vitest";
import { createRng } from "./rng";
import type { RNG } from "./rng";
import type { BattlePokemon, Move, MoveSlot } from "./types";
import { chooseReplacement, createBattle, legalActions, resolveTurn } from "./engine";

const tackle: Move = { id: 1, name: "Tackle", type: "normal", category: "physical", power: 40, accuracy: 100, pp: 35, priority: 0 };
function slot(move: Move, pp = move.pp): MoveSlot {
  return { move, pp };
}
function mon(name: string, partial: Partial<BattlePokemon> = {}): BattlePokemon {
  const base: BattlePokemon = {
    id: 1, name, types: ["normal"], level: 50,
    stats: { hp: 150, attack: 110, defense: 70, "special-attack": 100, "special-defense": 70, speed: 100 },
    maxHp: 150, currentHp: 150, moves: [slot(tackle)], status: "none", sleepTurns: 0, frontSprite: "", backSprite: "",
  };
  return { ...base, ...partial };
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
    expect(state.sides[0].team[0]!.currentHp).toBeLessThan(150);
    expect(state.sides[1].team[0]!.currentHp).toBeLessThan(150);
    expect(s.turn).toBe(1); // original untouched
  });

  it("resolveTurn: a null (timed-out) action does nothing while the opponent still acts", () => {
    const s = createBattle({ team: team("A"), lead: 0 }, { team: team("B"), lead: 0 });
    // Side 0 timed out (null); side 1 attacks.
    const { state, events } = resolveTurn(s, [null, { kind: "move", moveIndex: 0 }], createRng(3));
    expect(state.turn).toBe(2);
    // The passer (side 0) never moved.
    expect(events.some((e) => e.type === "move" && e.side === 0)).toBe(false);
    // The opponent (side 1) did move and dealt damage to side 0's active.
    expect(events.some((e) => e.type === "move" && e.side === 1)).toBe(true);
    expect(state.sides[0].team[0]!.currentHp).toBeLessThan(150);
    expect(state.sides[1].team[0]!.currentHp).toBe(150); // untouched
  });

  it("resolveTurn: both null (both timed out) — nobody acts, turn still advances", () => {
    const s = createBattle({ team: team("A"), lead: 0 }, { team: team("B"), lead: 0 });
    const { state, events } = resolveTurn(s, [null, null], createRng(3));
    expect(state.turn).toBe(2);
    expect(events.some((e) => e.type === "move")).toBe(false);
    expect(state.sides[0].team[0]!.currentHp).toBe(150);
    expect(state.sides[1].team[0]!.currentHp).toBe(150);
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
    s.sides[0].team[0]!.currentHp = 0;
    expect(legalActions(s, 0).every((a) => a.kind === "switch")).toBe(true);
  });

  it("resolveTurn stops resolving actions once a side's move sets the winner", () => {
    // Deterministic RNG: always "hits", never crits, mid-roll damage.
    const alwaysHit: RNG = { next: () => 0.99, int: (n) => n - 1, chance: (p) => 0.99 * 100 < p, pick: (i) => i[0]! };
    const fastStats = { hp: 150, attack: 110, defense: 70, "special-attack": 100, "special-defense": 70, speed: 150 };
    const slowStats = { hp: 150, attack: 110, defense: 70, "special-attack": 100, "special-defense": 70, speed: 10 };
    const a = mon("A1", { stats: fastStats });
    const b = mon("B1", { currentHp: 1, stats: slowStats }); // one hit from fainting, no bench
    const s = createBattle({ team: [a], lead: 0 }, { team: [b], lead: 0 });

    const { state, events } = resolveTurn(
      s,
      [{ kind: "move", moveIndex: 0 }, { kind: "move", moveIndex: 0 }],
      alwaysHit,
    );

    expect(state.winner).toBe(0);
    // Side 1 (the loser) must never have gotten to act after the winner was set.
    expect(events.some((e) => e.type === "move" && e.side === 1)).toBe(false);
    expect(state.sides[0].team[0]!.currentHp).toBe(150);
  });

  it("chooseReplacement falls back to the first legal replacement when teamIndex is illegal, skipping fainted mons", () => {
    const a1 = mon("A1", { currentHp: 0 });
    const a2 = mon("A2", { currentHp: 0 }); // fainted — must be skipped
    const a3 = mon("A3");
    const s = createBattle({ team: [a1, a2, a3], lead: 0 }, { team: team("B"), lead: 0 });
    s.forcedSwitch[0] = true;

    const { state, events } = chooseReplacement(s, 0, 99); // out-of-range teamIndex

    expect(state.sides[0].activeIndex).toBe(2);
    expect(state.forcedSwitch[0]).toBe(false);
    expect(events[0]).toMatchObject({ type: "switch", to: "A3" });
  });

  it("chooseReplacement no-ops when no legal replacement exists", () => {
    const a1 = mon("A1", { currentHp: 0 });
    const a2 = mon("A2", { currentHp: 0 });
    const a3 = mon("A3", { currentHp: 0 });
    const s = createBattle({ team: [a1, a2, a3], lead: 0 }, { team: team("B"), lead: 0 });
    s.forcedSwitch[0] = true;

    const { state, events } = chooseReplacement(s, 0, 1);

    expect(state.sides[0].activeIndex).toBe(0);
    expect(events).toEqual([]);
    expect(state.forcedSwitch[0]).toBe(true); // left as-is, no switch happened
  });

  it("applySwitch (via resolveTurn) is a no-op when switching to a fainted teammate", () => {
    const a1 = mon("A1");
    const a2 = mon("A2", { currentHp: 0 }); // fainted, illegal switch target
    const a3 = mon("A3");
    const s = createBattle({ team: [a1, a2, a3], lead: 0 }, { team: team("B"), lead: 0 });

    const { state, events } = resolveTurn(
      s,
      [{ kind: "switch", teamIndex: 1 }, { kind: "move", moveIndex: 0 }],
      createRng(3),
    );

    expect(state.sides[0].activeIndex).toBe(0);
    expect(events.some((e) => e.type === "switch" && e.side === 0)).toBe(false);
  });
});
