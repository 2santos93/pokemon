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
    <header className="sticky top-0 z-40 border-b-4 border-[var(--pokedex-red-dark)] bg-gradient-to-b from-[#e11d48] to-[var(--pokedex-red)] shadow-lg shadow-black/40">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label={d.app.title}>
          <span
            className="h-10 w-10 rounded-full border-4 border-white/70 bg-gradient-to-br from-sky-300 to-blue-600"
            style={{ animation: "sensor-pulse 2.4s ease-in-out infinite" }}
          />
          <span className="flex gap-1.5">
            {SMALL_LIGHTS.map((light) => (
              <span
                key={light.color}
                className="mt-[-14px] h-2.5 w-2.5 rounded-full border border-black/20"
                style={{
                  background: light.color,
                  animation: `blink 3s linear infinite ${light.delay}`,
                }}
              />
            ))}
          </span>
          <span className="ml-1 flex flex-col leading-tight">
            <span className="text-xl font-black tracking-wide text-white drop-shadow">
              {d.app.title}
            </span>
            <span className="hidden text-[11px] font-medium text-white/80 sm:block">
              {d.app.tagline}
            </span>
          </span>
        </Link>
        <div className="ml-auto">
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}
