import type { RNG } from "./rng";
import { effectiveness } from "./type-chart";
import type { BattlePokemon, Move } from "./types";

const CRIT_CHANCE_PERCENT = 6.25; // ~1/16
const CRIT_MULTIPLIER = 1.5;

export function computeDamage(params: {
  attacker: BattlePokemon;
  defender: BattlePokemon;
  move: Move;
  rng: RNG;
}): { damage: number; effectiveness: number; crit: boolean } {
  const { attacker, defender, move, rng } = params;
  const eff = effectiveness(move.type, defender.types);
  if (eff === 0 || move.power === 0) return { damage: 0, effectiveness: eff, crit: false };

  const isPhysical = move.category === "physical";
  const atk = isPhysical ? attacker.stats.attack : attacker.stats["special-attack"];
  const def = isPhysical ? defender.stats.defense : defender.stats["special-defense"];

  const level = attacker.level;
  const base =
    Math.floor(Math.floor((Math.floor((2 * level) / 5) + 2) * move.power * atk) / def / 50) + 2;

  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  // STAB is floored on its own so type effectiveness scales an INTEGER base
  // (per-stage rounding, as the main-series games do). Without this separate
  // floor a neutral 61.5 truncates to 61 while its super-effective counterpart
  // is 123 — not exactly double. Flooring after STAB keeps the x2 / x0.5
  // effectiveness relationship exact.
  const baseWithStab = Math.floor(base * stab);
  const crit = rng.chance(CRIT_CHANCE_PERCENT);
  const critMod = crit ? CRIT_MULTIPLIER : 1;
  const burn = attacker.status === "burn" && isPhysical ? 0.5 : 1;
  const randomFactor = (85 + rng.int(16)) / 100; // 0.85..1.00

  const damage = Math.max(1, Math.floor(baseWithStab * eff * critMod * burn * randomFactor));
  return { damage, effectiveness: eff, crit };
}
