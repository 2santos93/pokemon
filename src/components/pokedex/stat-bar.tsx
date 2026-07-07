"use client";

import type { StatSlug } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/provider";

const MAX_BASE_STAT = 255;

function statColor(value: number): string {
  if (value < 50) return "#f87171";
  if (value < 80) return "#fbbf24";
  if (value < 110) return "#a3e635";
  return "#34d399";
}

export function StatBar({ stat, value }: { stat: StatSlug; value: number }) {
  const { d } = useI18n();
  const percent = Math.min(100, (value / MAX_BASE_STAT) * 100);
  return (
    <div className="grid grid-cols-[110px_2.5rem_1fr] items-center gap-2 text-sm">
      <span className="text-xs font-semibold text-[var(--muted)]">{d.stats[stat]}</span>
      <span className="readout text-right font-bold">{value}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-black/40 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${percent}%`,
            background: statColor(value),
            boxShadow: `0 0 8px ${statColor(value)}`,
            animation: "stat-fill 0.9s ease-out",
          }}
        />
      </div>
    </div>
  );
}
