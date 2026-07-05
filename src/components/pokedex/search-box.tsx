"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";

export function SearchBox({
  initialQuery,
  onQueryChange,
}: {
  initialQuery: string;
  onQueryChange: (query: string) => void;
}) {
  const { d } = useI18n();
  const [value, setValue] = useState(initialQuery);
  const pushQuery = useDebouncedCallback(onQueryChange, 250);

  // Re-sync local value when the URL-derived query changes externally (e.g. "Clear
  // filters" or browser back/forward), without remounting the input and losing focus.
  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  const update = (next: string) => {
    setValue(next);
    pushQuery(next);
  };

  return (
    <div className="relative w-full max-w-md">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(event) => update(event.target.value)}
        placeholder={d.search.placeholder}
        aria-label={d.search.label}
        className="w-full rounded-full border border-white/10 bg-[var(--surface-raised)] py-2.5 pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-[var(--muted)] focus:border-sky-400/60"
      />
      {value !== "" && (
        <button
          type="button"
          onClick={() => update("")}
          aria-label="✕"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white"
        >
          ✕
        </button>
      )}
    </div>
  );
}
