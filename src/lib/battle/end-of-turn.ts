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
    if (!mon || mon.currentHp <= 0) continue;

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
