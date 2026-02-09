import { describe, expect, it, vi } from "vitest";
import { Request } from "../src/request";
import { Response as CoreResponse } from "../src/response";
import { DefaultUrlResolver } from "../src/defaults/urlResolver";
import { DefaultBodySerializer } from "../src/defaults/bodySerializer";
import { DefaultResponseDecoder } from "../src/defaults/responseDecoder";
import { HttpError, TimeoutError } from "../src/errors";
import { RequestClient } from "../src/client";
import { createBagKey } from "../src/types";

describe("Request/Response immutability", () => {
  it("does not allow external mutation of request headers", () => {
    const req = new Request({
      method: "GET",
      url: "https://example.com",
      headers: { "X-Test": "1" },
    });

    const h1 = req.headers;
    h1.set("X-Test", "2");

    expect(req.headers.get("X-Test")).toBe("1");
  });

  it("supports header removal in Request.with", () => {
    const req = new Request({
      method: "GET",
      url: "https://example.com",
      headers: { "X-Test": "1", "X-Remove": "x" },
    });

    const next = req.with({ headers: { "X-Remove": null } });
    expect(next.headers.get("X-Test")).toBe("1");
    expect(next.headers.get("X-Remove")).toBeNull();
  });

  it("merges headers from Headers patches in Request.with", () => {
    const req = new Request({
      method: "GET",
      url: "https://example.com",
      headers: { "X-Base": "1" },
    });

    const patchHeaders = new Headers({ "X-Patched": "2" });
    const next = req.with({ headers: patchHeaders });
    expect(next.headers.get("X-Base")).toBe("1");
    expect(next.headers.get("X-Patched")).toBe("2");
  });

  it("merges headers from Headers and array formats", () => {
    const req = new Request({
      method: "GET",
      url: "https://example.com",
      headers: new Headers({ "X-A": "1" }),
    });

    const next = req.with({ headers: [["X-B", "2"]] });
    expect(next.headers.get("X-A")).toBe("1");
    expect(next.headers.get("X-B")).toBe("2");
  });

  it("does not allow external mutation of response headers", () => {
    const res = new CoreResponse({
      status: 200,
      headers: new Headers({ "X-Resp": "1" }),
      url: "https://example.com",
      data: { ok: true },
      raw: {},
    });

    const h1 = res.headers;
    h1.set("X-Resp", "2");

    expect(res.headers.get("X-Resp")).toBe("1");
  });
});

describe("DefaultUrlResolver", () => {
  it("throws on relative URL without baseURL", () => {
    const resolver = new DefaultUrlResolver();
    const req = new Request({ method: "GET", url: "/path" });
    expect(() => resolver.resolve(req, {} as any)).toThrow("Relative URL is not allowed without baseURL");
  });

  it("resolves baseURL and query", () => {
    const resolver = new DefaultUrlResolver("https://api.example.com");
    const req = new Request({
      method: "GET",
      url: "/user",
      query: { a: 1, b: "x" },
    });
    const url = resolver.resolve(req, {} as any);
    expect(url).toMatch("https://api.example.com/user");
    expect(url).toMatch("a=1");
    expect(url).toMatch("b=x");
  });

  it("uses custom query serializer when provided", () => {
    const resolver = new DefaultUrlResolver("https://api.example.com", (query, url) => {
      if (query instanceof URLSearchParams) {
        query.set("custom", "1");
      }
      return `${url}?custom=1`;
    });
    const req = new Request({
      method: "GET",
      url: "/user",
      query: new URLSearchParams({ a: "1" }),
    });
    const url = resolver.resolve(req, {} as any);
    expect(url).toBe("https://api.example.com/user?custom=1");
  });

  it("serializes array query values", () => {
    const resolver = new DefaultUrlResolver("https://api.example.com");
    const req = new Request({
      method: "GET",
      url: "/items",
      query: { tag: ["a", "b"] },
    });
    const url = resolver.resolve(req, {} as any);
    expect(url).toContain("tag=a");
    expect(url).toContain("tag=b");
  });
});

