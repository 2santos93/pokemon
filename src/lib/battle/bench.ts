import type { BattleState, SideIndex } from "./types";

export function hasHealthyBench(state: BattleState, side: SideIndex): boolean {
  return state.sides[side].team.some((m, i) => i !== state.sides[side].activeIndex && m.currentHp > 0);
}
