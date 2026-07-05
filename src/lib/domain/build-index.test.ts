import { describe, expect, it } from "vitest";
import { buildPokemonIndex, type IndexSource } from "./build-index";

const source: IndexSource = {
  generations: [
    { generation: 1, species: [{ id: 25, slug: "pikachu" }, { id: 26, slug: "raichu" }] },
    { generation: 2, species: [{ id: 172, slug: "pichu" }, { id: 151, slug: "mew" }] },
  ],
  types: [
    { type: "electric", pokemon: [{ id: 25, slot: 1 }, { id: 26, slot: 1 }, { id: 172, slot: 1 }, { id: 10101, slot: 1 }] },
    { type: "psychic", pokemon: [{ id: 151, slot: 1 }] },
  ],
  chains: [{ chainId: 10, species: [{ id: 172, slug: "pichu" }, { id: 25, slug: "pikachu" }, { id: 26, slug: "raichu" }] }],
};

describe("buildPokemonIndex", () => {
  const index = buildPokemonIndex(source);

  it("returns one summary per species, ordered by id", () => {
    expect(index.map((p) => p.id)).toEqual([25, 26, 151, 172]);
  });
  it("assigns generation, display name and artwork url", () => {
    const pikachu = index.find((p) => p.id === 25);
    expect(pikachu).toMatchObject({
      slug: "pikachu",
      name: "Pikachu",
      generation: 1,
      imageUrl: expect.stringContaining("/official-artwork/25.png"),
    });
  });
  it("assigns types and ignores alternate-form ids not present as species", () => {
    expect(index.find((p) => p.id === 26)?.types).toEqual(["electric"]);
    expect(index.some((p) => p.id === 10101)).toBe(false);
  });
  it("links every chain member to the same chain", () => {
    const pichu = index.find((p) => p.id === 172);
    expect(pichu?.evolutionChainId).toBe(10);
    expect(pichu?.evolutionSlugs).toEqual(["pichu", "pikachu", "raichu"]);
  });
  it("falls back to a self-only chain when the species is in no chain", () => {
    const mew = index.find((p) => p.id === 151);
    expect(mew?.evolutionChainId).toBe(0);
    expect(mew?.evolutionSlugs).toEqual(["mew"]);
  });
});
