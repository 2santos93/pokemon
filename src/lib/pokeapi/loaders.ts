import { unstable_cache } from "next/cache";
import { buildPokemonIndex } from "@/lib/domain/build-index";
import { chainToStages, flattenChain, idFromUrl } from "@/lib/domain/evolution";
import { formatPokemonName, officialArtworkUrl } from "@/lib/domain/format";
import {
  GENERATION_IDS,
  STAT_SLUGS,
  TYPE_SLUGS,
  isGenerationId,
  isTypeSlug,
  type GenerationId,
  type Locale,
  type PokemonSummary,
  type StatSlug,
  type TypeSlug,
} from "@/lib/domain/types";
import { inBatches } from "./batch";
import {
  PokeApiError,
  getEvolutionChain,
  getGeneration,
  getPokemon,
  getSpecies,
  getType,
  listEvolutionChains,
} from "./client";

const CHAIN_BATCH_SIZE = 25;

async function loadPokemonIndex(): Promise<PokemonSummary[]> {
  const [generations, types, chainList] = await Promise.all([
    Promise.all(
      GENERATION_IDS.map(async (generation) => {
        const response = await getGeneration(generation);
        return {
          generation,
          species: response.pokemon_species.map((s) => ({ id: idFromUrl(s.url), slug: s.name })),
        };
      }),
    ),
    Promise.all(
      TYPE_SLUGS.map(async (type) => {
        const response = await getType(type);
        return {
          type,
          pokemon: response.pokemon.map((entry) => ({
            id: idFromUrl(entry.pokemon.url),
            slot: entry.slot,
          })),
        };
      }),
    ),
    listEvolutionChains(),
  ]);

  const chains = await inBatches(chainList.results, CHAIN_BATCH_SIZE, async (ref) => {
    const response = await getEvolutionChain(idFromUrl(ref.url));
    return { chainId: response.id, species: flattenChain(response.chain) };
  });

  return buildPokemonIndex({ generations, types, chains });
}

export const getPokemonIndex = unstable_cache(loadPokemonIndex, ["pokemon-index"], {
  revalidate: 60 * 60 * 24,
});

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

function pickLocalized(entries: { text: string; language: string }[], locale: Locale): string {
  const exact = entries.find((entry) => entry.language === locale);
  if (exact) return exact.text;
  return entries.find((entry) => entry.language === "en")?.text ?? "";
}

function isStatSlug(value: string): value is StatSlug {
  return (STAT_SLUGS as readonly string[]).includes(value);
}

export async function getPokemonDetail(id: number): Promise<PokemonDetail | null> {
  try {
    const [pokemon, species, index] = await Promise.all([
      getPokemon(id),
      getSpecies(id),
      getPokemonIndex(),
    ]);

    const chain = await getEvolutionChain(idFromUrl(species.evolution_chain.url));
    const generationId = idFromUrl(species.generation.url);
    const generation: GenerationId = isGenerationId(generationId) ? generationId : 1;

    const genera = species.genera.map((g) => ({ text: g.genus, language: g.language.name }));
    const flavors = species.flavor_text_entries.map((f) => ({
      text: f.flavor_text.replace(/[\n\f]/g, " "),
      language: f.language.name,
    }));

    return {
      id: pokemon.id,
      slug: species.name,
      name: formatPokemonName(species.name),
      generation,
      types: pokemon.types
        .sort((a, b) => a.slot - b.slot)
        .map((t) => t.type.name)
        .filter(isTypeSlug),
      imageUrl:
        pokemon.sprites.other?.["official-artwork"]?.front_default ??
        officialArtworkUrl(pokemon.id),
      stats: pokemon.stats.reduce<{ stat: StatSlug; value: number }[]>((acc, s) => {
        if (isStatSlug(s.stat.name)) acc.push({ stat: s.stat.name, value: s.base_stat });
        return acc;
      }, []),
      heightMeters: pokemon.height / 10,
      weightKilograms: pokemon.weight / 10,
      abilities: pokemon.abilities.map((a) => ({ slug: a.ability.name, hidden: a.is_hidden })),
      genus: { es: pickLocalized(genera, "es"), en: pickLocalized(genera, "en") },
      flavorText: { es: pickLocalized(flavors, "es"), en: pickLocalized(flavors, "en") },
      evolutionStages: chainToStages(chain.chain).map((stage) =>
        stage.map((member) => ({
          id: member.id,
          slug: member.slug,
          name: formatPokemonName(member.slug),
          imageUrl: officialArtworkUrl(member.id),
        })),
      ),
      maxId: index.length > 0 ? Math.max(...index.map((p) => p.id)) : id,
    };
  } catch (error) {
    if (error instanceof PokeApiError && error.status === 404) return null;
    throw error;
  }
}
