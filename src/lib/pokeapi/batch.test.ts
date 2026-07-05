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
    await inBatches(
      Array.from({ length: 12 }, (_, i) => i),
      4,
      async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
      },
    );
    expect(peak).toBeLessThanOrEqual(4);
  });
  it("rejects with the first task's error when multiple tasks in a batch reject", async () => {
    const items = [0, 1, 2, 3];
    await expect(
      inBatches(items, 4, async (n) => {
        if (n === 1) throw new Error("first failure");
        if (n === 3) throw new Error("second failure");
        return n;
      }),
    ).rejects.toThrow("first failure");
  });
});
