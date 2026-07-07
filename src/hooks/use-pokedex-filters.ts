"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { GenerationId, PokedexFilters, TypeSlug } from "@/lib/domain/types";
import { parseFilters, serializeFilters } from "@/lib/domain/url-state";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function usePokedexFilters() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => parseFilters(new URLSearchParams(searchParams)), [searchParams]);

  // Filtering is entirely client-side over the in-memory index, so URL sync must
  // NOT trigger an RSC navigation. router.replace() would re-fetch this route's
  // server component (which awaits the ~1000-entry PokéAPI index) and flash the
  // loading.tsx skeleton — the "stuck loading" bug. The native History API does
  // shallow routing: it updates the URL and useSearchParams without a round-trip.
  const apply = useCallback(
    (next: PokedexFilters) => {
      const query = serializeFilters(next).toString();
      window.history.replaceState(null, "", query === "" ? pathname : `${pathname}?${query}`);
    },
    [pathname],
  );

  return {
    filters,
    setQuery: useCallback((query: string) => apply({ ...filters, query }), [apply, filters]),
    toggleType: useCallback(
      (type: TypeSlug) => apply({ ...filters, types: toggle(filters.types, type) }),
      [apply, filters],
    ),
    toggleGeneration: useCallback(
      (generation: GenerationId) =>
        apply({ ...filters, generations: toggle(filters.generations, generation) }),
      [apply, filters],
    ),
    clearAll: useCallback(() => apply({ query: "", types: [], generations: [] }), [apply]),
  };
}
