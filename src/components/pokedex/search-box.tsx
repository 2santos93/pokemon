"use client";

import { useEffect, useRef, useState } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync only while unfocused: the URL push is debounced, so initialQuery lags behind
  // by up to 250ms (a "debounced echo") and would clobber the keystroke just typed.
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setValue(initialQuery);
  }, [initialQuery]);

  // "/" focuses the search box, unless already typing in a field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const update = (next: string) => {
    setValue(next);
    pushQuery(next);
  };

  return (
    <div className="relative w-full max-w-md">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--scan)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => update(event.target.value)}
        placeholder={d.search.placeholder}
        aria-label={d.search.label}
        className="w-full rounded-xl border border-[var(--scan)]/20 bg-black/40 py-2.5 pl-10 pr-9 text-sm shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--scan)]/60"
      />
      {value !== "" ? (
        <button
          type="button"
          onClick={() => update("")}
          aria-label={d.search.clear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white"
        >
          ✕
        </button>
      ) : (
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-white/15 bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted)] sm:block"
        >
          /
        </kbd>
      )}
    </div>
  );
}
