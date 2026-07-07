import { STAT_SLUGS, type StatSlug } from "@/lib/domain/types";

const IV = 31;
const EV = 0;

/** Standard main-series stat formula. IV 31, EV 0, neutral nature. */
export function computeStats(
  base: Record<StatSlug, number>,
  level: number,
): Record<StatSlug, number> {
  const common = (b: number) => Math.floor(((2 * b + IV + Math.floor(EV / 4)) * level) / 100);
  const result = {} as Record<StatSlug, number>;
  for (const slug of STAT_SLUGS) {
    result[slug] = slug === "hp" ? common(base[slug]) + level + 10 : common(base[slug]) + 5;
  }
  return result;
}
