"use client";

import { useEffect, useRef, useState } from "react";

// Visualizes turnDeadline (epoch ms); server is authoritative and resolves on expiry.
export function TurnTimer({
  deadline,
  className,
}: {
  deadline: number | null;
  className?: string;
}) {
  const [remainingMs, setRemainingMs] = useState(0);
  // First-observed remaining time, so the bar scales to any turn length.
  const totalRef = useRef(1);

  useEffect(() => {
    if (deadline == null) return;
    totalRef.current = Math.max(1000, deadline - Date.now());
    const tick = () => setRemainingMs(Math.max(0, deadline - Date.now()));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);

  if (deadline == null) return null;

  const seconds = Math.ceil(remainingMs / 1000);
  const pct = Math.max(0, Math.min(100, (remainingMs / totalRef.current) * 100));
  const low = remainingMs <= 5000;

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ease-linear"
          style={{ width: `${pct}%`, background: low ? "var(--pokedex-red)" : "var(--scan)" }}
        />
      </div>
      <span
        className={`readout w-5 shrink-0 text-right text-xs font-bold tabular-nums ${
          low ? "text-[var(--pokedex-red-light)]" : "text-[var(--muted)]"
        }`}
      >
        {seconds}
      </span>
    </div>
  );
}
