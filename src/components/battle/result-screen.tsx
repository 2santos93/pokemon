"use client";

import type { ClientMessage, RoomView } from "@/lib/battle/protocol";
import { useI18n } from "@/lib/i18n/provider";

export function ResultScreen({
  view,
  send,
}: {
  view: RoomView;
  send: (msg: ClientMessage) => void;
}) {
  const { d } = useI18n();
  const victory = view.winnerSlot === view.you;
  const foe = view.you === 0 ? 1 : 0;
  const opponentLeft = view.players[foe]?.connected === false;

  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      <div
        className={`readout rounded-2xl border-2 px-8 py-6 text-xl font-black uppercase tracking-widest sm:text-2xl ${
          victory
            ? "border-[var(--scan-amber)] bg-gradient-to-br from-[var(--scan)]/15 to-[var(--scan-amber)]/15 text-[var(--scan-amber)]"
            : "border-white/10 bg-[var(--surface)] text-[var(--muted)]"
        }`}
        style={
          victory
            ? {
                boxShadow:
                  "0 0 30px rgba(56,189,248,0.25), 0 0 30px rgba(255,207,92,0.25)",
              }
            : undefined
        }
      >
        {victory ? d.battle.result.victory : d.battle.result.defeat}
      </div>

      {opponentLeft && (
        <p className="text-xs text-[var(--muted)]">{d.battle.result.opponentLeft}</p>
      )}

      <button
        type="button"
        onClick={() => send({ type: "rematch" })}
        className="rounded-full bg-[var(--pokedex-red)] px-8 py-3 text-sm font-bold uppercase tracking-widest text-white transition-transform hover:-translate-y-0.5 hover:brightness-110"
      >
        {d.battle.result.rematch}
      </button>
    </div>
  );
}
