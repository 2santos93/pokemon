/** Runs `task` over `items` in sequential batches of `size` to avoid hammering the API. */
export async function inBatches<T, R>(
  items: readonly T[],
  size: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += size) {
    const batch = items.slice(start, start + size);
    // allSettled, not all(): all() would leave sibling rejections in the batch unhandled.
    const settled = await Promise.allSettled(batch.map(task));
    const rejected = settled.find(
      (outcome): outcome is PromiseRejectedResult => outcome.status === "rejected",
    );
    if (rejected) throw rejected.reason;
    results.push(...settled.map((outcome) => (outcome as PromiseFulfilledResult<R>).value));
  }
  return results;
}
