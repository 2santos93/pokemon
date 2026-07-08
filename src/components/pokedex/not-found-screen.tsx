import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionary";

export function NotFoundScreen({ d }: { d: Dictionary }) {
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
