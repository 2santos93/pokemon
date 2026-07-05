import type { PokedexFilters, PokemonSummary } from "./types";

export function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function matchesQuery(pokemon: PokemonSummary, query: string): boolean {
  if (query === "") return true;
  if (pokemon.slug.includes(query)) return true;
  return pokemon.evolutionSlugs.some((slug) => slug.includes(query));
}

function matchesTypes(pokemon: PokemonSummary, types: PokedexFilters["types"]): boolean {
  return types.length === 0 || types.some((type) => pokemon.types.includes(type));
}

function matchesGenerations(
  pokemon: PokemonSummary,
  generations: PokedexFilters["generations"],
): boolean {
  return generations.length === 0 || generations.includes(pokemon.generation);
}

export function filterPokemon(list: PokemonSummary[], filters: PokedexFilters): PokemonSummary[] {
  const query = normalizeQuery(filters.query);
  return list.filter(
    (pokemon) =>
      matchesQuery(pokemon, query) &&
      matchesTypes(pokemon, filters.types) &&
      matchesGenerations(pokemon, filters.generations),
  );
}
