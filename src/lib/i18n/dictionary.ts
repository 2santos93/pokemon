import type { GenerationId, Locale, StatSlug, TypeSlug } from "@/lib/domain/types";
import type { StatusCondition } from "@/lib/battle/types";
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";

export interface Dictionary {
  app: { title: string; tagline: string };
  search: { placeholder: string; label: string; clear: string };
  filters: {
    types: string;
    generations: string;
    clear: string;
    results: (count: number) => string;
  };
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
  battle: {
    title: string;
    create: string;
    landingHint: string;
    shareHint: string;
    copy: string;
    copied: string;
    waitingOpponent: string;
    nickname: string;
    nicknamePlaceholder: string;
    gender: { male: string; female: string };
    ready: string;
    chooseLead: string;
    yourTeam: string;
    waitingLead: string;
    vs: string;
    lv: string;
    fight: string;
    switchLabel: string;
    run: string;
    runConfirm: string;
    yourTurn: string;
    opponentTurn: string;
    noPp: string;
    fainted: string;
    status: Record<StatusCondition, string>;
    result: { victory: string; defeat: string; rematch: string; opponentLeft: string };
    log: {
      used: (mon: string, move: string) => string;
      superEffective: string;
      notVery: string;
      immune: (mon: string) => string;
      crit: string;
      miss: (mon: string) => string;
      faint: (mon: string) => string;
      statusInflict: (mon: string, status: string) => string;
      statusHurt: (mon: string, status: string) => string;
      cantMove: (mon: string, status: string) => string;
      wake: (mon: string) => string;
      switch: (to: string) => string;
      win: (nick: string) => string;
    };
  };
}

const DICTIONARIES: Record<Locale, Dictionary> = { es, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
