import { describe, expect, it } from "vitest";
import { parseFilters, serializeFilters } from "./url-state";

describe("parseFilters", () => {
  it("parses query, types and generations", () => {
    const params = new URLSearchParams("q=pika&types=fire,water&gens=1,3");
    expect(parseFilters(params)).toEqual({
      query: "pika",
      types: ["fire", "water"],
      generations: [1, 3],
    });
  });
  it("returns empty filters for empty params", () => {
    expect(parseFilters(new URLSearchParams())).toEqual({ query: "", types: [], generations: [] });
  });
  it("drops invalid types and generations", () => {
    const params = new URLSearchParams("types=fire,lava&gens=0,2,99");
    expect(parseFilters(params)).toEqual({ query: "", types: ["fire"], generations: [2] });
  });
});

describe("serializeFilters", () => {
  it("serializes only non-empty parts", () => {
    const params = serializeFilters({ query: "pika", types: ["fire"], generations: [] });
    expect(params.toString()).toBe("q=pika&types=fire");
  });
  it("round-trips", () => {
    const filters = { query: "mew", types: ["psychic" as const], generations: [1 as const] };
    expect(parseFilters(serializeFilters(filters))).toEqual(filters);
  });
  it("serializes empty filters to an empty string", () => {
    expect(serializeFilters({ query: "", types: [], generations: [] }).toString()).toBe("");
  });
});
