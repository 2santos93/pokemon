"use client";

import Image from "next/image";
import Link from "next/link";
import type { EvolutionStageMember, PokemonDetail } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n/provider";

function Member({
  member,
  isCurrent,
  currentLabel,
}: {
  member: EvolutionStageMember;
  isCurrent: boolean;
  currentLabel: string;
}) {
  const card = (
    <div
      className={`relative flex w-28 flex-col items-center gap-1 rounded-2xl border p-3 transition-all ${
        isCurrent
          ? "border-[var(--pokedex-red)] bg-[var(--surface-raised)] shadow-[0_0_18px_rgba(220,10,45,0.35)]"
          : "border-white/5 bg-[var(--surface)] hover:-translate-y-1 hover:border-white/20"
      }`}
    >
      {isCurrent && (
        <span className="absolute -top-2 rounded-full bg-[var(--pokedex-red)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
          {currentLabel}
        </span>
      )}
      <Image
        src={member.imageUrl}
        alt={member.name}
        width={72}
        height={72}
        className="h-16 w-16 object-contain"
      />
      <span className="text-center text-xs font-bold leading-tight">{member.name}</span>
      <span className="font-mono text-[10px] text-[var(--muted)]">
        #{String(member.id).padStart(4, "0")}
      </span>
    </div>
  );
  return isCurrent ? card : <Link href={`/pokemon/${member.id}`}>{card}</Link>;
}

export function EvolutionChain({
  stages,
  currentId,
}: {
  stages: PokemonDetail["evolutionStages"];
  currentId: number;
}) {
  const { d } = useI18n();
  if (stages.length <= 1 && (stages[0]?.length ?? 0) <= 1) {
    return <p className="text-sm text-[var(--muted)]">{d.detail.noEvolutions}</p>;
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {stages.map((stage, stageIndex) => (
        <div key={stageIndex} className="flex items-center gap-3">
          {stageIndex > 0 && <span className="text-2xl text-[var(--muted)]">→</span>}
          <div className="flex flex-col gap-3">
            {stage.map((member) => (
              <Member
                key={member.id}
                member={member}
                isCurrent={member.id === currentId}
                currentLabel={d.detail.current}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
