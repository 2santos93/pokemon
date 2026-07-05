import { describe, expect, it } from "vitest";
import type { PokemonSummary } from "./types";
import { filterPokemon, normalizeQuery } from "./filter";

function summary(partial: Partial<PokemonSummary> & Pick<PokemonSummary, "id" | "slug">): PokemonSummary {
  return {
    name: partial.slug,
    generation: 1,
    types: ["normal"],
    imageUrl: "",
    evolutionChainId: 0,
    evolutionSlugs: [partial.slug],
    ...partial,
  };
}

const pichu = summary({ id: 172, slug: "pichu", generation: 2, types: ["electric"], evolutionChainId: 10, evolutionSlugs: ["pichu", "pikachu", "raichu"] });
const pikachu = summary({ id: 25, slug: "pikachu", generation: 1, types: ["electric"], evolutionChainId: 10, evolutionSlugs: ["pichu", "pikachu", "raichu"] });
const raichu = summary({ id: 26, slug: "raichu", generation: 1, types: ["electric"], evolutionChainId: 10, evolutionSlugs: ["pichu", "pikachu", "raichu"] });
const bulbasaur = summary({ id: 1, slug: "bulbasaur", generation: 1, types: ["grass", "poison"], evolutionChainId: 1, evolutionSlugs: ["bulbasaur", "ivysaur", "venusaur"] });
const flareon = summary({ id: 136, slug: "flareon", generation: 1, types: ["fire"], evolutionChainId: 67, evolutionSlugs: ["eevee", "vaporeon", "jolteon", "flareon"] });
const all = [bulbasaur, pikachu, raichu, flareon, pichu];

describe("normalizeQuery", () => {
  it("lowercases, trims and strips diacritics", () => {
    expect(normalizeQuery("  PikáChu ")).toBe("pikachu");
  });
});

describe("filterPokemon", () => {
  it("returns everything (ordered by id) when filters are empty", () => {
    const result = filterPokemon(all, { query: "", types: [], generations: [] });
    expect(result.map((p) => p.id)).toEqual([1, 25, 26, 136, 172]);
  });
  it("matches by own name substring", () => {
    const result = filterPokemon(all, { query: "bulba", types: [], generations: [] });
    expect(result.map((p) => p.slug)).toEqual(["bulbasaur"]);
  });
  it("includes the whole evolution chain when the query names a member", () => {
    const result = filterPokemon(all, { query: "pikachu", types: [], generations: [] });
    expect(result.map((p) => p.slug)).toEqual(["pikachu", "raichu", "pichu"]);
  });
  it("matches chain members by substring too", () => {
    const result = filterPokemon(all, { query: "eevee", types: [], generations: [] });
    expect(result.map((p) => p.slug)).toEqual(["flareon"]);
  });
  it("filters by type (OR within the filter)", () => {
    const result = filterPokemon(all, { query: "", types: ["grass", "fire"], generations: [] });
    expect(result.map((p) => p.slug)).toEqual(["bulbasaur", "flareon"]);
  });
  it("filters by generation", () => {
    const result = filterPokemon(all, { query: "", types: [], generations: [2] });
    expect(result.map((p) => p.slug)).toEqual(["pichu"]);
  });
  it("combines query, type and generation with AND", () => {
    const result = filterPokemon(all, { query: "pika", types: ["electric"], generations: [1] });
    expect(result.map((p) => p.slug)).toEqual(["pikachu", "raichu"]);
  });
});
