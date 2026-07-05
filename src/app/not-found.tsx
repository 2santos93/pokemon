import Link from "next/link";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/locale";

export default async function NotFound() {
  const locale = await getLocale();
  const d = getDictionary(locale);
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="text-lg font-bold text-[var(--muted)]">{d.detail.notFound}</p>
      <Link
        href="/"
        className="rounded-full bg-[var(--surface-raised)] px-4 py-1.5 text-sm font-semibold hover:bg-white/10"
      >
        ← {d.detail.back}
      </Link>
    </div>
  );
}
