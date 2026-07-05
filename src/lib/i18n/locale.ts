import { cookies } from "next/headers";
import type { Locale } from "@/lib/domain/types";

export const LOCALE_COOKIE = "locale";
export const DEFAULT_LOCALE: Locale = "es";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return value === "en" || value === "es" ? value : DEFAULT_LOCALE;
}
