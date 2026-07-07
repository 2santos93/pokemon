import { isTypeSlug } from "@/lib/domain/types";
import type { MoveResponse } from "@/lib/pokeapi/types";
import type { Move, MoveCategory, StatusCondition } from "./types";

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
