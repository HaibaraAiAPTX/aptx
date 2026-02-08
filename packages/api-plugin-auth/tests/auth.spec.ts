import { describe, expect, it } from "vitest";
import { createAuthController, createAuthMiddleware } from "../src/index.js";
import { Context } from "../../api-core/src/context";
import { Request } from "../../api-core/src/request";
import { Response } from "../../api-core/src/response";
import { HttpError } from "../../api-core/src/errors";
import type { TokenStore } from "../../token-store/src/index";

describe("auth controller", () => {
  it("refreshes when token is near expiry and calls setToken", async () => {
    let stored = "old";
    let expiresAt = Date.now() + 10;
    const store: TokenStore = {
      getToken: () => stored,
      setToken: (t, meta) => {
        stored = t;
        if (meta?.expiresAt) expiresAt = meta.expiresAt;
      },
      clearToken: () => {},
      getMeta: () => ({ expiresAt }),
    };
    const controller = createAuthController({
      store,
      refreshLeewayMs: 1000,
      refreshToken: async () => ({ token: "new", expiresAt: Date.now() + 10000 }),
    });

    const token = await controller.ensureValidToken();
    expect(token).toBe("new");
    expect(stored).toBe("new");
    expect(expiresAt).toBeGreaterThan(Date.now());
  });
});

describe("auth middleware", () => {
  it("refreshes on 401 and retries once", async () => {
    let token = "t0";
    const store: TokenStore = {
      getToken: () => token,
      setToken: (t) => {
        token = t;
      },
      clearToken: () => {},
    };
    const mw = createAuthMiddleware({
      store,
      refreshToken: async () => "t1",
      maxRetry: 1,
    });

    let call = 0;
    const res = await mw.handle(
      new Request({ method: "GET", url: "https://example.com" }),
      new Context({ id: "1", signal: new AbortController().signal }),
      async () => {
        call += 1;
        if (call === 1) {
          throw new HttpError("HTTP 401", 401, "https://example.com");
        }
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
    expect(token).toBe("t1");
    expect(call).toBe(2);
  });

  it("calls clearToken and onRefreshFailed when refresh fails", async () => {
    let cleared = false;
    let failed = false;
    const store: TokenStore = {
      getToken: () => "t0",
      setToken: () => {},
      clearToken: () => {
        cleared = true;
      },
    };
    const mw = createAuthMiddleware({
      store,
      onRefreshFailed: () => {
        failed = true;
      },
      refreshToken: async () => {
        throw new Error("refresh failed");
      },
    });

    await expect(
      mw.handle(
        new Request({ method: "GET", url: "https://example.com" }),
        new Context({ id: "1", signal: new AbortController().signal }),
        async () => {
          throw new HttpError("HTTP 401", 401, "https://example.com");
        },
      ),
    ).rejects.toThrow("refresh failed");

    expect(cleared).toBe(true);
    expect(failed).toBe(true);
  });
});
