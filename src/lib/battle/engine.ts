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

/**
 * Mutates `state`. No-ops (returns `[]`, mutates nothing) if `teamIndex` is out of
 * range, targets the currently active slot, or targets a fainted Pokémon — this
 * guards against illegal switches that would otherwise crash or leave a fainted
 * Pokémon active.
 */
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

/**
 * Callers (the room layer) should still validate actions against `legalActions()`
 * before calling this; the switch guards here are defense-in-depth against
 * illegal/untrusted input, not a substitute for that validation.
 */
export function resolveTurn(
  state: BattleState,
  actions: [TurnAction, TurnAction],
  rng: RNG,
): TurnResult {
  const next: BattleState = structuredClone(state);
  const events: BattleEvent[] = [];
  const order = orderActions(next, actions, rng);

  for (const side of order) {
    if (next.winner !== null) break;
    // A side whose active fainted earlier this turn can't act with a move.
    if (next.forcedSwitch[side]) continue;
    const action = actions[side];
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

/**
 * Callers (the room layer) should still validate `teamIndex` against
 * `legalActions()` before calling this; the fallback below is defense-in-depth
 * against illegal/untrusted input, not a substitute for that validation.
 */
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
