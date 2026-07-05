"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { GenerationId, PokedexFilters, TypeSlug } from "@/lib/domain/types";
import { parseFilters, serializeFilters } from "@/lib/domain/url-state";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function usePokedexFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => parseFilters(new URLSearchParams(searchParams)), [searchParams]);

  const apply = useCallback(
    (next: PokedexFilters) => {
      const query = serializeFilters(next).toString();
      router.replace(query === "" ? pathname : `${pathname}?${query}`, { scroll: false });
    },
    [pathname, router],
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
