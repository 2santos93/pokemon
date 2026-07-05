"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/domain/types";

const OPTIONS: { locale: Locale; label: string }[] = [
  { locale: "es", label: "ES" },
  { locale: "en", label: "EN" },
];

export function LanguageToggle() {
  const { locale, d, setLocale } = useI18n();
  return (
    <div
      role="group"
      aria-label={d.languageToggle}
      className="flex overflow-hidden rounded-full border border-white/40 bg-black/20 text-xs font-bold"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.locale}
          type="button"
          onClick={() => setLocale(option.locale)}
          aria-pressed={locale === option.locale}
          className={`px-3 py-1.5 transition-colors ${
            locale === option.locale ? "bg-white text-[var(--pokedex-red)]" : "text-white/85 hover:bg-white/10"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
