"use client";

import { GENERATION_IDS, TYPE_SLUGS, type GenerationId, type PokedexFilters, type TypeSlug } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/provider";
import { TYPE_COLORS } from "./type-colors";

interface FilterBarProps {
  filters: PokedexFilters;
  resultCount: number;
  onToggleType: (type: TypeSlug) => void;
  onToggleGeneration: (generation: GenerationId) => void;
  onClear: () => void;
}

export function FilterBar({ filters, resultCount, onToggleType, onToggleGeneration, onClear }: FilterBarProps) {
  const { d } = useI18n();
  const hasActiveFilters =
    filters.query !== "" || filters.types.length > 0 || filters.generations.length > 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
          {d.filters.types}
        </span>
        {TYPE_SLUGS.map((type) => {
          const active = filters.types.includes(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => onToggleType(type)}
              aria-pressed={active}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-all ${
                active
                  ? "border-transparent text-white shadow-md"
                  : "border-white/10 bg-[var(--surface)] text-[var(--muted)] hover:border-white/25 hover:text-white"
              }`}
              style={active ? { background: TYPE_COLORS[type] } : undefined}
            >
              {d.types[type]}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
          {d.filters.generations}
        </span>
        {GENERATION_IDS.map((generation) => {
          const active = filters.generations.includes(generation);
          return (
            <button
              key={generation}
              type="button"
              onClick={() => onToggleGeneration(generation)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all ${
                active
                  ? "border-transparent bg-[var(--pokedex-red)] text-white shadow-md"
                  : "border-white/10 bg-[var(--surface)] text-[var(--muted)] hover:border-white/25 hover:text-white"
              }`}
            >
              {d.generations[generation]}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
        <span className="font-semibold">{d.filters.results(resultCount)}</span>
        {hasActiveFilters && (
          <button type="button" onClick={onClear} className="font-semibold text-sky-400 hover:text-sky-300">
            {d.filters.clear}
          </button>
        )}
      </div>
    </section>
  );
}
