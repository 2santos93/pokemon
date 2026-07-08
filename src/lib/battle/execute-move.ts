import { hasHealthyBench } from "./bench";
import { computeDamage } from "./damage";
import type { RNG } from "./rng";
import { effectivenessLabel } from "./type-chart";
import type { BattleEvent, BattleState, SideIndex } from "./types";

function activeOf(state: BattleState, side: SideIndex) {
  return state.sides[side].team[state.sides[side].activeIndex]!;
}

/** Mutates `state`. Resolves one move by `side`'s active Pokémon against the opponent. */
export function executeMove(
  state: BattleState,
  side: SideIndex,
  moveIndex: number,
  rng: RNG,
): BattleEvent[] {
  const events: BattleEvent[] = [];
  const attacker = activeOf(state, side);
  const foeSide = (side === 0 ? 1 : 0) as SideIndex;
  const defender = activeOf(state, foeSide);
  const slot = attacker.moves[moveIndex]!;
  if (!slot) return events;

  // asleep N turns → prevented N turns, wakes and acts on turn N+1
  if (attacker.status === "sleep") {
    if (attacker.sleepTurns > 0) {
      attacker.sleepTurns -= 1;
      events.push({ type: "statusPrevent", side, pokemon: attacker.name, status: "sleep" });
      return events;
    }
    attacker.status = "none";
    events.push({ type: "wake", side, pokemon: attacker.name });
  }

  // Paralysis: 25% full-turn stop.
  if (attacker.status === "paralysis" && rng.chance(25)) {
    events.push({ type: "statusPrevent", side, pokemon: attacker.name, status: "paralysis" });
    return events;
  }

  slot.pp = Math.max(0, slot.pp - 1);
  events.push({ type: "move", side, pokemon: attacker.name, move: slot.move.name });

  // Accuracy check (accuracy 0 = never miss).
  if (slot.move.accuracy > 0 && !rng.chance(slot.move.accuracy)) {
    events.push({ type: "miss", side, pokemon: attacker.name });
    return events;
  }

  if (slot.move.category === "status") {
    if (slot.move.inflicts && defender.status === "none") {
      defender.status = slot.move.inflicts;
      if (slot.move.inflicts === "sleep") defender.sleepTurns = 1 + rng.int(3); // 1..3
      events.push({ type: "status", side: foeSide, pokemon: defender.name, status: slot.move.inflicts });
    }
    return events;
  }

  const { damage, effectiveness, crit } = computeDamage({ attacker, defender, move: slot.move, rng });
  defender.currentHp = Math.max(0, defender.currentHp - damage);
  events.push({
    type: "damage",
    side: foeSide,
    pokemon: defender.name,
    amount: damage,
    remainingHp: defender.currentHp,
    effectiveness: effectivenessLabel(effectiveness),
    crit,
  });

  if (defender.currentHp === 0) {
    events.push({ type: "faint", side: foeSide, pokemon: defender.name });
    if (hasHealthyBench(state, foeSide)) {
      state.forcedSwitch[foeSide] = true;
      events.push({ type: "forcedSwitch", side: foeSide });
    } else {
      state.winner = side;
      events.push({ type: "win", side });
    }
  }
  return events;
}
