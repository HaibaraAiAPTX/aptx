import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
const setCalls: Array<{ key: string; value: string; options?: unknown }> = [];

vi.mock("js-cookie", () => {
  return {
    default: {
      get: (key: string) => jar.get(key),
      set: (key: string, value: string, options?: unknown) => {
        jar.set(key, value);
        setCalls.push({ key, value, options });
      },
      remove: (key: string) => {
        jar.delete(key);
      },
    },
  };
});

import { CookieTokenStore, createCookieTokenStore } from "../src/index.js";

describe("CookieTokenStore", () => {
  beforeEach(() => {
    jar.clear();
    setCalls.length = 0;
  });

  it("sets and gets token", () => {
    const store = new CookieTokenStore();
    store.setToken("t1");
    expect(store.getToken()).toBe("t1");
  });

  it("stores and reads meta", () => {
    const store = new CookieTokenStore();
    store.setMeta({ expiresAt: 123, foo: "bar" });
    expect(store.getMeta()).toEqual({ expiresAt: 123, foo: "bar" });
  });

  it("clears token and meta", () => {
    const store = new CookieTokenStore();
    store.setToken("t1", { expiresAt: 1 });
    store.clearToken();
    expect(store.getToken()).toBeUndefined();
    expect(store.getMeta()).toBeUndefined();
  });

  it("supports getRecord/setRecord", () => {
    const store = new CookieTokenStore();
    store.setRecord({ token: "t2", meta: { expiresAt: 99 } });
    expect(store.getRecord()).toEqual({ token: "t2", meta: { expiresAt: 99 } });

    store.setRecord({});
    expect(store.getRecord()).toEqual({ token: undefined, meta: undefined });
  });

  it("returns undefined for invalid meta json", () => {
    jar.set("aptx_token_meta", "not-json");
    const store = new CookieTokenStore();
    expect(store.getMeta()).toBeUndefined();
  });

  it("creates store from factory", () => {
    const store = createCookieTokenStore({ tokenKey: "tk", metaKey: "mk" });
    store.setToken("v");
    expect(store.getToken()).toBe("v");
  });

  it("syncs cookie expires from meta.expiresAt", () => {
    const store = new CookieTokenStore();
    const expiresAt = Date.now() + 1000;
    store.setToken("t1", { expiresAt });
    const tokenSet = setCalls.find((x) => x.key === "aptx_token");
    expect(tokenSet).toBeDefined();
    const opts = tokenSet?.options as { expires?: Date };
    expect(opts.expires).toBeInstanceOf(Date);
    expect(opts.expires?.getTime()).toBe(expiresAt);
  });

  it("can disable expiry sync", () => {
    const store = new CookieTokenStore({ syncExpiryFromMeta: false });
    store.setToken("t1", { expiresAt: Date.now() + 1000 });
    const tokenSet = setCalls.find((x) => x.key === "aptx_token");
    const opts = tokenSet?.options as { expires?: Date } | undefined;
    expect(opts?.expires).toBeUndefined();
  });
});
