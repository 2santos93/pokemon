import { describe, expect, it } from "vitest";
import { createRng } from "./rng";
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
});
