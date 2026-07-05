import type { SpeciesRef } from "./evolution";
import { formatPokemonName, officialArtworkUrl } from "./format";
import type { GenerationId, PokemonSummary, TypeSlug } from "./types";

export interface IndexSource {
  generations: { generation: GenerationId; species: SpeciesRef[] }[];
  types: { type: TypeSlug; pokemon: { id: number; slot: number }[] }[];
  chains: { chainId: number; species: SpeciesRef[] }[];
}

export function buildPokemonIndex(source: IndexSource): PokemonSummary[] {
  const byId = new Map<number, { slug: string; generation: GenerationId }>();
  for (const { generation, species } of source.generations) {
    for (const ref of species) byId.set(ref.id, { slug: ref.slug, generation });
  }

  const typesById = new Map<number, { type: TypeSlug; slot: number }[]>();
  for (const { type, pokemon } of source.types) {
    for (const { id, slot } of pokemon) {
      if (!byId.has(id)) continue; // alternate forms and mega/regional ids
      const entry = typesById.get(id) ?? [];
      entry.push({ type, slot });
      typesById.set(id, entry);
    }
  }

  const chainBySpeciesId = new Map<number, { chainId: number; slugs: string[] }>();
  for (const { chainId, species } of source.chains) {
    const slugs = species.map((s) => s.slug);
    for (const ref of species) chainBySpeciesId.set(ref.id, { chainId, slugs });
  }

  return [...byId.entries()]
    .sort(([a], [b]) => a - b)
    .map(([id, { slug, generation }]) => {
      const chain = chainBySpeciesId.get(id) ?? { chainId: 0, slugs: [slug] };
      const types = (typesById.get(id) ?? [])
        .sort((a, b) => a.slot - b.slot)
        .map((t) => t.type);
      return {
        id,
        slug,
        name: formatPokemonName(slug),
        generation,
        types,
        imageUrl: officialArtworkUrl(id),
        evolutionChainId: chain.chainId,
        evolutionSlugs: chain.slugs,
      };
    });
}
