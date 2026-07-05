import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/pokedex/back-link";
import { DetailHero } from "@/components/pokedex/detail-hero";
import { EvolutionChain } from "@/components/pokedex/evolution-chain";
import { StatsPanel } from "@/components/pokedex/stats-panel";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/locale";
import { getPokemonDetail } from "@/lib/pokeapi/loaders";

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: DetailPageProps) {
  const { id } = await params;
  const detail = await getPokemonDetail(Number(id));
  return { title: detail ? `${detail.name} — Pokédex` : "Pokédex" };
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
        <div className="flex gap-2 text-sm font-semibold">
          {id > 1 && (
            <Link
              href={`/pokemon/${id - 1}`}
              className="rounded-full bg-[var(--surface-raised)] px-4 py-1.5 hover:bg-white/10"
            >
              ← {d.detail.previous}
            </Link>
          )}
          {id < detail.maxId && (
            <Link
              href={`/pokemon/${id + 1}`}
              className="rounded-full bg-[var(--surface-raised)] px-4 py-1.5 hover:bg-white/10"
            >
              {d.detail.next} →
            </Link>
          )}
        </div>
      </div>
      <DetailHero detail={detail} />
      <div className="grid gap-6 lg:grid-cols-2">
        <StatsPanel stats={detail.stats} />
        <section className="rounded-2xl border border-white/5 bg-[var(--surface)] p-5">
          <h2 className="mb-4 text-sm font-black uppercase tracking-wider text-[var(--muted)]">
            {d.detail.evolutions}
          </h2>
          <EvolutionChain stages={detail.evolutionStages} currentId={detail.id} />
        </section>
      </div>
    </div>
  );
}
