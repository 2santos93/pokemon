import { describe, expect, it } from "vitest";
import { inBatches } from "./batch";

describe("inBatches", () => {
  it("processes every item, preserving order", async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const result = await inBatches(items, 3, async (n) => n * 2);
    expect(result).toEqual(items.map((n) => n * 2));
  });
  it("never runs more than `size` tasks concurrently", async () => {
    let running = 0;
    let peak = 0;
    await inBatches(Array.from({ length: 12 }, (_, i) => i), 4, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
    });
    expect(peak).toBeLessThanOrEqual(4);
  });
});
