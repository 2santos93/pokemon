"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";

export default function BattleLandingPage() {
  const { d } = useI18n();
  const router = useRouter();

  const createBattle = () => {
    const roomId = crypto.randomUUID().slice(0, 8);
    router.push(`/battle/${roomId}`);
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 py-16">
      <div className="screen screen-scanlines w-full max-w-md rounded-3xl p-8 text-center">
        <h1 className="readout relative z-10 text-2xl font-black uppercase tracking-widest text-[var(--scan)]">
          {d.battle.title}
        </h1>
        <p className="relative z-10 mt-4 text-sm text-[var(--muted)]">{d.battle.landingHint}</p>
        <button
          type="button"
          onClick={createBattle}
          className="relative z-10 mt-8 rounded-full bg-[var(--pokedex-red)] px-8 py-3 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5 hover:brightness-110"
        >
          {d.battle.create}
        </button>
      </div>
    </div>
  );
}
