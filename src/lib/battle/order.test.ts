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
