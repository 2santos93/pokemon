import { describe, expect, it } from "vitest";
import { chainToStages, flattenChain, idFromUrl, type ChainNode } from "./evolution";

const species = (id: number, name: string) => ({
  name,
  url: `https://pokeapi.co/api/v2/pokemon-species/${id}/`,
});

const pikachuChain: ChainNode = {
  species: species(172, "pichu"),
  evolves_to: [
    {
      species: species(25, "pikachu"),
      evolves_to: [{ species: species(26, "raichu"), evolves_to: [] }],
    },
  ],
};

const eeveeChain: ChainNode = {
  species: species(133, "eevee"),
  evolves_to: [
    { species: species(134, "vaporeon"), evolves_to: [] },
    { species: species(135, "jolteon"), evolves_to: [] },
  ],
};

describe("idFromUrl", () => {
  it("extracts the trailing id", () => {
    expect(idFromUrl("https://pokeapi.co/api/v2/pokemon-species/25/")).toBe(25);
    expect(idFromUrl("https://pokeapi.co/api/v2/evolution-chain/67")).toBe(67);
  });
});

describe("flattenChain", () => {
  it("returns every member of a linear chain", () => {
    expect(flattenChain(pikachuChain)).toEqual([
      { id: 172, slug: "pichu" },
      { id: 25, slug: "pikachu" },
      { id: 26, slug: "raichu" },
    ]);
  });
  it("returns every member of a branched chain", () => {
    expect(flattenChain(eeveeChain).map((s) => s.slug)).toEqual(["eevee", "vaporeon", "jolteon"]);
  });
});

describe("chainToStages", () => {
  it("groups a linear chain into one stage per depth", () => {
    expect(chainToStages(pikachuChain).map((stage) => stage.map((s) => s.slug))).toEqual([
      ["pichu"],
      ["pikachu"],
      ["raichu"],
    ]);
  });
  it("groups branches into the same stage", () => {
    expect(chainToStages(eeveeChain).map((stage) => stage.map((s) => s.slug))).toEqual([
      ["eevee"],
      ["vaporeon", "jolteon"],
    ]);
  });
});
