import { Suspense } from "react";
import { PokedexExplorer } from "@/components/pokedex/pokedex-explorer";
import { getPokemonIndex } from "@/lib/pokeapi/loaders";

// First uncached request after a deploy/revalidation builds the index (~580 requests, 10-15s).
export const maxDuration = 60;

export default async function HomePage() {
  const index = await getPokemonIndex();
  return (
    <Suspense>
      <PokedexExplorer index={index} />
    </Suspense>
  );
}
