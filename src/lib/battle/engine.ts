import { applyEndOfTurn } from "./end-of-turn";
import { executeMove } from "./execute-move";
import { orderActions } from "./order";
import type { RNG } from "./rng";
import type {
  BattleEvent,
  BattlePokemon,
  BattleState,
  SideIndex,
  TurnAction,
  TurnInput,
  TurnResult,
} from "./types";

export function createBattle(
  a: { team: BattlePokemon[]; lead: number },
  b: { team: BattlePokemon[]; lead: number },
): BattleState {
  return {
    sides: [
      { team: a.team, activeIndex: a.lead },
      { team: b.team, activeIndex: b.lead },
    ],
    turn: 1,
    forcedSwitch: [false, false],
    winner: null,
  };
}

/** Mutates `state`. No-ops on an illegal switch (bad index, active slot, or fainted target). */
function applySwitch(state: BattleState, side: SideIndex, teamIndex: number): BattleEvent[] {
  const s = state.sides[side]!;
  const target = s.team[teamIndex];
  if (teamIndex < 0 || teamIndex >= s.team.length || teamIndex === s.activeIndex || !target || target.currentHp <= 0) {
    return [];
  }
  const from = s.team[s.activeIndex]!.name;
  s.activeIndex = teamIndex;
  return [{ type: "switch", side, from, to: target.name }];
}

/** Callers should validate against `legalActions()` first — the guards here are defense-in-depth, not a substitute. */
export function resolveTurn(
  state: BattleState,
  actions: [TurnInput, TurnInput],
  rng: RNG,
): TurnResult {
  const next: BattleState = structuredClone(state);
  const events: BattleEvent[] = [];
  const order = orderActions(next, actions, rng);

  for (const side of order) {
    if (next.winner !== null) break;
    if (next.forcedSwitch[side]) continue; // active already fainted; can't act
    const action = actions[side];
    if (action === null) continue;
    if (action.kind === "switch") {
      events.push(...applySwitch(next, side, action.teamIndex));
    } else {
      events.push(...executeMove(next, side, action.moveIndex, rng));
    }
  }

  if (next.winner === null) events.push(...applyEndOfTurn(next, order));
  next.turn += 1;
  return { state: next, events };
}

/** Callers should validate `teamIndex` against `legalActions()` first — the fallback below is defense-in-depth, not a substitute. */
export function chooseReplacement(
  state: BattleState,
  side: SideIndex,
  teamIndex: number,
): TurnResult {
  const next: BattleState = structuredClone(state);
  const s = next.sides[side]!;
  const isLegal = (i: number) => i >= 0 && i < s.team.length && i !== s.activeIndex && s.team[i]!.currentHp > 0;

  const resolvedIndex = isLegal(teamIndex) ? teamIndex : s.team.findIndex((_, i) => isLegal(i));
  if (resolvedIndex === -1) {
    return { state: next, events: [] };
  }

  const events = applySwitch(next, side, resolvedIndex);
  if (events.length > 0) next.forcedSwitch[side] = false;
  return { state: next, events };
}

export function legalActions(state: BattleState, side: SideIndex): TurnAction[] {
  const s = state.sides[side]!;
  const switches: TurnAction[] = s.team
    .map((m, i) => ({ m, i }))
    .filter(({ m, i }) => i !== s.activeIndex && m.currentHp > 0)
    .map(({ i }) => ({ kind: "switch", teamIndex: i }));

  if (state.forcedSwitch[side]) return switches;

  const active = s.team[s.activeIndex]!;
  const moves: TurnAction[] = active.moves
    .map((slot, i) => ({ slot, i }))
    .filter(({ slot }) => slot.pp > 0)
    .map(({ i }) => ({ kind: "move", moveIndex: i }));

  return [...moves, ...switches];
}
