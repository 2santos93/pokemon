import { describe, expect, it } from "vitest";
import { effectiveness, effectivenessLabel } from "./type-chart";

describe("effectiveness", () => {
  it("is 1 for neutral matchups", () => {
    expect(effectiveness("normal", ["normal"])).toBe(1);
  });
  it("doubles for super-effective single type", () => {
    expect(effectiveness("water", ["fire"])).toBe(2);
  });
  it("multiplies across dual types (4x)", () => {
    expect(effectiveness("rock", ["fire", "flying"])).toBe(4);
  });
  it("is 0 for immunities", () => {
    expect(effectiveness("normal", ["ghost"])).toBe(0);
    expect(effectiveness("electric", ["ground"])).toBe(0);
  });
  it("stacks resistances (0.25x)", () => {
    expect(effectiveness("grass", ["grass", "dragon"])).toBe(0.25);
  });
});

describe("effectivenessLabel", () => {
  it("labels buckets", () => {
    expect(effectivenessLabel(2)).toBe("super");
    expect(effectivenessLabel(1)).toBe("normal");
    expect(effectivenessLabel(0.5)).toBe("notvery");
    expect(effectivenessLabel(0)).toBe("immune");
  });
});
