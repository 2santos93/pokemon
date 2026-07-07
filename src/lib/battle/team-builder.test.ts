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
