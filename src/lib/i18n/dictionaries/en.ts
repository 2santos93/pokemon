import type { Dictionary } from "../dictionary";

export const en: Dictionary = {
  app: { title: "Pokédex", tagline: "Every generation · data from PokéAPI" },
  search: { placeholder: "Search by name or evolution…", label: "Search Pokémon" },
  filters: {
    types: "Type",
    generations: "Generation",
    clear: "Clear filters",
    results: (count) => (count === 1 ? "1 Pokémon" : `${count} Pokémon`),
  },
  list: {
    empty: "No Pokémon found",
    emptyHint: "Try another name or clear the filters.",
    loadError: "The Pokédex is not responding",
    retry: "Retry",
  },
  detail: {
    back: "Back to the Pokédex",
    stats: "Base stats",
    evolutions: "Evolution chain",
    noEvolutions: "This Pokémon does not evolve.",
    current: "Current",
    height: "Height",
    weight: "Weight",
    abilities: "Abilities",
    hiddenAbility: "hidden",
    generationLabel: "Generation",
    previous: "Previous",
    next: "Next",
    notFound: "That Pokémon is not in the Pokédex.",
  },
  stats: {
    hp: "HP",
    attack: "Attack",
    defense: "Defense",
    "special-attack": "Sp. Attack",
    "special-defense": "Sp. Defense",
    speed: "Speed",
  },
  statsTotal: "Total",
  types: {
    normal: "Normal", fire: "Fire", water: "Water", electric: "Electric", grass: "Grass",
    ice: "Ice", fighting: "Fighting", poison: "Poison", ground: "Ground", flying: "Flying",
    psychic: "Psychic", bug: "Bug", rock: "Rock", ghost: "Ghost", dragon: "Dragon",
    dark: "Dark", steel: "Steel", fairy: "Fairy",
  },
  generations: {
    1: "Gen I", 2: "Gen II", 3: "Gen III", 4: "Gen IV", 5: "Gen V",
    6: "Gen VI", 7: "Gen VII", 8: "Gen VIII", 9: "Gen IX",
  },
  languageToggle: "Switch language",
};
