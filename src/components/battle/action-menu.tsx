"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { ClientMessage, RoomView } from "@/lib/battle/protocol";
import { useI18n } from "@/lib/i18n/provider";
import { TYPE_COLORS } from "@/components/pokedex/type-colors";
import { HpBar } from "./hp-bar";

type Mode = "root" | "fight" | "switch";

export function ActionMenu({
  view,
  send,
}: {
  view: RoomView;
  send: (msg: ClientMessage) => void;
}) {
  const { d } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("root");

  if (view.battle == null) return null;

  const myTurn = view.awaiting.includes(view.you);
  if (!myTurn) {
    return (
      <div className="readout mt-3 rounded-xl border border-white/10 bg-[var(--surface)] px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
        {d.battle.opponentTurn}
      </div>
    );
  }

  const mySide = view.battle.sides[view.you];
  const activeMon = mySide.team[mySide.activeIndex]!;
  const forced = view.battle.forcedSwitch[view.you];

  const runAway = () => {
    if (window.confirm(d.battle.runConfirm)) {
      send({ type: "forfeit" });
      router.push("/");
    }
  };

  const switchTargets = mySide.team
    .map((pokemon, teamIndex) => ({ pokemon, teamIndex }))
    .filter(({ pokemon, teamIndex }) => teamIndex !== mySide.activeIndex && pokemon.currentHp > 0);

  if (forced || mode === "switch") {
    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-[var(--surface)] p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {switchTargets.map(({ pokemon, teamIndex }) => (
            <button
              key={`${pokemon.id}-${teamIndex}`}
              type="button"
              onClick={() => send({ type: "action", action: { kind: "switch", teamIndex } })}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-[var(--surface-raised)] p-2 text-left transition-colors hover:border-white/25"
            >
              <Image
                src={pokemon.frontSprite}
                alt={pokemon.name}
                width={32}
                height={32}
                unoptimized
                className="h-8 w-8 shrink-0 object-contain"
                style={{ imageRendering: "pixelated" }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold capitalize text-[var(--foreground)]">
                  {pokemon.name}
                </p>
                <HpBar current={pokemon.currentHp} max={pokemon.maxHp} />
              </div>
            </button>
          ))}
        </div>
        {!forced && (
          <button
            type="button"
            onClick={() => setMode("root")}
            className="mt-2 w-full rounded-lg border border-white/10 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--muted)] transition-colors hover:border-white/25"
          >
            ←
          </button>
        )}
      </div>
    );
  }

  if (mode === "fight") {
    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-[var(--surface)] p-3">
        <div className="grid grid-cols-2 gap-2">
          {activeMon.moves.map((slot, moveIndex) => {
            const disabled = slot.pp === 0;
            return (
              <button
                key={`${slot.move.id}-${moveIndex}`}
                type="button"
                disabled={disabled}
                title={disabled ? d.battle.noPp : undefined}
                onClick={() => send({ type: "action", action: { kind: "move", moveIndex } })}
                className="flex flex-col items-start gap-1 rounded-lg border border-white/10 bg-[var(--surface-raised)] p-2 text-left transition-colors hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="text-xs font-bold capitalize text-[var(--foreground)]">
                  {slot.move.name}
                </span>
                <div className="flex w-full items-center justify-between">
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase text-white"
                    style={{ background: TYPE_COLORS[slot.move.type] }}
                  >
                    {d.types[slot.move.type]}
                  </span>
                  <span className="readout text-[10px] text-[var(--muted)]">
                    {slot.pp}/{slot.move.pp}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setMode("root")}
          className="mt-2 w-full rounded-lg border border-white/10 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--muted)] transition-colors hover:border-white/25"
        >
          ←
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-[var(--surface)] p-3">
      <button
        type="button"
        onClick={() => setMode("fight")}
        className="rounded-lg border-2 border-[var(--pokedex-red)] bg-[var(--surface-raised)] py-3 text-sm font-black uppercase tracking-widest text-[var(--foreground)] transition-transform hover:-translate-y-0.5"
      >
        {d.battle.fight}
      </button>
      <button
        type="button"
        onClick={() => setMode("switch")}
        className="rounded-lg border-2 border-[var(--scan)] bg-[var(--surface-raised)] py-3 text-sm font-black uppercase tracking-widest text-[var(--foreground)] transition-transform hover:-translate-y-0.5"
      >
        {d.battle.switchLabel}
      </button>
      <button
        type="button"
        onClick={runAway}
        className="col-span-2 rounded-lg border border-white/10 bg-[var(--surface-raised)] py-2 text-xs font-bold uppercase tracking-widest text-[var(--muted)] transition-colors hover:border-white/25"
      >
        {d.battle.run}
      </button>
    </div>
  );
}
