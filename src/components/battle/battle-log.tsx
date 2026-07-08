"use client";

import type { RoomView } from "@/lib/battle/protocol";
import type { BattleEvent } from "@/lib/battle/types";
import { describeEvent } from "@/lib/battle/describe-event";
import { useI18n } from "@/lib/i18n/provider";

export function BattleLog({
  view,
  events,
}: {
  view: RoomView;
  events: BattleEvent[];
}) {
  const { d } = useI18n();

  const lines = events.flatMap((event) => describeEvent(event, d));
  const myTurn = view.awaiting.includes(view.you);
  const displayLines = lines.length > 0 ? lines : myTurn ? [d.battle.yourTurn] : [];

  return (
    <div
      className="readout mt-3 min-h-[4.5rem] rounded-xl border border-white/10 bg-[var(--screen-raised)] px-4 py-3 text-xs leading-relaxed text-[var(--foreground)]"
      style={{ boxShadow: "inset 0 2px 8px rgba(0,0,0,0.6)" }}
    >
      {displayLines.length === 0 ? (
        <span className="text-[var(--muted)]">&nbsp;</span>
      ) : (
        displayLines.map((line, i) => <p key={i}>{line}</p>)
      )}
    </div>
  );
}
