export function CardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[var(--screen-raised)] p-4">
      <div className="h-24 w-24 rounded-full bg-white/5" />
      <div className="h-3 w-20 rounded bg-white/10" />
      <div className="h-2 w-12 rounded bg-white/5" />
    </div>
  );
}
