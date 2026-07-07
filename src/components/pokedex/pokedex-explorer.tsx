"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePokedexFilters } from "@/hooks/use-pokedex-filters";
import { filterPokemon } from "@/lib/domain/filter";
import type { PokemonSummary } from "@/lib/domain/types";
import { serializeFilters } from "@/lib/domain/url-state";
import { useI18n } from "@/lib/i18n/provider";
import { FilterBar } from "./filter-bar";
import { PokemonCard } from "./pokemon-card";
import { SearchBox } from "./search-box";
import { LIST_URL_KEY, VISIBLE_COUNT_KEY } from "./session-keys";

const PAGE_SIZE = 60;

function readStoredCount(): number {
  if (typeof window === "undefined") return PAGE_SIZE;
  const stored = Number(window.sessionStorage.getItem(VISIBLE_COUNT_KEY));
  return Number.isInteger(stored) && stored >= PAGE_SIZE ? stored : PAGE_SIZE;
}

export function PokedexExplorer({ index }: { index: PokemonSummary[] }) {
  const { d } = useI18n();
  const { filters, setQuery, toggleType, toggleGeneration, clearAll } = usePokedexFilters();
  // Start from the server-rendered page size to keep hydration deterministic, then
  // restore any persisted scroll depth after mount (see effect below).
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Guards the one-time post-mount restore below: without it, the persist branch
  // would immediately overwrite sessionStorage with the initial PAGE_SIZE before
  // the stored count had a chance to be read back in (hydration-safe restore).
  const restoredRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => filterPokemon(index, filters), [index, filters]);
  const visible = filtered.slice(0, visibleCount);

  // Remember the current list URL (including active filters) so the detail
  // page's back button can return here even after detail-to-detail navigation.
  useEffect(() => {
    const query = serializeFilters(filters).toString();
    window.sessionStorage.setItem(LIST_URL_KEY, query === "" ? "/" : `/?${query}`);
  }, [filters]);

  useEffect(() => {
    if (!restoredRef.current) {
      restoredRef.current = true;
      const stored = readStoredCount();
      if (stored > PAGE_SIZE) setVisibleCount(stored);
      return;
    }
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
            {visible.map((pokemon, index) => (
              <li key={pokemon.id}>
                <PokemonCard pokemon={pokemon} priority={index < 6} />
              </li>
            ))}
          </ul>
          {visible.length < filtered.length && <div ref={sentinelRef} className="h-10" />}
        </>
      )}
    </div>
  );
}
