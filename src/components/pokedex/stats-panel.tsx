"use client";

import type { PokemonDetail } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/provider";
import { StatBar } from "./stat-bar";

export function StatsPanel({ stats }: { stats: PokemonDetail["stats"] }) {
  const { d } = useI18n();
  const total = stats.reduce((sum, entry) => sum + entry.value, 0);
  return (
    <section className="rounded-2xl border border-white/5 bg-[var(--surface)] p-5">
      <h2 className="mb-4 text-sm font-black uppercase tracking-wider text-[var(--muted)]">
        {d.detail.stats}
      </h2>
      <div className="flex flex-col gap-2.5">
        {stats.map((entry) => (
          <StatBar key={entry.stat} stat={entry.stat} value={entry.value} />
        ))}
      </div>
      <p className="mt-4 border-t border-white/10 pt-3 text-right text-sm font-bold">
        {d.statsTotal}: <span className="font-mono">{total}</span>
      </p>
    </section>
  );
}
