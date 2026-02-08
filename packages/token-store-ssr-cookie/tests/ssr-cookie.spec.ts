import { beforeEach, describe, expect, it } from "vitest";

import { SsrCookieTokenStore } from "../src/index.js";

describe("SsrCookieTokenStore", () => {
  let cookieHeader: string | undefined;
  const setCookieCalls: string[] = [];

  beforeEach(() => {
    cookieHeader = undefined;
    setCookieCalls.length = 0;
  });

  it("reads token from Cookie header", () => {
    cookieHeader = "aptx_token=t1; other=x";
    const store = new SsrCookieTokenStore({
      getCookieHeader: () => cookieHeader,
      setCookie: (v) => setCookieCalls.push(v),
    });
    expect(store.getToken()).toBe("t1");
  });

  it("writes Set-Cookie on setToken and clearToken", () => {
    const store = new SsrCookieTokenStore({
      getCookieHeader: () => cookieHeader,
      setCookie: (v) => setCookieCalls.push(v),
      cookie: { path: "/", httpOnly: true },
    });

    store.setToken("t1", { expiresAt: 123 });
    expect(setCookieCalls.some((x) => x.startsWith("aptx_token=t1"))).toBe(true);
    expect(setCookieCalls.some((x) => x.startsWith("aptx_token_meta="))).toBe(true);

    store.clearToken();
    expect(setCookieCalls.filter((x) => x.startsWith("aptx_token=")).length).toBeGreaterThan(0);
    expect(setCookieCalls.filter((x) => x.startsWith("aptx_token_meta=")).length).toBeGreaterThan(0);
  });
});

