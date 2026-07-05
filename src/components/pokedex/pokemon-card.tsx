"use client";

import Image from "next/image";
import Link from "next/link";
import type { PokemonSummary } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/provider";
import { TypeBadge } from "./type-badge";
import { TYPE_COLORS } from "./type-colors";

export function PokemonCard({ pokemon }: { pokemon: PokemonSummary }) {
  const { d } = useI18n();
  const accent = TYPE_COLORS[pokemon.types[0] ?? "normal"];
  return (
    <Link
      href={`/pokemon/${pokemon.id}`}
      className="group relative flex flex-col items-center overflow-hidden rounded-2xl border border-white/5 bg-[var(--surface)] p-4 transition-all duration-200 hover:-translate-y-1 hover:border-white/15"
      style={{ boxShadow: "0 4px 14px rgba(0,0,0,0.3)" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-25 transition-opacity duration-200 group-hover:opacity-45"
        style={{ background: `radial-gradient(120px 120px at 50% 30%, ${accent}, transparent 70%)` }}
      />
      <span className="absolute right-3 top-2 font-mono text-xs font-semibold text-[var(--muted)]">
        #{String(pokemon.id).padStart(4, "0")}
      </span>
      <Image
        src={pokemon.imageUrl}
        alt={pokemon.name}
        width={120}
        height={120}
        loading="lazy"
        className="relative z-10 h-24 w-24 object-contain drop-shadow-lg transition-transform duration-200 group-hover:scale-110 sm:h-28 sm:w-28"
      />
      <h2 className="relative z-10 mt-2 text-sm font-bold sm:text-base">{pokemon.name}</h2>
      <span className="relative z-10 text-[11px] font-medium text-[var(--muted)]">
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
