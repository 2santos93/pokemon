"use client";

import Image from "next/image";
import type { PokemonDetail } from "@/lib/pokeapi/loaders";
import { useI18n } from "@/lib/i18n/provider";
import { TypeBadge } from "./type-badge";
import { TYPE_COLORS } from "./type-colors";
import { formatPokemonName } from "@/lib/domain/format";

export function DetailHero({ detail }: { detail: PokemonDetail }) {
  const { d, locale } = useI18n();
  const accent = TYPE_COLORS[detail.types[0] ?? "normal"];
  return (
    <section className="grid items-center gap-6 rounded-3xl border border-white/5 bg-[var(--surface)] p-6 md:grid-cols-[minmax(0,320px)_1fr] md:p-8">
      <div className="relative mx-auto">
        <div
          className="absolute inset-0 rounded-full opacity-40 blur-2xl"
          style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
        />
        <Image
          src={detail.imageUrl}
          alt={detail.name}
          width={320}
          height={320}
          priority
          className="relative h-56 w-56 object-contain drop-shadow-2xl sm:h-72 sm:w-72"
          style={{ animation: "float-slow 4s ease-in-out infinite" }}
        />
      </div>
      <div className="flex flex-col gap-3">
        <p className="font-mono text-sm font-bold text-[var(--muted)]">
          #{String(detail.id).padStart(4, "0")} · {d.detail.generationLabel} {detail.generation}
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{detail.name}</h1>
        <p className="text-sm font-semibold" style={{ color: accent }}>
          {detail.genus[locale]}
        </p>
        <div className="flex gap-2">
          {detail.types.map((type) => (
            <TypeBadge key={type} type={type} size="md" />
          ))}
        </div>
        <p className="max-w-prose text-sm leading-relaxed text-[var(--foreground)]/85">
          {detail.flavorText[locale]}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-[var(--surface-raised)] p-3">
            <dt className="text-[11px] font-bold uppercase text-[var(--muted)]">{d.detail.height}</dt>
            <dd className="font-mono font-bold">{detail.heightMeters.toFixed(1)} m</dd>
          </div>
          <div className="rounded-xl bg-[var(--surface-raised)] p-3">
            <dt className="text-[11px] font-bold uppercase text-[var(--muted)]">{d.detail.weight}</dt>
            <dd className="font-mono font-bold">{detail.weightKilograms.toFixed(1)} kg</dd>
          </div>
          <div className="col-span-2 rounded-xl bg-[var(--surface-raised)] p-3 sm:col-span-1">
            <dt className="text-[11px] font-bold uppercase text-[var(--muted)]">{d.detail.abilities}</dt>
            <dd className="text-xs font-semibold leading-relaxed">
              {detail.abilities
                .map((a) => formatPokemonName(a.slug) + (a.hidden ? ` (${d.detail.hiddenAbility})` : ""))
                .join(", ")}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
