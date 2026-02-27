import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CookieAttributes } from "js-cookie";

const jar = new Map<string, string>();
const setCalls: Array<{ key: string; value: string; options?: unknown }> = [];
const removeCalls: Array<{ key: string; options?: unknown }> = [];

vi.mock("js-cookie", () => {
  return {
    default: {
      get: (key: string) => jar.get(key),
      set: (key: string, value: string, options?: unknown) => {
        jar.set(key, value);
        setCalls.push({ key, value, options });
      },
      remove: (key: string, options?: unknown) => {
        jar.delete(key);
        removeCalls.push({ key, options });
      },
    },
  };
});

import { CookieTokenStore, createCookieTokenStore } from "../src/index.js";

describe("CookieTokenStore", () => {
  beforeEach(() => {
    jar.clear();
    setCalls.length = 0;
    removeCalls.length = 0;
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

  it("passes cookie options to Cookies.set", () => {
    const store = new CookieTokenStore({ cookie: { path: "/", secure: true } });
    store.setToken("t1");
    const tokenSet = setCalls.find((x) => x.key === "aptx_token");
    expect(tokenSet).toBeDefined();
    const opts = tokenSet?.options as CookieAttributes;
    expect(opts.path).toBe("/");
    expect(opts.secure).toBe(true);
  });

  it("passes cookie options to Cookies.remove on clear", () => {
    const store = new CookieTokenStore({ cookie: { path: "/app" } });
    store.setToken("t1");
    store.clearToken();
    const tokenRemove = removeCalls.find((x) => x.key === "aptx_token");
    expect(tokenRemove).toBeDefined();
    expect((tokenRemove?.options as CookieAttributes).path).toBe("/app");
  });

  it.each([Infinity, NaN, -1, 0])("ignores invalid expiresAt: %s", (invalidValue) => {
    const store = new CookieTokenStore();
    store.setToken("t1", { expiresAt: invalidValue as number });
    const tokenSet = setCalls.find((x) => x.key === "aptx_token");
    expect((tokenSet?.options as { expires?: Date }).expires).toBeUndefined();
  });

  it("setToken without meta does not call setMeta", () => {
    const store = new CookieTokenStore();
    store.setToken("t1");
    const metaSet = setCalls.find((x) => x.key === "aptx_token_meta");
    expect(metaSet).toBeUndefined();
  });

  it.each([
    ["empty string", ""],
    ["null string", "null"],
    ["number string", "123"],
  ])("getMeta returns undefined for invalid meta: %s", (_desc, value) => {
    jar.set("aptx_token_meta", value);
    const store = new CookieTokenStore();
    expect(store.getMeta()).toBeUndefined();
  });

  it("getMeta accepts array as valid object (current behavior)", () => {
    jar.set("aptx_token_meta", "[]");
    const store = new CookieTokenStore();
    // Note: arrays pass `typeof === "object"` check in parseMeta
    expect(store.getMeta()).toEqual([]);
  });

  it("isolates multiple store instances", () => {
    const storeA = new CookieTokenStore({ tokenKey: "token_a", metaKey: "meta_a" });
    const storeB = new CookieTokenStore({ tokenKey: "token_b", metaKey: "meta_b" });

    storeA.setToken("token-from-a", { expiresAt: 100 });
    storeB.setToken("token-from-b", { expiresAt: 200 });

    expect(storeA.getToken()).toBe("token-from-a");
    expect(storeB.getToken()).toBe("token-from-b");
    expect(storeA.getMeta()).toEqual({ expiresAt: 100 });
    expect(storeB.getMeta()).toEqual({ expiresAt: 200 });
  });

  it("setRecord with undefined token/meta calls remove", () => {
    const store = new CookieTokenStore();
    store.setToken("existing");
    store.setMeta({ expiresAt: 1 });

    store.setRecord({ token: undefined, meta: undefined });

    const tokenRemove = removeCalls.filter((x) => x.key === "aptx_token");
    const metaRemove = removeCalls.filter((x) => x.key === "aptx_token_meta");
    expect(tokenRemove.length).toBeGreaterThanOrEqual(1);
    expect(metaRemove.length).toBeGreaterThanOrEqual(1);
  });
});
