"use client";

import Image from "next/image";
import Link from "next/link";
import type { PokemonSummary } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/provider";
import { TypeBadge } from "./type-badge";
import { TYPE_COLORS } from "./type-colors";

export function PokemonCard({
  pokemon,
  priority = false,
}: {
  pokemon: PokemonSummary;
  /** Above-the-fold cards load eagerly to improve LCP; the rest stay lazy. */
  priority?: boolean;
}) {
  const { d } = useI18n();
  const accent = TYPE_COLORS[pokemon.types[0] ?? "normal"];
  return (
    <Link
      href={`/pokemon/${pokemon.id}`}
      className="group relative flex flex-col items-center overflow-hidden rounded-2xl border border-white/10 bg-[var(--screen-raised)] p-4 transition-all duration-200 hover:-translate-y-1.5 hover:border-white/25"
      style={{ boxShadow: "0 6px 18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)" }}
    >
      {/* type-colored energy glow behind the sprite */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30 transition-opacity duration-200 group-hover:opacity-60"
        style={{ background: `radial-gradient(130px 130px at 50% 32%, ${accent}, transparent 70%)` }}
      />

      {/* faint pokéball watermark */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="pointer-events-none absolute -bottom-6 -right-6 h-28 w-28 opacity-[0.05] transition-opacity duration-200 group-hover:opacity-10"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      >
        <circle cx="50" cy="50" r="46" />
        <path d="M4 50h28" />
        <path d="M68 50h28" />
        <circle cx="50" cy="50" r="14" fill="currentColor" stroke="none" />
      </svg>

      {/* cyan scan line that sweeps on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-16 bg-[linear-gradient(to_bottom,transparent,rgba(56,189,248,0.35),transparent)] opacity-0 group-hover:[animation:scan-sweep_0.9s_ease-in-out]"
      />

      {/* id readout chip */}
      <span className="readout absolute left-2.5 top-2 rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-bold text-[var(--scan)]">
        #{String(pokemon.id).padStart(4, "0")}
      </span>

      <Image
        src={pokemon.imageUrl}
        alt={pokemon.name}
        width={120}
        height={120}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        className="relative z-10 mt-3 h-24 w-24 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.5)] transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-2 sm:h-28 sm:w-28"
      />
      <h2 className="relative z-10 mt-2 text-sm font-bold sm:text-base">{pokemon.name}</h2>
      <span className="relative z-10 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {d.generations[pokemon.generation]}
      </span>
      <div className="relative z-10 mt-2 flex flex-wrap justify-center gap-1">
        {pokemon.types.map((type) => (
          <TypeBadge key={type} type={type} />
        ))}
      </div>
    </Link>
  );
}