describe("DefaultBodySerializer", () => {
  it("does not overwrite existing content-type", () => {
    const serializer = new DefaultBodySerializer();
    const req = new Request({
      method: "POST",
      url: "https://example.com",
      headers: { "content-type": "application/custom" },
      body: { a: 1 },
    });
    const result = serializer.serialize(req, {} as any);
    expect(result.headers).toBeUndefined();
    expect(result.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("sets content-type for JSON bodies when missing", () => {
    const serializer = new DefaultBodySerializer();
    const req = new Request({
      method: "POST",
      url: "https://example.com",
      body: { a: 1 },
    });
    const result = serializer.serialize(req, {} as any);
    expect(result.headers).toEqual({ "content-type": "application/json" });
  });

  it("passes through string and URLSearchParams bodies", () => {
    const serializer = new DefaultBodySerializer();
    const textReq = new Request({
      method: "POST",
      url: "https://example.com",
      body: "plain",
    });
    const textResult = serializer.serialize(textReq, {} as any);
    expect(textResult.body).toBe("plain");

    const params = new URLSearchParams({ a: "1" });
    const paramReq = new Request({
      method: "POST",
      url: "https://example.com",
      body: params,
    });
    const paramResult = serializer.serialize(paramReq, {} as any);
    expect(paramResult.body).toBe(params);
  });
});

describe("DefaultResponseDecoder", () => {
  it("throws HttpError with headers on non-2xx", async () => {
    const decoder = new DefaultResponseDecoder();
    const raw = new Response(JSON.stringify({ msg: "bad" }), {
      status: 400,
      headers: { "content-type": "application/json", "x-err": "1" },
    });
    const transport = {
      status: 400,
      headers: raw.headers,
      url: "https://example.com",
      raw,
    };

    await expect(
      decoder.decode(new Request({ method: "GET", url: "https://example.com" }), transport, {} as any),
    ).rejects.toBeInstanceOf(HttpError);

    try {
      await decoder.decode(
        new Request({ method: "GET", url: "https://example.com" }),
        transport,
        {} as any,
      );
    } catch (err) {
      const httpErr = err as HttpError;
      expect(httpErr.status).toBe(400);
      expect(httpErr.headers?.get("x-err")).toBe("1");
      expect(httpErr.bodyPreview).toEqual({ msg: "bad" });
    }
  });

  it("throws when strictDecode is enabled and response type cannot be determined", async () => {
    const decoder = new DefaultResponseDecoder({ strictDecode: true });
    const raw = new Response("ok", {
      status: 200,
      headers: { "content-type": "application/octet-stream" },
    });
    const transport = {
      status: 200,
      headers: raw.headers,
      url: "https://example.com",
      raw,
    };
    await expect(
      decoder.decode(new Request({ method: "GET", url: "https://example.com" }), transport, {} as any),
    ).rejects.toThrow("Unable to determine response type");
  });
});

describe("RequestClient", () => {
  it("merges default headers/meta and respects request overrides", async () => {
    const client = new RequestClient({
      headers: { "X-Default": "1", "X-Remove": "x" },
      meta: { tags: ["core"] },
      transport: {
        async send(req) {
          expect(req.headers.get("X-Default")).toBe("1");
          expect(req.headers.get("X-Override")).toBe("2");
          expect(req.headers.get("X-Remove")).toBeNull();
          expect(req.meta.tags).toEqual(["core"]);
          expect(req.meta.extra).toBe("ok");
          return {
            status: 200,
            headers: new Headers(),
            url: req.url,
            raw: new Response("ok", { status: 200 }),
          };
        },
      },
      decoder: {
        async decode<T = unknown>() {
          return new CoreResponse<T>({
            status: 200,
            headers: new Headers(),
            url: "https://example.com",
            data: "ok" as T,
            raw: {},
          });
        },
      },
    });

    await client.fetch("https://example.com", {
      headers: { "X-Override": "2", "X-Remove": null },
      meta: { extra: "ok" },
    });
  });

  it("accepts Headers instance for request overrides", async () => {
    const client = new RequestClient({
      headers: { "X-Default": "1" },
      transport: {
        async send(req) {
          expect(req.headers.get("X-Default")).toBe("1");
          expect(req.headers.get("X-From-Headers")).toBe("2");
          return {
            status: 200,
            headers: new Headers(),
            url: req.url,
            raw: new Response("ok", { status: 200 }),
          };
        },
      },
      decoder: {
        async decode<T = unknown>() {
          return new CoreResponse<T>({
            status: 200,
            headers: new Headers(),
            url: "https://example.com",
            data: "ok" as T,
            raw: {},
          });
        },
      },
    });

    await client.fetch("https://example.com", {
      headers: new Headers({ "X-From-Headers": "2" }),
    });
  });

  it("maps timeout to TimeoutError and emits abort without error", async () => {
    const events = {
      abort: 0,
      error: 0,
    };
    const client = new RequestClient({
      events: {
        on() {
          return () => {};
        },
        emit(event) {
          if (event === "request:abort") events.abort += 1;
          if (event === "request:error") events.error += 1;
        },
      },
      transport: {
        async send(_req, ctx) {
          return new Promise((_resolve, reject) => {
            ctx.signal.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        },
      },
    });

    vi.useFakeTimers();
    const promise = client.fetch("https://example.com", { timeout: 5 });
    vi.advanceTimersByTime(10);
    await expect(promise).rejects.toBeInstanceOf(TimeoutError);
    vi.useRealTimers();

    expect(events.abort).toBe(1);
    expect(events.error).toBe(0);
  });
});

describe("createBagKey", () => {
  it("creates a symbol key", () => {
    const key = createBagKey("test");
    expect(typeof key).toBe("symbol");
  });
});
