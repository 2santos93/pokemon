import { Suspense } from "react";
import { PokedexExplorer } from "@/components/pokedex/pokedex-explorer";
import { getPokemonIndex } from "@/lib/pokeapi/loaders";

export default async function HomePage() {
  const index = await getPokemonIndex();
  return (
    <Suspense>
      <PokedexExplorer index={index} />
    </Suspense>
  );
}
