export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="h-5 w-20 animate-pulse rounded-full bg-[var(--surface-raised)]" />
        <div className="h-8 w-32 animate-pulse rounded-full bg-[var(--surface-raised)]" />
      </div>
      <div className="grid items-center gap-6 rounded-3xl border border-white/5 bg-[var(--surface)] p-6 md:grid-cols-[minmax(0,320px)_1fr] md:p-8">
        <div className="mx-auto h-56 w-56 animate-pulse rounded-full bg-[var(--surface-raised)] sm:h-72 sm:w-72" />
        <div className="flex flex-col gap-3">
          <div className="h-4 w-40 animate-pulse rounded bg-[var(--surface-raised)]" />
          <div className="h-10 w-56 animate-pulse rounded bg-[var(--surface-raised)]" />
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--surface-raised)]" />
          <div className="flex gap-2">
            <div className="h-6 w-16 animate-pulse rounded-full bg-[var(--surface-raised)]" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-[var(--surface-raised)]" />
          </div>
          <div className="h-16 w-full max-w-prose animate-pulse rounded bg-[var(--surface-raised)]" />
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="h-14 animate-pulse rounded-xl bg-[var(--surface-raised)]" />
            <div className="h-14 animate-pulse rounded-xl bg-[var(--surface-raised)]" />
            <div className="col-span-2 h-14 animate-pulse rounded-xl bg-[var(--surface-raised)] sm:col-span-1" />
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-2xl border border-white/5 bg-[var(--surface)]" />
        <div className="h-64 animate-pulse rounded-2xl border border-white/5 bg-[var(--surface)]" />
      </div>
    </div>
  );
}
