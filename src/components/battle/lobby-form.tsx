"use client";

import { useState } from "react";
import type { ClientMessage, Gender, RoomView } from "@/lib/battle/protocol";
import { useI18n } from "@/lib/i18n/provider";
import { TrainerAvatar } from "./trainer-avatar";

const GENDERS: Gender[] = ["male", "female"];

export function LobbyForm({
  view,
  send,
}: {
  view: RoomView;
  send: (msg: ClientMessage) => void;
}) {
  const { d } = useI18n();
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<Gender>("male");

  const you = view.players[view.you];
  const alreadySubmitted = Boolean(you?.nickname);

  if (alreadySubmitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span
          aria-hidden
          className="h-4 w-4 rounded-full bg-[var(--scan)]"
          style={{ animation: "blink 1.6s ease-in-out infinite" }}
        />
        <p className="readout text-sm font-bold text-[var(--foreground)]">
          {d.battle.waitingOpponent}
        </p>
      </div>
    );
  }

  const ready = nickname.trim().length > 0;

  const submit = () => {
    if (!ready) return;
    send({ type: "setProfile", nickname: nickname.trim(), gender });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="trainer-nickname" className="readout text-xs uppercase tracking-widest text-[var(--muted)]">
          {d.battle.nickname}
        </label>
        <input
          id="trainer-nickname"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={d.battle.nicknamePlaceholder}
          maxLength={16}
          className="rounded-xl border border-white/10 bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--scan)]/50"
        />
      </div>

      <div className="flex gap-3">
        {GENDERS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGender(g)}
            aria-pressed={gender === g}
            className={`flex flex-1 flex-col items-center gap-2 rounded-xl border p-3 transition-colors ${
              gender === g
                ? "border-[var(--scan)] bg-[var(--surface-raised)] shadow-[0_0_18px_rgba(56,189,248,0.25)]"
                : "border-white/10 bg-[var(--surface)] hover:border-white/25"
            }`}
          >
            <TrainerAvatar gender={g} className="h-12 w-12" />
            <span className="text-xs font-bold">{d.battle.gender[g]}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!ready}
        className="rounded-full bg-[var(--pokedex-red)] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
      >
        {d.battle.ready}
      </button>
    </div>
  );
}
