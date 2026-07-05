"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePokedexFilters } from "@/hooks/use-pokedex-filters";
import { filterPokemon } from "@/lib/domain/filter";
import type { PokemonSummary } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/provider";
import { FilterBar } from "./filter-bar";
import { PokemonCard } from "./pokemon-card";
import { SearchBox } from "./search-box";

const PAGE_SIZE = 60;
const VISIBLE_COUNT_KEY = "pokedex:visibleCount";

function readStoredCount(): number {
  if (typeof window === "undefined") return PAGE_SIZE;
  const stored = Number(window.sessionStorage.getItem(VISIBLE_COUNT_KEY));
  return Number.isInteger(stored) && stored >= PAGE_SIZE ? stored : PAGE_SIZE;
}

export function PokedexExplorer({ index }: { index: PokemonSummary[] }) {
  const { d } = useI18n();
  const { filters, setQuery, toggleType, toggleGeneration, clearAll } = usePokedexFilters();
  const [visibleCount, setVisibleCount] = useState(readStoredCount);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => filterPokemon(index, filters), [index, filters]);
  const visible = filtered.slice(0, visibleCount);

  useEffect(() => {
    window.sessionStorage.setItem(VISIBLE_COUNT_KEY, String(visibleCount));
  }, [visibleCount]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((count) => Math.min(count + PAGE_SIZE, filtered.length));
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filtered.length]);

  return (
    <div className="flex flex-col gap-5">
      <SearchBox initialQuery={filters.query} onQueryChange={setQuery} />
      <FilterBar
        filters={filters}
        resultCount={filtered.length}
        onToggleType={toggleType}
        onToggleGeneration={toggleGeneration}
        onClear={clearAll}
      />
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <span className="text-4xl">🥲</span>
          <p className="font-bold">{d.list.empty}</p>
          <p className="text-sm text-[var(--muted)]">{d.list.emptyHint}</p>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {visible.map((pokemon) => (
              <li key={pokemon.id}>
                <PokemonCard pokemon={pokemon} />
              </li>
            ))}
          </ul>
          {visible.length < filtered.length && <div ref={sentinelRef} className="h-10" />}
        </>
      )}
    </div>
  );
}
