import type { Dictionary } from "../dictionary";

export const es: Dictionary = {
  app: { title: "Pokédex", tagline: "Todas las generaciones · datos de PokéAPI" },
  search: { placeholder: "Buscar por nombre o evolución…", label: "Buscar Pokémon", clear: "Borrar búsqueda" },
  filters: {
    types: "Tipo",
    generations: "Generación",
    clear: "Limpiar filtros",
    results: (count) => (count === 1 ? "1 Pokémon" : `${count} Pokémon`),
  },
  list: {
    empty: "No se encontró ningún Pokémon",
    emptyHint: "Prueba con otro nombre o limpia los filtros.",
    loadError: "La Pokédex no responde",
    retry: "Reintentar",
  },
  detail: {
    back: "Volver a la Pokédex",
    stats: "Estadísticas base",
    evolutions: "Cadena evolutiva",
    noEvolutions: "Este Pokémon no evoluciona.",
    current: "Actual",
    height: "Altura",
    weight: "Peso",
    abilities: "Habilidades",
    hiddenAbility: "oculta",
    generationLabel: "Generación",
    previous: "Anterior",
    next: "Siguiente",
    notFound: "Ese Pokémon no está en la Pokédex.",
  },
  stats: {
    hp: "PS",
    attack: "Ataque",
    defense: "Defensa",
    "special-attack": "At. Especial",
    "special-defense": "Def. Especial",
    speed: "Velocidad",
  },
  statsTotal: "Total",
  types: {
    normal: "Normal", fire: "Fuego", water: "Agua", electric: "Eléctrico", grass: "Planta",
    ice: "Hielo", fighting: "Lucha", poison: "Veneno", ground: "Tierra", flying: "Volador",
    psychic: "Psíquico", bug: "Bicho", rock: "Roca", ghost: "Fantasma", dragon: "Dragón",
    dark: "Siniestro", steel: "Acero", fairy: "Hada",
  },
  generations: {
    1: "Gen I", 2: "Gen II", 3: "Gen III", 4: "Gen IV", 5: "Gen V",
    6: "Gen VI", 7: "Gen VII", 8: "Gen VIII", 9: "Gen IX",
  },
  languageToggle: "Cambiar idioma",
};
