"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { LIST_URL_KEY } from "./session-keys";

export function BackLink() {
  const router = useRouter();
  const { d } = useI18n();
  // Always navigate to the list (with its last-known filters) instead of
  // history.back(): after detail-to-detail navigation (evolutions, prev/next),
  // "back" would land on the previous Pokémon rather than the Pokédex.
  const goToList = () => {
    router.push(window.sessionStorage.getItem(LIST_URL_KEY) ?? "/");
  };
  return (
    <button
      type="button"
      onClick={goToList}
      className="flex w-fit items-center gap-1.5 text-sm font-semibold text-sky-400 transition-colors hover:text-sky-300"
    >
      ← {d.detail.back}
    </button>
  );
}
