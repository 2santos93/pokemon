/** Slugs whose display name can't be derived by capitalization (punctuation, symbols). */
const NAME_OVERRIDES: Readonly<Record<string, string>> = {
  "mr-mime": "Mr. Mime",
  "mr-rime": "Mr. Rime",
  "mime-jr": "Mime Jr.",
  farfetchd: "Farfetch'd",
  sirfetchd: "Sirfetch'd",
  "ho-oh": "Ho-Oh",
  "porygon-z": "Porygon-Z",
  "nidoran-f": "Nidoran♀",
  "nidoran-m": "Nidoran♂",
  "type-null": "Type: Null",
  "jangmo-o": "Jangmo-o",
  "hakamo-o": "Hakamo-o",
  "kommo-o": "Kommo-o",
  "wo-chien": "Wo-Chien",
  "chien-pao": "Chien-Pao",
  "ting-lu": "Ting-Lu",
  "chi-yu": "Chi-Yu",
};

export function formatPokemonName(slug: string): string {
  const override = NAME_OVERRIDES[slug];
  if (override !== undefined) return override;
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// raw.githubusercontent.com rate-limits (429) under load, causing sprites to randomly
// vanish; jsDelivr mirrors the same repo behind a CDN with no such throttling.
const SPRITE_RAW_PREFIX = "https://raw.githubusercontent.com/PokeAPI/sprites/master";
const SPRITE_CDN_PREFIX = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master";

/** Rewrite a PokeAPI raw-sprite URL to its rate-limit-free jsDelivr mirror. */
export function toSpriteCdn(url: string): string {
  return url.startsWith(SPRITE_RAW_PREFIX)
    ? SPRITE_CDN_PREFIX + url.slice(SPRITE_RAW_PREFIX.length)
    : url;
}

export function officialArtworkUrl(id: number): string {
  return `${SPRITE_CDN_PREFIX}/sprites/pokemon/other/official-artwork/${id}.png`;
}
