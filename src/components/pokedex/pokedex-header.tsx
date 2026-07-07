"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { LanguageToggle } from "./language-toggle";

const SMALL_LIGHTS = [
  { color: "#ff4d4d", delay: "0s" },
  { color: "#ffd93b", delay: "0.4s" },
  { color: "#4ade80", delay: "0.8s" },
] as const;

export function PokedexHeader() {
  const { d } = useI18n();
  return (
    <header className="device-shell sticky top-0 z-40 border-b-2 border-[var(--pokedex-red-dark)]">
      {/* corner rivets */}
      <span className="rivet absolute left-2 top-2" />
      <span className="rivet absolute right-2 top-2" />

      <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3 sm:px-8">
        <Link href="/" className="group flex items-center gap-3" aria-label={d.app.title}>
          {/* Big camera lens sensor */}
          <span className="relative flex h-11 w-11 items-center justify-center">
            <span
              className="h-11 w-11 rounded-full border-[3px] border-white/80 bg-[radial-gradient(circle_at_32%_28%,#bfe9ff,#1d6fe0_55%,#0b3aa0)]"
              style={{ animation: "sensor-pulse 2.6s ease-in-out infinite" }}
            />
            <span className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full bg-white/80 blur-[1px]" />
          </span>
          {/* status LEDs */}
          <span className="mb-6 flex gap-1.5">
            {SMALL_LIGHTS.map((light) => (
              <span
                key={light.color}
                className="h-3 w-3 rounded-full border border-black/25"
                style={{
                  background: light.color,
                  boxShadow: `0 0 8px ${light.color}`,
                  animation: `blink 3s linear infinite ${light.delay}`,
                }}
              />
            ))}
          </span>
          <span className="ml-1 flex flex-col leading-tight">
            <span className="readout text-base font-black tracking-tight text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.4)] sm:text-lg">
              {d.app.title}
            </span>
            <span className="mt-1 hidden text-[10px] font-semibold uppercase tracking-widest text-white/80 sm:block">
              {d.app.tagline}
            </span>
          </span>
        </Link>

        {/* speaker grille (decorative) */}
        <span
          aria-hidden
          className="grille mx-auto hidden h-8 w-28 rounded-md opacity-60 md:block"
        />

        <div className="ml-auto">
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}
