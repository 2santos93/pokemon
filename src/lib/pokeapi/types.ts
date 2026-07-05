import type { ChainNode } from "@/lib/domain/evolution";

export interface NamedApiResource {
  name: string;
  url: string;
}

export interface ResourceList {
  count: number;
  results: NamedApiResource[];
}

export interface LocalizedName {
  name: string;
  language: NamedApiResource;
}

export interface GenerationResponse {
  id: number;
  pokemon_species: NamedApiResource[];
}

export interface TypeResponse {
  id: number;
  name: string;
  pokemon: { slot: number; pokemon: NamedApiResource }[];
}

export interface EvolutionChainResponse {
  id: number;
  chain: ChainNode;
}

export interface PokemonResponse {
  id: number;
  name: string;
  height: number;
  weight: number;
  stats: { base_stat: number; stat: NamedApiResource }[];
  types: { slot: number; type: NamedApiResource }[];
  abilities: { ability: NamedApiResource; is_hidden: boolean }[];
  sprites: { other?: { "official-artwork"?: { front_default: string | null } } };
}

export interface SpeciesResponse {
  id: number;
  name: string;
  names: LocalizedName[];
  genera: { genus: string; language: NamedApiResource }[];
  flavor_text_entries: { flavor_text: string; language: NamedApiResource }[];
  generation: NamedApiResource;
  evolution_chain: { url: string };
}
