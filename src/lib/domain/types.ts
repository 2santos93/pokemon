export const TYPE_SLUGS = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
] as const;

export type TypeSlug = (typeof TYPE_SLUGS)[number];

export const GENERATION_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export type GenerationId = (typeof GENERATION_IDS)[number];

export function isTypeSlug(value: string): value is TypeSlug {
  return (TYPE_SLUGS as readonly string[]).includes(value);
}

export function isGenerationId(value: number): value is GenerationId {
  return (GENERATION_IDS as readonly number[]).includes(value);
}

/** Lightweight list-index entry: everything the list page needs to render, filter and search. */
export interface PokemonSummary {
  id: number;
  slug: string;
  name: string;
  generation: GenerationId;
  types: TypeSlug[];
  imageUrl: string;
  evolutionChainId: number;
  /** Slugs of every species in this Pokémon's evolution chain, including itself. */
  evolutionSlugs: string[];
}

export interface PokedexFilters {
  query: string;
  types: TypeSlug[];
  generations: GenerationId[];
}

export type Locale = "es" | "en";

export const STAT_SLUGS = [
  "hp",
  "attack",
  "defense",
  "special-attack",
  "special-defense",
  "speed",
] as const;

export type StatSlug = (typeof STAT_SLUGS)[number];

export interface EvolutionStageMember {
  id: number;
  slug: string;
  name: string;
  imageUrl: string;
}

export interface PokemonDetail {
  id: number;
  slug: string;
  name: string;
  generation: GenerationId;
  types: TypeSlug[];
  imageUrl: string;
  stats: { stat: StatSlug; value: number }[];
  heightMeters: number;
  weightKilograms: number;
  abilities: { slug: string; hidden: boolean }[];
  genus: Record<Locale, string>;
  flavorText: Record<Locale, string>;
  evolutionStages: EvolutionStageMember[][];
  maxId: number;
}
