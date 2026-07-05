"use client";

import { useI18n } from "@/lib/i18n/provider";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const { d } = useI18n();
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <span className="text-5xl">⚠️</span>
      <h1 className="text-xl font-black">{d.list.loadError}</h1>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-[var(--pokedex-red)] px-6 py-2 text-sm font-bold text-white hover:brightness-110"
      >
        {d.list.retry}
      </button>
    </div>
  );
}
