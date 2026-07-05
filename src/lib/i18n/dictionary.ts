import type { GenerationId, Locale, StatSlug, TypeSlug } from "@/lib/domain/types";
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";

export interface Dictionary {
  app: { title: string; tagline: string };
  search: { placeholder: string; label: string; clear: string };
  filters: { types: string; generations: string; clear: string; results: (count: number) => string };
  list: { empty: string; emptyHint: string; loadError: string; retry: string };
  detail: {
    back: string;
    stats: string;
    evolutions: string;
    noEvolutions: string;
    current: string;
    height: string;
    weight: string;
    abilities: string;
    hiddenAbility: string;
    generationLabel: string;
    previous: string;
    next: string;
    notFound: string;
  };
  stats: Record<StatSlug, string>;
  statsTotal: string;
  types: Record<TypeSlug, string>;
  generations: Record<GenerationId, string>;
  languageToggle: string;
}

const DICTIONARIES: Record<Locale, Dictionary> = { es, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
