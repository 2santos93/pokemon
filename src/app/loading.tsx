import { CardSkeleton } from "@/components/pokedex/card-skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="h-10 w-full max-w-md animate-pulse rounded-full bg-[var(--surface-raised)]" />
      <div className="h-20 animate-pulse rounded-xl bg-[var(--surface)]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 18 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
