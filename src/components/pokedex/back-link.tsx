"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";

export function BackLink() {
  const router = useRouter();
  const { d } = useI18n();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      className="flex w-fit items-center gap-1.5 text-sm font-semibold text-sky-400 transition-colors hover:text-sky-300"
    >
      ← {d.detail.back}
    </button>
  );
}
