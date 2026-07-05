import type {
  EvolutionChainResponse,
  GenerationResponse,
  PokemonResponse,
  ResourceList,
  SpeciesResponse,
  TypeResponse,
} from "./types";

const BASE_URL = "https://pokeapi.co/api/v2";
const REVALIDATE_SECONDS = 60 * 60 * 24;

export class PokeApiError extends Error {
  constructor(
    readonly status: number,
    path: string,
  ) {
    super(`PokéAPI request failed with status ${status}: ${path}`);
    this.name = "PokeApiError";
  }
}

async function fetchOnce<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!response.ok) throw new PokeApiError(response.status, path);
  return (await response.json()) as T;
}

/** Retries once on network errors or 5xx responses; a 404 is a valid answer and is never retried. */
async function fetchJson<T>(path: string): Promise<T> {
  try {
    return await fetchOnce<T>(path);
  } catch (error) {
    if (error instanceof PokeApiError && error.status < 500) throw error;
    return fetchOnce<T>(path);
  }
}

export const getGeneration = (id: number): Promise<GenerationResponse> =>
  fetchJson(`/generation/${id}`);

export const getType = (name: string): Promise<TypeResponse> => fetchJson(`/type/${name}`);

export const listEvolutionChains = (): Promise<ResourceList> =>
  fetchJson(`/evolution-chain?limit=1000`);

export const getEvolutionChain = (id: number): Promise<EvolutionChainResponse> =>
  fetchJson(`/evolution-chain/${id}`);

export const getPokemon = (id: number): Promise<PokemonResponse> => fetchJson(`/pokemon/${id}`);

export const getSpecies = (id: number): Promise<SpeciesResponse> =>
  fetchJson(`/pokemon-species/${id}`);
