import { describe, it, expect } from "vitest";
import { Mutex } from "../mutex.js";

describe("Mutex", () => {
  it("serializes concurrent acquire calls", async () => {
    const mutex = new Mutex();
    const order: number[] = [];

    const task = async (id: number, delayMs: number) => {
      const release = await mutex.acquire();
      order.push(id);
      await new Promise((r) => setTimeout(r, delayMs));
      release();
    };

    const p1 = task(1, 50);
    const p2 = task(2, 10);
    const p3 = task(3, 10);

    await Promise.all([p1, p2, p3]);

    expect(order).toEqual([1, 2, 3]);
  });

  it("maintains FIFO ordering", async () => {
    const mutex = new Mutex();
    const order: number[] = [];

    const release1 = await mutex.acquire();

    const p2 = mutex.acquire().then((release) => {
      order.push(2);
      release();
    });

    const p3 = mutex.acquire().then((release) => {
      order.push(3);
      release();
    });

    // Small delay to ensure p2 and p3 are queued
    await new Promise((r) => setTimeout(r, 10));

    order.push(1);
    release1();

    await Promise.all([p2, p3]);

    expect(order).toEqual([1, 2, 3]);
  });

  it("allows re-acquisition after release", async () => {
    const mutex = new Mutex();

    const release1 = await mutex.acquire();
    release1();

    const release2 = await mutex.acquire();
    release2();
  });

  it("double release is safe", async () => {
    const mutex = new Mutex();
    const release = await mutex.acquire();
    release();
    release(); // should not throw

    // Should still be acquirable
    const release2 = await mutex.acquire();
    release2();
  });
});
