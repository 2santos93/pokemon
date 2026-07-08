export function HpBar({
  current,
  max,
  showNumbers = false,
}: {
  current: number;
  max: number;
  showNumbers?: boolean;
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const color = ratio > 0.5 ? "#4ade80" : ratio > 0.2 ? "#fbbf24" : "#f87171";

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className="readout text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">
          HP
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/40 ring-1 ring-black/20">
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${ratio * 100}%`, background: color }}
          />
        </div>
      </div>
      {showNumbers && (
        <span className="readout self-end text-[10px] font-bold text-[var(--foreground)]">
          {current}/{max}
        </span>
      )}
    </div>
  );
}
