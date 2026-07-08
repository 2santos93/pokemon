"use client";

import type { CSSProperties } from "react";
import {
  GENERATION_IDS,
  TYPE_SLUGS,
  type GenerationId,
  type PokedexFilters,
  type TypeSlug,
} from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/provider";
import { TYPE_COLORS } from "./type-colors";
import { TypeIcon } from "./type-icon";

interface FilterBarProps {
  filters: PokedexFilters;
  resultCount: number;
  onToggleType: (type: TypeSlug) => void;
  onToggleGeneration: (generation: GenerationId) => void;
  onClear: () => void;
}

/** Small Poké Ball glyph for the generation chips. */
function PokeballIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M3 12h6M15 12h6" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="var(--screen)" />
    </svg>
  );
}

export function FilterBar({
  filters,
  resultCount,
  onToggleType,
  onToggleGeneration,
  onClear,
}: FilterBarProps) {
  const { d } = useI18n();
  const hasActiveFilters =
    filters.query !== "" || filters.types.length > 0 || filters.generations.length > 0;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      {/* ---- Types ---- */}
      <div className="flex flex-col gap-2">
        <span className="readout text-[10px] font-bold uppercase tracking-widest text-[var(--scan)]">
          {d.filters.types}
        </span>
        <div className="flex flex-wrap gap-2">
          {TYPE_SLUGS.map((type) => {
            const active = filters.types.includes(type);
            const color = TYPE_COLORS[type];
            const style = { "--tc": color } as CSSProperties;
            return (
              <button
                key={type}
                type="button"
                onClick={() => onToggleType(type)}
                aria-pressed={active}
                style={
                  active
                    ? {
                        ...style,
                        background: `linear-gradient(135deg, rgba(255,255,255,0.28), rgba(255,255,255,0) 45%), ${color}`,
                        boxShadow: `0 0 16px -2px ${color}, inset 0 1px 0 rgba(255,255,255,0.45)`,
                      }
                    : style
                }
                className={`group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-all duration-150 ${
                  active
                    ? "scale-105 border border-white/30 text-white"
                    : "border border-white/10 bg-black/30 text-[var(--muted)] hover:-translate-y-0.5 hover:border-[color:var(--tc)] hover:text-white hover:shadow-[0_0_12px_-3px_var(--tc)]"
                }`}
              >
                <TypeIcon
                  type={type}
                  className="h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-hover:scale-110"
                  style={{ color: active ? "#fff" : color }}
                />
                {d.types[type]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Generations ---- */}
      <div className="flex flex-col gap-2">
        <span className="readout text-[10px] font-bold uppercase tracking-widest text-[var(--scan)]">
          {d.filters.generations}
        </span>
        <div className="flex flex-wrap gap-2">
          {GENERATION_IDS.map((generation) => {
            const active = filters.generations.includes(generation);
            return (
              <button
                key={generation}
                type="button"
                onClick={() => onToggleGeneration(generation)}
                aria-pressed={active}
                style={
                  active
                    ? {
                        background:
                          "linear-gradient(135deg, var(--pokedex-red-light), var(--pokedex-red-dark))",
                        boxShadow:
                          "0 0 16px -3px var(--pokedex-red-light), inset 0 1px 0 rgba(255,255,255,0.4)",
                      }
                    : undefined
                }
                className={`group flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-all duration-150 ${
                  active
                    ? "scale-105 border border-white/30 text-white"
                    : "border border-white/10 bg-black/30 text-[var(--muted)] hover:-translate-y-0.5 hover:border-white/30 hover:text-white"
                }`}
              >
                <PokeballIcon
                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-300 group-hover:rotate-[20deg] ${
                    active ? "text-white" : "text-[var(--muted)] group-hover:text-white"
                  }`}
                />
                {d.generations[generation]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Result count ---- */}
      <div className="flex items-center gap-3 border-t border-white/10 pt-2 text-xs text-[var(--muted)]">
        <span className="readout font-bold text-[var(--scan-amber)]">
          {d.filters.results(resultCount)}
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="font-semibold text-sky-400 hover:text-sky-300"
          >
            {d.filters.clear}
          </button>
        )}
      </div>
    </section>
  );
}
