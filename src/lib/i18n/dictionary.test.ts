import { describe, expect, it } from "vitest";
import { TYPE_SLUGS } from "@/lib/domain/types";
import { getDictionary } from "./dictionary";

describe("dictionaries", () => {
  it.each(["es", "en"] as const)("%s covers all 18 types and 9 generations", (locale) => {
    const d = getDictionary(locale);
    for (const type of TYPE_SLUGS) expect(d.types[type]).toBeTruthy();
    for (const gen of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) expect(d.generations[gen]).toBeTruthy();
  });
  it("pluralizes result counts", () => {
    expect(getDictionary("es").filters.results(1)).toBe("1 Pokémon");
    expect(getDictionary("en").filters.results(2)).toBe("2 Pokémon");
  });
});
