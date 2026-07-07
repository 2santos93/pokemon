"use client";

import Image from "next/image";
import type { RoomView } from "@/lib/battle/protocol";
import type { BattlePokemon, SideIndex } from "@/lib/battle/types";
import { useI18n } from "@/lib/i18n/provider";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { HpBar } from "./hp-bar";

export function BattleScene({ view }: { view: RoomView }) {
  const { d } = useI18n();
  if (view.battle == null) return null;

  const you: SideIndex = view.you;
  const foe: SideIndex = you === 0 ? 1 : 0;

  const mySide = view.battle.sides[you];
  const foeSide = view.battle.sides[foe];
  const myActive = mySide.team[mySide.activeIndex]!;
  const foeActive = foeSide.team[foeSide.activeIndex]!;

  return (
    <div
      className="relative grid min-h-[240px] grid-cols-2 grid-rows-2 overflow-hidden rounded-2xl border border-white/10 p-3 sm:min-h-[280px] sm:p-4"
      style={{
        background:
          "linear-gradient(180deg, #8fd0ec 0%, #bfe6f7 46%, #74ab5e 46%, #4c8a45 100%)",
        boxShadow: "inset 0 0 0 3px rgba(0,0,0,0.15), inset 0 2px 12px rgba(0,0,0,0.25)",
      }}
    >
      <div className="flex flex-col items-start justify-start gap-1.5">
        <InfoBox pokemon={foeActive} showNumbers={false} d={d} />
        <TeamDots team={foeSide.team} />
      </div>

      <div className="flex items-start justify-end">
        <Image
          src={foeActive.frontSprite}
          alt={foeActive.name}
          width={112}
          height={112}
          unoptimized
          className="h-24 w-24 object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.35)] sm:h-28 sm:w-28"
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      <div className="flex items-end justify-start">
        <Image
          src={myActive.backSprite}
          alt={myActive.name}
          width={128}
          height={128}
          unoptimized
          className="h-28 w-28 object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.35)] sm:h-32 sm:w-32"
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      <div className="flex flex-col items-end justify-end gap-1.5">
        <InfoBox pokemon={myActive} showNumbers d={d} />
        <TeamDots team={mySide.team} align="end" />
      </div>
    </div>
  );
}

function InfoBox({
  pokemon,
  showNumbers,
  d,
}: {
  pokemon: BattlePokemon;
  showNumbers: boolean;
  d: Dictionary;
}) {
  return (
    <div
      className="w-full max-w-[200px] rounded-xl border border-white/10 bg-[var(--screen-raised)]/95 px-3 py-2 shadow-[0_4px_10px_rgba(0,0,0,0.35)] backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-bold capitalize text-[var(--foreground)]">
          {pokemon.name}
        </span>
        <span className="readout shrink-0 text-[10px] font-bold text-[var(--muted)]">
          {d.battle.lv} {pokemon.level}
        </span>
      </div>
      <div className="mt-1">
        <HpBar current={pokemon.currentHp} max={pokemon.maxHp} showNumbers={showNumbers} />
      </div>
      {pokemon.status !== "none" && (
        <span className="mt-1 inline-block rounded-full bg-[var(--scan-amber)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black/80">
          {d.battle.status[pokemon.status]}
        </span>
      )}
    </div>
  );
}

function TeamDots({
  team,
  align = "start",
}: {
  team: BattlePokemon[];
  align?: "start" | "end";
}) {
  return (
    <div className={`flex gap-1 ${align === "end" ? "justify-end" : "justify-start"}`}>
      {team.map((pokemon, i) => (
        <span
          key={i}
          aria-hidden
          className={`h-2 w-2 rounded-full border border-black/40 ${
            pokemon.currentHp > 0 ? "bg-white" : "bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}
