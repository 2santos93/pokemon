"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomView } from "@/lib/battle/protocol";
import type { BattleEvent, BattlePokemon, SideIndex } from "@/lib/battle/types";
import { useI18n } from "@/lib/i18n/provider";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { HpBar } from "./hp-bar";
import { BattleSprite } from "./battle-sprite";

type SpriteAnim = "" | "lunge" | "hit" | "faint";
type PerSide<T> = Record<SideIndex, T>;

const SIDES: SideIndex[] = [0, 1];

// Timing for the attack-sequence animation (ms).
const LUNGE_MS = 250;
const HIT_STAGGER_MS = 150;
const HIT_MS = 300;
const FAINT_MS = 400;
const BURST_MS = 500;

export function BattleScene({ view, events }: { view: RoomView; events: BattleEvent[] }) {
  const { d } = useI18n();
  const battle = view.battle;

  // -- Send-out tracking: remembers which team slot is active per side so we can
  // detect switches (and the very first send-out on mount) and replay the burst. --
  const activeIndexRef = useRef<PerSide<number | null>>({ 0: null, 1: null });
  const burstTimers = useRef<PerSide<ReturnType<typeof setTimeout> | null>>({ 0: null, 1: null });
  const [burst, setBurst] = useState<PerSide<boolean>>({ 0: false, 1: false });

  useEffect(() => {
    if (battle == null) return;
    for (const side of SIDES) {
      const idx = battle.sides[side].activeIndex;
      if (activeIndexRef.current[side] === idx) continue;
      activeIndexRef.current[side] = idx;
      if (burstTimers.current[side] != null) clearTimeout(burstTimers.current[side]!);
      setBurst((prev) => ({ ...prev, [side]: true }));
      burstTimers.current[side] = setTimeout(() => {
        setBurst((prev) => ({ ...prev, [side]: false }));
        burstTimers.current[side] = null;
      }, BURST_MS);
    }
  }, [battle]);

  // Clear any pending send-out timers on unmount.
  useEffect(() => {
    const timers = burstTimers.current;
    return () => {
      for (const side of SIDES) {
        if (timers[side] != null) clearTimeout(timers[side]!);
      }
    };
  }, []);

  // -- Attack sequencing: replays the latest turn's events as a readable
  // attacker-lunge -> defender-hit -> (optional faint) sequence per side. --
  const [spriteAnim, setSpriteAnim] = useState<PerSide<SpriteAnim>>({ 0: "", 1: "" });

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    const play = (side: SideIndex, anim: SpriteAnim, startAt: number, duration: number) => {
      timers.push(
        setTimeout(() => {
          setSpriteAnim((prev) => ({ ...prev, [side]: anim }));
          timers.push(
            setTimeout(() => {
              setSpriteAnim((prev) => (prev[side] === anim ? { ...prev, [side]: "" } : prev));
            }, duration),
          );
        }, startAt),
      );
    };

    let cursor = 0;
    for (const ev of events) {
      if (ev.type === "move") {
        play(ev.side, "lunge", cursor, LUNGE_MS);
        cursor += HIT_STAGGER_MS;
      } else if (ev.type === "damage") {
        play(ev.side, "hit", cursor, HIT_MS);
        cursor += HIT_MS;
      } else if (ev.type === "faint") {
        play(ev.side, "faint", cursor, FAINT_MS);
        cursor += FAINT_MS;
      }
    }

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [events]);

  if (battle == null) return null;

  const you: SideIndex = view.you;
  const foe: SideIndex = you === 0 ? 1 : 0;

  const mySide = battle.sides[you];
  const foeSide = battle.sides[foe];
  const myActive = mySide.team[mySide.activeIndex]!;
  const foeActive = foeSide.team[foeSide.activeIndex]!;

  const foeKey = `${foeSide.activeIndex}:${foeActive.id}`;
  const myKey = `${mySide.activeIndex}:${myActive.id}`;

  return (
    <div
      className="relative grid min-h-[240px] grid-cols-2 grid-rows-2 overflow-hidden rounded-2xl border border-white/10 p-3 sm:min-h-[280px] sm:p-4"
      style={{
        background:
          "linear-gradient(180deg, #8fd0ec 0%, #bfe6f7 46%, #74ab5e 46%, #4c8a45 100%)",
        boxShadow: "inset 0 0 0 3px rgba(0,0,0,0.15), inset 0 2px 12px rgba(0,0,0,0.25)",
      }}
    >
      {/* Hidden preload: warms the optimized-image cache (via BattleSprite/next/image) for every
          team member so switches render instantly and clients never hit raw.githubusercontent
          directly. Visually hidden via clipping (not display:none) so the browser still fetches. */}
      <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden="true">
        {foeSide.team.map((pokemon, i) => (
          <BattleSprite key={`preload-foe-${i}`} src={pokemon.frontSprite} alt="" />
        ))}
        {mySide.team.map((pokemon, i) => (
          <BattleSprite key={`preload-my-${i}`} src={pokemon.backSprite} alt="" />
        ))}
      </div>

      <div className="flex flex-col items-start justify-start gap-1.5">
        <InfoBox pokemon={foeActive} showNumbers={false} d={d} />
        <TeamDots team={foeSide.team} />
      </div>

      <div className="relative flex items-start justify-end">
        {burst[foe] && <PokeballBurst className="right-4 top-6 sm:right-6 sm:top-8" />}
        <BattleSprite
          key={foeKey}
          src={foeActive.frontSprite}
          alt={foeActive.name}
          className={`h-24 w-24 object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.35)] sm:h-28 sm:w-28 animate-sprite-emerge ${spriteAnimClass(
            spriteAnim[foe],
            false,
          )}`}
        />
      </div>

      <div className="relative flex items-end justify-start">
        {burst[you] && <PokeballBurst className="bottom-4 left-6 sm:bottom-6 sm:left-8" />}
        <BattleSprite
          key={myKey}
          src={myActive.backSprite}
          alt={myActive.name}
          className={`h-28 w-28 object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.35)] sm:h-32 sm:w-32 animate-sprite-emerge ${spriteAnimClass(
            spriteAnim[you],
            true,
          )}`}
        />
      </div>

      <div className="flex flex-col items-end justify-end gap-1.5">
        <InfoBox pokemon={myActive} showNumbers d={d} />
        <TeamDots team={mySide.team} align="end" />
      </div>
    </div>
  );
}

function spriteAnimClass(anim: SpriteAnim, isPlayerSide: boolean): string {
  switch (anim) {
    case "lunge":
      return isPlayerSide ? "animate-attack-lunge-player" : "animate-attack-lunge-foe";
    case "hit":
      return "animate-hit-shake animate-hit-flash";
    case "faint":
      return "animate-faint-drop";
    default:
      return "";
  }
}

function PokeballBurst({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`animate-pokeball-burst pointer-events-none absolute z-10 h-5 w-5 rounded-full border-2 border-black/70 ${className}`}
      style={{
        background:
          "linear-gradient(180deg, #ef4444 0%, #ef4444 46%, #111 46%, #111 54%, #f8fafc 54%, #f8fafc 100%)",
        boxShadow: "0 0 14px 4px rgba(255,255,255,0.85)",
      }}
    />
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
