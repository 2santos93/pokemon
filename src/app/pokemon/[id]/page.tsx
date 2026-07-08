import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/pokedex/back-link";
import { DetailHero } from "@/components/pokedex/detail-hero";
import { EvolutionChain } from "@/components/pokedex/evolution-chain";
import { StatsPanel } from "@/components/pokedex/stats-panel";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/locale";
import { getPokemonDetail } from "@/lib/pokeapi/loaders";

// First uncached request after a deploy/revalidation builds the index (~580 requests, 10-15s).
export const maxDuration = 60;

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await getPokemonDetail(Number(id));
  if (!detail) return { title: "Pokédex" };

  const locale = await getLocale();
  const title = `${detail.name} — Pokédex`;
  const description = detail.flavorText[locale] || detail.genus[locale];
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: detail.imageUrl, width: 475, height: 475, alt: detail.name }],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PokemonDetailPage({ params }: DetailPageProps) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) notFound();

  const detail = await getPokemonDetail(id);
  if (!detail) notFound();

  const locale = await getLocale();
  const d = getDictionary(locale);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <BackLink />
        <div className="readout flex gap-2 text-xs font-bold">
          {id > 1 && (
            <Link
              href={`/pokemon/${id - 1}`}
              className="rounded-lg border border-white/10 bg-[var(--surface-raised)] px-4 py-2 transition-colors hover:border-[var(--scan)]/50 hover:bg-white/10"
            >
              ← {d.detail.previous}
            </Link>
          )}
          {id < detail.maxId && (
            <Link
              href={`/pokemon/${id + 1}`}
              className="rounded-lg border border-white/10 bg-[var(--surface-raised)] px-4 py-2 transition-colors hover:border-[var(--scan)]/50 hover:bg-white/10"
            >
              {d.detail.next} →
            </Link>
          )}
        </div>
      </div>
      <DetailHero detail={detail} />
      <div className="grid gap-6 lg:grid-cols-2">
        <StatsPanel stats={detail.stats} />
        <section className="rounded-2xl border border-white/10 bg-black/25 p-5">
          <h2 className="readout mb-4 text-[11px] font-black uppercase tracking-widest text-[var(--scan)]">
            {d.detail.evolutions}
          </h2>
          <EvolutionChain stages={detail.evolutionStages} currentId={detail.id} />
        </section>
      </div>
    </div>
  );
}
