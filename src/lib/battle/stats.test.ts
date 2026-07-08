import { describe, expect, it } from "vitest";
import { computeStats } from "./stats";

const charizardBase = {
  hp: 78, attack: 84, defense: 78,
  "special-attack": 109, "special-defense": 85, speed: 100,
} as const;

describe("computeStats", () => {
  it("computes HP with the +level+10 formula", () => {
    expect(computeStats(charizardBase, 50).hp).toBe(153);
  });
  it("computes non-HP stats with the +5 formula", () => {
    expect(computeStats(charizardBase, 50).speed).toBe(120);
  });
});
