import { isTypeSlug } from "@/lib/domain/types";
import type { MoveResponse } from "@/lib/pokeapi/types";
import type { RNG } from "./rng";
import type { Move, MoveCategory, MoveSlot, StatusCondition } from "./types";

const AILMENTS: Record<string, Exclude<StatusCondition, "none">> = {
  paralysis: "paralysis",
  burn: "burn",
  poison: "poison",
  sleep: "sleep",
};

export function mapAilment(name: string): Exclude<StatusCondition, "none"> | null {
  return AILMENTS[name] ?? null;
}

function toCategory(name: string): MoveCategory | null {
  return name === "physical" || name === "special" || name === "status" ? name : null;
}

export function toMove(res: MoveResponse): Move | null {
  if (!isTypeSlug(res.type.name)) return null;
  const category = toCategory(res.damage_class.name);
  if (category === null) return null;

  const move: Move = {
    id: res.id,
    name: res.name,
    type: res.type.name,
    category,
    power: res.power ?? 0,
    accuracy: res.accuracy ?? 0, // 0 = never misses (engine convention)
    pp: res.pp ?? 5,
    priority: res.priority,
  };

  if (category === "status") {
    const inflicts = mapAilment(res.meta?.ailment.name ?? "none");
    if (inflicts === null) return null; // status move we can't model
    move.inflicts = inflicts;
    return move;
  }

  if (move.power <= 0) return null; // damaging move with no usable power
  return move;
}

export function pickTeamIds(rng: RNG, count: number, maxId: number): number[] {
  const chosen = new Set<number>();
  while (chosen.size < count && chosen.size < maxId) {
    chosen.add(1 + rng.int(maxId));
  }
  return [...chosen];
}

export const STRUGGLE: Move = {
  id: 165,
  name: "struggle",
  type: "normal",
  category: "physical",
  power: 50,
  accuracy: 0, // never misses
  pp: 1,
  priority: 0,
};

function isDamaging(move: Move): boolean {
  return move.category !== "status" && move.power > 0;
}

function shuffle<T>(items: T[], rng: RNG): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }
  return copy;
}

export function selectMoves(candidates: Move[], rng: RNG): MoveSlot[] {
  // Dedupe by id, then shuffle for variety.
  const unique = [...new Map(candidates.map((m) => [m.id, m])).values()];
  const shuffled = shuffle(unique, rng);

  const picked: Move[] = shuffled.slice(0, 4);
  if (!picked.some(isDamaging)) {
    // Guarantee a damaging option: swap in a damaging candidate, else STRUGGLE.
    const damaging = shuffled.find(isDamaging) ?? STRUGGLE;
    if (picked.length < 4) picked.push(damaging);
    else picked[picked.length - 1] = damaging;
  }
  if (picked.length === 0) picked.push(STRUGGLE);

  return picked.map((move) => ({ move, pp: move.pp }));
}
