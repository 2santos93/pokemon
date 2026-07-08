"use client";

import type { TypeSlug } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/provider";
import { TYPE_COLORS } from "./type-colors";

export function TypeBadge({ type, size = "sm" }: { type: TypeSlug; size?: "sm" | "md" }) {
  const { d } = useI18n();
  const padding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wide text-white shadow-sm ${padding}`}
      style={{ background: TYPE_COLORS[type], textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
    >
      {d.types[type]}
    </span>
  );
}
