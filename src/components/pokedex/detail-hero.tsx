"use client";

import Image from "next/image";
import type { PokemonDetail } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/provider";
import { TypeBadge } from "./type-badge";
import { TYPE_COLORS } from "./type-colors";
import { formatPokemonName } from "@/lib/domain/format";

export function DetailHero({ detail }: { detail: PokemonDetail }) {
  const { d, locale } = useI18n();
  const accent = TYPE_COLORS[detail.types[0] ?? "normal"];
  return (
    <section className="grid items-stretch gap-6 md:grid-cols-[minmax(0,360px)_1fr]">
      {/* ---- Scanner screen (left) ---- */}
      <div className="flex flex-col gap-4">
        <div className="screen screen-scanlines relative flex aspect-square items-center justify-center rounded-3xl p-6">
          {/* spinning energy ring */}
          <span
            aria-hidden
            className="absolute h-56 w-56 rounded-full border-2 border-dashed opacity-40 sm:h-64 sm:w-64"
            style={{ borderColor: accent, animation: "ring-spin 14s linear infinite" }}
          />
          <span
            aria-hidden
            className="absolute h-40 w-40 rounded-full opacity-40 blur-2xl sm:h-48 sm:w-48"
            style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
          />
          <Image
            src={detail.imageUrl}
            alt={detail.name}
            width={320}
            height={320}
            priority
            className="relative z-10 h-52 w-52 object-contain drop-shadow-[0_16px_24px_rgba(0,0,0,0.6)] sm:h-60 sm:w-60"
            style={{ animation: "float-slow 4s ease-in-out infinite" }}
          />
          <span className="readout absolute left-4 top-4 z-10 rounded-md bg-black/50 px-2 py-1 text-[11px] font-bold text-[var(--scan)]">
            #{String(detail.id).padStart(4, "0")}
          </span>
        </div>

        {/* decorative controls: D-pad + buttons */}
        <div aria-hidden className="flex items-center justify-between px-2">
          <div className="relative h-16 w-16 text-white/25">
            <span className="absolute left-1/2 top-0 h-16 w-5 -translate-x-1/2 rounded bg-current" />
            <span className="absolute left-0 top-1/2 h-5 w-16 -translate-y-1/2 rounded bg-current" />
          </div>
          <div className="flex gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--pokedex-red)] text-[11px] font-black text-white shadow-inner">
              B
            </span>
            <span className="mt-4 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--pokedex-red)] text-[11px] font-black text-white shadow-inner">
              A
            </span>
          </div>
        </div>
      </div>

      {/* ---- Data readout (right) ---- */}
      <div className="flex flex-col justify-center gap-3">
        <p className="readout text-xs font-bold text-[var(--scan)]">
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
        <p className="max-w-prose rounded-xl border-l-2 border-[var(--scan)]/50 bg-black/20 p-3 text-sm leading-relaxed text-[var(--foreground)]/85">
          {detail.flavorText[locale]}
        </p>
        <dl className="mt-1 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl border border-white/5 bg-[var(--surface-raised)] p-3">
            <dt className="readout text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {d.detail.height}
            </dt>
            <dd className="readout mt-1 font-bold">{detail.heightMeters.toFixed(1)} m</dd>
          </div>
          <div className="rounded-xl border border-white/5 bg-[var(--surface-raised)] p-3">
            <dt className="readout text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {d.detail.weight}
            </dt>
            <dd className="readout mt-1 font-bold">{detail.weightKilograms.toFixed(1)} kg</dd>
          </div>
          <div className="col-span-2 rounded-xl border border-white/5 bg-[var(--surface-raised)] p-3 sm:col-span-1">
            <dt className="readout text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {d.detail.abilities}
            </dt>
            <dd className="mt-1 text-xs font-semibold leading-relaxed">
              {detail.abilities
                .map(
                  (a) =>
                    formatPokemonName(a.slug) + (a.hidden ? ` (${d.detail.hiddenAbility})` : ""),
                )
                .join(", ")}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
