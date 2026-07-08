import { describe, expect, it } from "vitest";
import { formatPokemonName, officialArtworkUrl, toSpriteCdn } from "./format";

describe("formatPokemonName", () => {
  it("capitalizes simple slugs", () => {
    expect(formatPokemonName("pikachu")).toBe("Pikachu");
  });
  it("capitalizes each hyphenated word", () => {
    expect(formatPokemonName("great-tusk")).toBe("Great Tusk");
    expect(formatPokemonName("iron-valiant")).toBe("Iron Valiant");
  });
  it("uses overrides for names with punctuation or symbols", () => {
    expect(formatPokemonName("mr-mime")).toBe("Mr. Mime");
    expect(formatPokemonName("farfetchd")).toBe("Farfetch'd");
    expect(formatPokemonName("ho-oh")).toBe("Ho-Oh");
    expect(formatPokemonName("nidoran-f")).toBe("Nidoran♀");
    expect(formatPokemonName("type-null")).toBe("Type: Null");
  });
});

describe("officialArtworkUrl", () => {
  it("builds the sprites CDN url from the id", () => {
    expect(officialArtworkUrl(25)).toBe(
      "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/25.png",
    );
  });
});

describe("toSpriteCdn", () => {
  it("rewrites a raw.githubusercontent sprite url to the jsDelivr mirror", () => {
    expect(
      toSpriteCdn("https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/614.png"),
    ).toBe("https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/614.png");
  });
  it("rewrites back sprites too", () => {
    expect(
      toSpriteCdn("https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/643.png"),
    ).toBe("https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/back/643.png");
  });
  it("leaves unrelated urls untouched", () => {
    expect(toSpriteCdn("https://example.com/foo.png")).toBe("https://example.com/foo.png");
  });
});
