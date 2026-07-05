import { isGenerationId, isTypeSlug, type PokedexFilters } from "./types";

export function parseFilters(params: URLSearchParams): PokedexFilters {
  const query = params.get("q") ?? "";
  const types = (params.get("types") ?? "").split(",").filter(isTypeSlug);
  const generations = (params.get("gens") ?? "").split(",").map(Number).filter(isGenerationId);
  return { query, types, generations };
}

export function serializeFilters(filters: PokedexFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query !== "") params.set("q", filters.query);
  if (filters.types.length > 0) params.set("types", filters.types.join(","));
  if (filters.generations.length > 0) params.set("gens", filters.generations.join(","));
  return params;
}
