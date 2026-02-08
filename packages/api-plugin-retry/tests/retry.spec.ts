import { describe, expect, it, vi } from "vitest";
import { createRetryMiddleware } from "../src/index.js";
import { Context } from "../../api-core/src/context";
import { Request } from "../../api-core/src/request";
import { Response } from "../../api-core/src/response";

describe("createRetryMiddleware", () => {
  it("retries the specified number of times and succeeds", async () => {
    const mw = createRetryMiddleware({ retries: 2 });
    let count = 0;

    const res = await mw.handle(
      new Request({ method: "GET", url: "https://example.com" }),
      new Context({ id: "1", signal: new AbortController().signal }),
      async () => {
        count += 1;
        if (count < 3) throw new Error("fail");
        return new Response({
          status: 200,
          headers: new Headers(),
          url: "https://example.com",
          data: "ok",
          raw: {},
        });
      },
    );

    expect(res.data).toBe("ok");
    expect(count).toBe(3);
  });

  it("respects retryOn predicate", async () => {
    const mw = createRetryMiddleware({
      retries: 2,
      retryOn: (_err, _req, ctx) => ctx.attempt === 0,
    });
    let count = 0;

    await expect(
      mw.handle(
        new Request({ method: "GET", url: "https://example.com" }),
        new Context({ id: "1", signal: new AbortController().signal }),
        async () => {
          count += 1;
          throw new Error("fail");
        },
      ),
    ).rejects.toThrow("fail");

    expect(count).toBe(2);
  });

  it("waits delayMs between retries", async () => {
    vi.useFakeTimers();
    const mw = createRetryMiddleware({ retries: 1, delayMs: 50 });
    let count = 0;

    const promise = mw.handle(
      new Request({ method: "GET", url: "https://example.com" }),
      new Context({ id: "1", signal: new AbortController().signal }),
      async () => {
        count += 1;
        throw new Error("fail");
      },
    );

    const expectation = expect(promise).rejects.toThrow("fail");
    await vi.advanceTimersByTimeAsync(50);
    await expectation;
    vi.useRealTimers();
    expect(count).toBe(2);
  });

  it("supports per-call override via req.meta.__aptxRetry", async () => {
    const mw = createRetryMiddleware({ retries: 2 });
    let count = 0;

    await expect(
      mw.handle(
        new Request({
          method: "GET",
          url: "https://example.com",
          meta: { __aptxRetry: { retries: 0 } },
        }),
        new Context({ id: "1", signal: new AbortController().signal }),
        async () => {
          count += 1;
          throw new Error("fail");
        },
      ),
    ).rejects.toThrow("fail");

    expect(count).toBe(1);
  });
});
