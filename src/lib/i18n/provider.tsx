"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "@/lib/domain/types";
import { getDictionary, type Dictionary } from "./dictionary";

interface I18nContextValue {
  locale: Locale;
  d: Dictionary;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      d: getDictionary(locale),
      setLocale: (next) => {
        document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      },
    }),
    [locale, router],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
