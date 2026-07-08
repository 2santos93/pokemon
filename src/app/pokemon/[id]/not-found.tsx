import { NotFoundScreen } from "@/components/pokedex/not-found-screen";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/locale";

export default async function PokemonNotFound() {
  const locale = await getLocale();
  return <NotFoundScreen d={getDictionary(locale)} />;
}
