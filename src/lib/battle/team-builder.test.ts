import { describe, expect, it } from "vitest";
import type { MoveResponse } from "@/lib/pokeapi/types";
import { createRng } from "./rng";
import { mapAilment, toMove, pickTeamIds } from "./team-builder";

function moveRes(partial: Partial<MoveResponse> = {}): MoveResponse {
  return {
    id: 1, name: "tackle", power: 40, accuracy: 100, pp: 35, priority: 0,
    type: { name: "normal", url: "" },
    damage_class: { name: "physical", url: "" },
    meta: { ailment: { name: "none", url: "" } },
    ...partial,
  };
}

describe("mapAilment", () => {
  it("maps the four supported ailments", () => {
    expect(mapAilment("paralysis")).toBe("paralysis");
    expect(mapAilment("burn")).toBe("burn");
    expect(mapAilment("poison")).toBe("poison");
    expect(mapAilment("sleep")).toBe("sleep");
  });
  it("returns null for unsupported ailments", () => {
    expect(mapAilment("freeze")).toBeNull();
    expect(mapAilment("none")).toBeNull();
  });
});

describe("toMove", () => {
  it("maps a damaging move", () => {
    const m = toMove(moveRes({ name: "flamethrower", type: { name: "fire", url: "" }, damage_class: { name: "special", url: "" }, power: 90 }));
    expect(m).toEqual({ id: 1, name: "flamethrower", type: "fire", category: "special", power: 90, accuracy: 100, pp: 35, priority: 0 });
  });
  it("maps a status move with a supported ailment", () => {
    const m = toMove(moveRes({ name: "thunder-wave", type: { name: "electric", url: "" }, damage_class: { name: "status", url: "" }, power: null, meta: { ailment: { name: "paralysis", url: "" } } }));
    expect(m?.category).toBe("status");
    expect(m?.inflicts).toBe("paralysis");
    expect(m?.power).toBe(0);
  });
  it("drops moves with a non-standard type", () => {
    expect(toMove(moveRes({ type: { name: "shadow", url: "" } }))).toBeNull();
  });
  it("drops damaging moves with no power", () => {
    expect(toMove(moveRes({ power: null }))).toBeNull();
  });
  it("drops status moves whose ailment is unsupported", () => {
    expect(toMove(moveRes({ damage_class: { name: "status", url: "" }, power: null, meta: { ailment: { name: "confusion", url: "" } } }))).toBeNull();
  });
  it("treats null accuracy as never-miss (0)", () => {
    expect(toMove(moveRes({ accuracy: null }))?.accuracy).toBe(0);
  });
});

describe("pickTeamIds", () => {
  it("returns the requested count of distinct ids within range", () => {
    const ids = pickTeamIds(createRng(5), 3, 1025);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) {
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(1025);
    }
  });
  it("is deterministic for a seed", () => {
    expect(pickTeamIds(createRng(9), 3, 1025)).toEqual(pickTeamIds(createRng(9), 3, 1025));
  });
});

import { selectMoves, STRUGGLE, buildBattlePokemon } from "./team-builder";
import type { Move } from "./types";
import type { PokemonResponse } from "@/lib/pokeapi/types";

function dmg(id: number, name: string): Move {
  return { id, name, type: "normal", category: "physical", power: 40, accuracy: 100, pp: 20, priority: 0 };
}
function status(id: number, name: string): Move {
  return { id, name, type: "electric", category: "status", power: 0, accuracy: 100, pp: 20, priority: 0, inflicts: "paralysis" };
}

describe("selectMoves", () => {
  it("returns at most 4 slots with starting pp", () => {
    const slots = selectMoves([dmg(1, "a"), dmg(2, "b"), dmg(3, "c"), dmg(4, "d"), dmg(5, "e")], createRng(1));
    expect(slots).toHaveLength(4);
    expect(slots.every((s) => s.pp === s.move.pp)).toBe(true);
    expect(new Set(slots.map((s) => s.move.id)).size).toBe(4);
  });
  it("always includes at least one damaging move", () => {
    const slots = selectMoves([status(1, "a"), status(2, "b"), status(3, "c"), status(4, "d")], createRng(1));
    expect(slots.some((s) => s.move.category !== "status" && s.move.power > 0)).toBe(true);
  });
  it("uses STRUGGLE as the damaging fallback when there are no damaging candidates", () => {
    const slots = selectMoves([status(1, "a")], createRng(1));
    expect(slots.some((s) => s.move.id === STRUGGLE.id)).toBe(true);
  });
  it("returns at least one slot even with no candidates", () => {
    const slots = selectMoves([], createRng(1));
    expect(slots).toHaveLength(1);
    expect(slots[0]!.move.id).toBe(STRUGGLE.id);
  });
  it("swaps in a real damaging move when none is in the first four", () => {
    const candidates = [status(1, "a"), status(2, "b"), status(3, "c"), status(4, "d"), status(5, "e"), dmg(9, "real")];
    const slots = selectMoves(candidates, createRng(1));
    const damaging = slots.filter((s) => s.move.category !== "status" && s.move.power > 0);
    expect(damaging.length).toBeGreaterThanOrEqual(1);
    expect(damaging.some((s) => s.move.id !== STRUGGLE.id)).toBe(true);
  });
});

function charizardResponse(): PokemonResponse {
  return {
    id: 6, name: "charizard", height: 17, weight: 905,
    stats: [
      { base_stat: 78, stat: { name: "hp", url: "" } },
      { base_stat: 84, stat: { name: "attack", url: "" } },
      { base_stat: 78, stat: { name: "defense", url: "" } },
      { base_stat: 109, stat: { name: "special-attack", url: "" } },
      { base_stat: 85, stat: { name: "special-defense", url: "" } },
      { base_stat: 100, stat: { name: "speed", url: "" } },
    ],
    types: [
      { slot: 1, type: { name: "fire", url: "" } },
      { slot: 2, type: { name: "flying", url: "" } },
    ],
    abilities: [],
    sprites: { front_default: "front.png", back_default: "back.png" },
    moves: [],
  };
}

describe("buildBattlePokemon", () => {
  it("builds a level-50 battler with computed stats and full HP", () => {
    const mon = buildBattlePokemon(charizardResponse(), [dmg(1, "ember")], createRng(1));
    expect(mon.level).toBe(50);
    expect(mon.name).toBe("Charizard");
    expect(mon.types).toEqual(["fire", "flying"]);
    expect(mon.maxHp).toBe(153);
    expect(mon.currentHp).toBe(153);
    expect(mon.stats.speed).toBe(120);
    expect(mon.moves.length).toBeGreaterThanOrEqual(1);
    expect(mon.status).toBe("none");
  });
  it("uses pixel sprites and falls back to artwork when null", () => {
    const withSprites = buildBattlePokemon(charizardResponse(), [dmg(1, "ember")], createRng(1));
    expect(withSprites.frontSprite).toBe("front.png");
    expect(withSprites.backSprite).toBe("back.png");
    const noSprites = charizardResponse();
    noSprites.sprites = { front_default: null, back_default: null };
    const built = buildBattlePokemon(noSprites, [dmg(1, "ember")], createRng(1));
    expect(built.frontSprite).toContain("6.png");
    expect(built.backSprite).toContain("6.png");
  });
});
