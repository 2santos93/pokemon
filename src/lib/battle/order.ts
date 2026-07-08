import type { RNG } from "./rng";
import type { BattlePokemon, BattleState, SideIndex, TurnInput } from "./types";

function effectiveSpeed(mon: BattlePokemon): number {
  return mon.status === "paralysis" ? Math.floor(mon.stats.speed * 0.5) : mon.stats.speed;
}

function movePriority(action: TurnInput, mon: BattlePokemon): number {
  // A timed-out side (null) does nothing; sort it last — its position is moot.
  if (action === null) return -Infinity;
  return action.kind === "switch" ? 6 : mon.moves[action.moveIndex]?.move.priority ?? 0;
}

export function orderActions(
  state: BattleState,
  actions: [TurnInput, TurnInput],
  rng: RNG,
): SideIndex[] {
  const active0 = state.sides[0].team[state.sides[0].activeIndex]!;
  const active1 = state.sides[1].team[state.sides[1].activeIndex]!;
  const p0 = movePriority(actions[0], active0);
  const p1 = movePriority(actions[1], active1);
  if (p0 !== p1) return p0 > p1 ? [0, 1] : [1, 0];

  const s0 = effectiveSpeed(active0);
  const s1 = effectiveSpeed(active1);
  if (s0 !== s1) return s0 > s1 ? [0, 1] : [1, 0];

  return rng.next() < 0.5 ? [0, 1] : [1, 0];
}
