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
    expect(s.sides[0]!.team[0]!.currentHp).toBe(160 - 10);
  });
  it("poison removes maxHp/8", () => {
    const s = state(mon({ status: "poison" }), mon());
    applyEndOfTurn(s, [0, 1]);
    expect(s.sides[0]!.team[0]!.currentHp).toBe(160 - 20);
  });
  it("declares a winner if status KOs the last mon", () => {
    const s = state(mon({ status: "poison", currentHp: 5 }), mon());
    applyEndOfTurn(s, [0, 1]);
    expect(s.sides[0]!.team[0]!.currentHp).toBe(0);
    expect(s.winner).toBe(1);
  });
});
