"use client";

import type { ClientMessage, RoomView } from "@/lib/battle/protocol";
import { useI18n } from "@/lib/i18n/provider";
import { TypeBadge } from "@/components/pokedex/type-badge";
import { TYPE_COLORS } from "@/components/pokedex/type-colors";
import { BattleSprite } from "./battle-sprite";

export function TeamSelect({
  view,
  send,
}: {
  view: RoomView;
  send: (msg: ClientMessage) => void;
}) {
  const { d } = useI18n();
  const you = view.players[view.you];

  if (you?.lead != null) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span
          aria-hidden
          className="h-4 w-4 rounded-full bg-[var(--scan)]"
          style={{ animation: "blink 1.6s ease-in-out infinite" }}
        />
        <p className="readout text-sm font-bold text-[var(--foreground)]">{d.battle.waitingLead}</p>
      </div>
    );
  }

  if (view.yourTeam == null) {
    return <p className="readout text-center text-sm text-[var(--muted)]">…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="readout text-xl font-black uppercase tracking-widest text-[var(--scan)]">
          {d.battle.chooseLead}
        </h1>
        <p className="mt-1 text-xs uppercase tracking-wide text-[var(--muted)]">{d.battle.yourTeam}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {view.yourTeam.map((pokemon, i) => {
          const accent = TYPE_COLORS[pokemon.types[0] ?? "normal"];
          return (
            <button
              key={pokemon.id}
              type="button"
              onClick={() => send({ type: "chooseLead", teamIndex: i })}
              className="group relative flex flex-col items-center overflow-hidden rounded-2xl border border-white/10 bg-[var(--screen-raised)] p-4 text-left transition-all duration-200 hover:-translate-y-1.5 hover:border-white/25"
              style={{ boxShadow: "0 6px 18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)" }}
            >
              {/* type-colored energy glow behind the sprite */}
              <div
                className="pointer-events-none absolute inset-0 opacity-30 transition-opacity duration-200 group-hover:opacity-60"
                style={{ background: `radial-gradient(130px 130px at 50% 32%, ${accent}, transparent 70%)` }}
              />

              <BattleSprite
                src={pokemon.frontSprite}
                alt={pokemon.name}
                className="relative z-10 h-24 w-24 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.5)] transition-transform duration-200 group-hover:scale-110"
              />

              <h2 className="relative z-10 mt-1 text-sm font-bold capitalize">{pokemon.name}</h2>
              <span className="readout relative z-10 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                {d.battle.lv} {pokemon.level}
              </span>

              <div className="relative z-10 mt-2 flex flex-wrap justify-center gap-1">
                {pokemon.types.map((type) => (
                  <TypeBadge key={type} type={type} />
                ))}
              </div>

              <div className="relative z-10 mt-1 flex items-center gap-3 text-[10px] text-[var(--muted)]">
                <span>
                  {d.stats.hp} {pokemon.stats.hp}
                </span>
                <span>
                  {d.stats.attack} {pokemon.stats.attack}
                </span>
              </div>

              <div className="relative z-10 mt-3 grid w-full grid-cols-2 gap-1.5">
                {pokemon.moves.map((slot) => (
                  <span
                    key={slot.move.id}
                    className="truncate rounded-full px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
                    style={{ background: TYPE_COLORS[slot.move.type], textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
                    title={slot.move.name}
                  >
                    {slot.move.name}
                  </span>
                ))}
              </div>

              <span className="relative z-10 mt-4 w-full rounded-full bg-[var(--pokedex-red)] px-4 py-2 text-center text-xs font-bold uppercase tracking-wide text-white transition-transform group-hover:brightness-110">
                {d.battle.chooseLead}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
