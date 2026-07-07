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

function applySwitch(state: BattleState, side: SideIndex, teamIndex: number): BattleEvent[] {
  const s = state.sides[side]!;
  const from = s.team[s.activeIndex]!.name;
  s.activeIndex = teamIndex;
  return [{ type: "switch", side, from, to: s.team[teamIndex]!.name }];
}

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

export function chooseReplacement(
  state: BattleState,
  side: SideIndex,
  teamIndex: number,
): TurnResult {
  const next: BattleState = structuredClone(state);
  const events = applySwitch(next, side, teamIndex);
  next.forcedSwitch[side] = false;
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
