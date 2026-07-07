"use client";

import { useState } from "react";
import { useBattleSocket } from "@/hooks/use-battle-socket";
import { useI18n } from "@/lib/i18n/provider";
import { LobbyForm } from "./lobby-form";

export function BattleRoom({ roomId }: { roomId: string }) {
  const { view, error, send } = useBattleSocket(roomId);
  const { d } = useI18n();
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (error) {
    return (
      <Shell>
        <p className="readout text-sm font-bold text-[var(--pokedex-red-light)]">{error}</p>
      </Shell>
    );
  }

  if (view === null) {
    return (
      <Shell>
        <p className="readout animate-pulse text-sm text-[var(--muted)]">Connecting…</p>
      </Shell>
    );
  }

  const otherSlot = view.you === 0 ? 1 : 0;
  const opponentMissing = view.players[otherSlot] == null || view.phase === "waiting";

  if (view.phase === "waiting" || view.phase === "lobby") {
    return (
      <Shell>
        <h1 className="readout mb-6 text-center text-xl font-black uppercase tracking-widest text-[var(--scan)]">
          {d.battle.title}
        </h1>
        <LobbyForm view={view} send={send} />
        {opponentMissing && (
          <div className="mt-6 flex flex-col items-center gap-3 border-t border-white/10 pt-5 text-center">
            <p className="text-xs text-[var(--muted)]">{d.battle.shareHint}</p>
            <div className="flex w-full items-center gap-2">
              <input
                readOnly
                value={typeof window !== "undefined" ? window.location.href : ""}
                className="flex-1 truncate rounded-lg border border-white/10 bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]"
              />
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 rounded-lg bg-[var(--surface-raised)] px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-white/10"
              >
                {copied ? d.battle.copied : d.battle.copy}
              </button>
            </div>
          </div>
        )}
      </Shell>
    );
  }

  if (view.phase === "teaming") {
    return (
      <Shell>
        <p className="readout text-center text-sm font-bold text-[var(--scan)]">TEAMING…</p>
      </Shell>
    );
  }

  if (view.phase === "battle") {
    return (
      <Shell>
        <p className="readout text-center text-sm font-bold text-[var(--scan)]">BATTLE…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="readout text-center text-sm font-bold text-[var(--scan)]">FINISHED</p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-16">
      <div className="screen screen-scanlines w-full max-w-md rounded-3xl p-8">{children}</div>
    </div>
  );
}
