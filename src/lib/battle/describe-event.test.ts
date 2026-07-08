import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n/dictionary";
import { describeEvent } from "./describe-event";
import type { BattleEvent } from "./types";

const d = getDictionary("en");

describe("describeEvent", () => {
  it("narrates a move", () => {
    const event: BattleEvent = { type: "move", side: 0, pokemon: "Pikachu", move: "Thunderbolt" };
    expect(describeEvent(event, d)).toEqual([d.battle.log.used("Pikachu", "Thunderbolt")]);
  });

  it("narrates a super-effective crit as [crit, superEffective] in order", () => {
    const event: BattleEvent = {
      type: "damage",
      side: 1,
      pokemon: "Charizard",
      amount: 40,
      remainingHp: 60,
      effectiveness: "super",
      crit: true,
    };
    expect(describeEvent(event, d)).toEqual([d.battle.log.crit, d.battle.log.superEffective]);
  });

  it("narrates a normal, non-crit hit with no lines", () => {
    const event: BattleEvent = {
      type: "damage",
      side: 1,
      pokemon: "Snorlax",
      amount: 10,
      remainingHp: 90,
      effectiveness: "normal",
      crit: false,
    };
    expect(describeEvent(event, d)).toEqual([]);
  });

  it("narrates an immune hit", () => {
    const event: BattleEvent = {
      type: "damage",
      side: 1,
      pokemon: "Gengar",
      amount: 0,
      remainingHp: 100,
      effectiveness: "immune",
      crit: false,
    };
    expect(describeEvent(event, d)).toEqual([d.battle.log.immune("Gengar")]);
  });

  it("narrates a faint", () => {
    const event: BattleEvent = { type: "faint", side: 0, pokemon: "Magikarp" };
    expect(describeEvent(event, d)).toEqual([d.battle.log.faint("Magikarp")]);
  });

  it("narrates a turn timeout", () => {
    const event: BattleEvent = { type: "timeout", side: 1, pokemon: "Beartic" };
    expect(describeEvent(event, d)).toEqual([d.battle.log.timeout("Beartic")]);
  });

  it("narrates a paralysis status inflict", () => {
    const event: BattleEvent = { type: "status", side: 0, pokemon: "Raichu", status: "paralysis" };
    expect(describeEvent(event, d)).toEqual([
      d.battle.log.statusInflict("Raichu", "Paralyzed"),
    ]);
  });
});
