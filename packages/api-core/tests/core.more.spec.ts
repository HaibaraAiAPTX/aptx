import { describe, expect, it, vi } from "vitest";
import { Pipeline } from "../src/pipeline";
import { Request } from "../src/request";
import { Response as CoreResponse } from "../src/response";
import { Context } from "../src/context";
import { SimpleEventBus } from "../src/defaults/eventBus";
import { DefaultErrorMapper } from "../src/defaults/errorMapper";
import { DefaultResponseDecoder } from "../src/defaults/responseDecoder";
import { DefaultBodySerializer } from "../src/defaults/bodySerializer";
import { DefaultUrlResolver } from "../src/defaults/urlResolver";
import { FetchTransport } from "../src/defaults/fetchTransport";
import { RequestClient } from "../src/client";
import { TIMEOUT_BAG_KEY, createBagKey, assertBagKey } from "../src/types";
import { CanceledError, NetworkError, TimeoutError, UniReqError, SerializeError, DecodeError, ConfigError } from "../src/errors";

describe("Pipeline", () => {
  it("executes middleware in onion order", async () => {
    const pipeline = new Pipeline();
    const order: string[] = [];

    pipeline.use({
      async handle(req, ctx, next) {
        order.push("mw1:before");
        const res = await next(req, ctx);
        order.push("mw1:after");
        return res;
      },
    });

    pipeline.use({
      async handle(req, ctx, next) {
        order.push("mw2:before");
        const res = await next(req, ctx);
        order.push("mw2:after");
        return res;
      },
    });

    const handler = pipeline.compose(async () => {
      order.push("final");
      return new CoreResponse({
        status: 200,
        headers: new Headers(),
        url: "https://example.com",
        raw: {},
      });
    });

    await handler(
      new Request({ method: "GET", url: "https://example.com" }),
      new Context({ id: "1", signal: new AbortController().signal }),
    );

    expect(order).toEqual([
      "mw1:before",
      "mw2:before",
      "final",
      "mw2:after",
      "mw1:after",
    ]);
  });

  it("throws if next() called multiple times", async () => {
    const pipeline = new Pipeline();
    pipeline.use({
      async handle(req, ctx, next) {
        await next(req, ctx);
        await next(req, ctx);
        return new CoreResponse({
          status: 200,
          headers: new Headers(),
          url: "https://example.com",
          raw: {},
        });
      },
    });

    const handler = pipeline.compose(async () => {
      return new CoreResponse({
        status: 200,
        headers: new Headers(),
        url: "https://example.com",
        raw: {},
      });
    });

    await expect(
      handler(
        new Request({ method: "GET", url: "https://example.com" }),
        new Context({ id: "1", signal: new AbortController().signal }),
      ),
    ).rejects.toThrow("next() called multiple times");
  });
});

describe("SimpleEventBus", () => {
  it("swallows listener errors and continues", () => {
    const bus = new SimpleEventBus();
    const calls: string[] = [];
    bus.on("request:start", () => {
      calls.push("a");
      throw new Error("fail");
    });
    bus.on("request:start", () => {
      calls.push("b");
    });

    bus.emit("request:start", {
      req: new Request({ method: "GET", url: "https://example.com" }),
      ctx: new Context({ id: "1", signal: new AbortController().signal }),
    });

    expect(calls).toEqual(["a", "b"]);
  });
});

describe("Context.bagView", () => {
  it("returns a snapshot that does not mutate the original bag", () => {
    const ctx = new Context({ id: "1", signal: new AbortController().signal });
    ctx.bag.set(createBagKey("a"), 1);
    const view = ctx.bagView;
    (view as Map<symbol, unknown>).set(createBagKey("b"), 2);
    expect(ctx.bag.size).toBe(1);
  });
});

describe("DefaultErrorMapper", () => {
  it("maps timeout when TIMEOUT_BAG_KEY is set", () => {
    const mapper = new DefaultErrorMapper();
    const ctx = new Context({ id: "1", signal: new AbortController().signal });
    ctx.bag.set(TIMEOUT_BAG_KEY, true);
    const err = mapper.map(new Error("any"), new Request({ method: "GET", url: "https://example.com" }), ctx);
    expect(err).toBeInstanceOf(TimeoutError);
  });

  it("maps abort to CanceledError", () => {
    const mapper = new DefaultErrorMapper();
    const ctx = new Context({ id: "1", signal: new AbortController().signal });
    const abortErr = new DOMException("Aborted", "AbortError");
    const err = mapper.map(abortErr, new Request({ method: "GET", url: "https://example.com" }), ctx);
    expect(err).toBeInstanceOf(CanceledError);
  });

  it("maps other errors to NetworkError", () => {
    const mapper = new DefaultErrorMapper();
    const ctx = new Context({ id: "1", signal: new AbortController().signal });
    const err = mapper.map(new Error("boom"), new Request({ method: "GET", url: "https://example.com" }), ctx);
    expect(err).toBeInstanceOf(NetworkError);
  });

  it("returns UniReqError as-is", () => {
    const mapper = new DefaultErrorMapper();
    const ctx = new Context({ id: "1", signal: new AbortController().signal });
    const original = new TimeoutError("timeout");
    const err = mapper.map(original, new Request({ method: "GET", url: "https://example.com" }), ctx);
    expect(err).toBe(original);
  });
});

describe("DefaultResponseDecoder", () => {
  it("honors responseType=raw and leaves data undefined", async () => {
    const decoder = new DefaultResponseDecoder();
    const raw = new Response("ok", { status: 200 });
    const transport = {
      status: 200,
      headers: raw.headers,
      url: "https://example.com",
      raw,
    };
    const req = new Request({
      method: "GET",
      url: "https://example.com",
      meta: { responseType: "raw" },
    });
    const res = await decoder.decode(req, transport, {} as any);
    expect(res.data).toBeUndefined();
    expect(res.raw).toBe(raw);
  });

  it("decodes blob and arrayBuffer when requested", async () => {
    const decoder = new DefaultResponseDecoder();
    const raw = new Response("ok", { status: 200 });
    const transport = {
      status: 200,
      headers: raw.headers,
      url: "https://example.com",
      raw,
    };

    const blobRes = await decoder.decode(
      new Request({ method: "GET", url: "https://example.com", meta: { responseType: "blob" } }),
      transport,
      {} as any,
    );
    expect(blobRes.data).toBeInstanceOf(Blob);

    const bufferRes = await decoder.decode(
      new Request({ method: "GET", url: "https://example.com", meta: { responseType: "arrayBuffer" } }),
      transport,
      {} as any,
    );
    expect(bufferRes.data).toBeInstanceOf(ArrayBuffer);
  });

  it("uses text response type by content-type and defaultResponseType fallback", async () => {
    const decoder = new DefaultResponseDecoder({ defaultResponseType: "json" });
    const rawText = new Response("hello", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
    const transportText = {
      status: 200,
      headers: rawText.headers,
      url: "https://example.com",
      raw: rawText,
    };
    const resText = await decoder.decode(
      new Request({ method: "GET", url: "https://example.com" }),
      transportText,
      {} as any,
    );
    expect(resText.data).toBe("hello");

    const rawDefault = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "" },
    });
    const transportDefault = {
      status: 200,
      headers: rawDefault.headers,
      url: "https://example.com",
      raw: rawDefault,
    };
    const resDefault = await decoder.decode(
      new Request({ method: "GET", url: "https://example.com" }),
      transportDefault,
      {} as any,
    );
    expect(resDefault.data).toEqual({ ok: true });
  });

  it("uses text preview for non-json error responses", async () => {
    const decoder = new DefaultResponseDecoder();
    const raw = new Response("bad", { status: 500, headers: { "content-type": "text/plain" } });
    const transport = {
      status: 500,
      headers: raw.headers,
      url: "https://example.com",
      raw,
    };

    try {
      await decoder.decode(new Request({ method: "GET", url: "https://example.com" }), transport, {} as any);
    } catch (err) {
      const httpErr = err as any;
      expect(httpErr.bodyPreview).toBe("bad");
    }
  });

  it("throws DecodeError on invalid json", async () => {
    const decoder = new DefaultResponseDecoder();
    const raw = new Response("not-json", { status: 200, headers: { "content-type": "application/json" } });
    const transport = {
      status: 200,
      headers: raw.headers,
      url: "https://example.com",
      raw,
    };

    await expect(
      decoder.decode(
        new Request({ method: "GET", url: "https://example.com", meta: { responseType: "json" } }),
        transport,
        {} as any,
      ),
    ).rejects.toBeInstanceOf(DecodeError);
  });
});

describe("RequestClient without retry", () => {
  it("fails immediately without retry", async () => {
    let count = 0;
    const client = new RequestClient({
      transport: {
        async send() {
          count += 1;
          throw new Error("fail");
        },
      },
    });

    await expect(client.fetch("https://example.com")).rejects.toThrow("Network error");
    expect(count).toBe(1);
  });
});

describe("createBagKey", () => {
  it("returns unique symbols for different names", () => {
    const a = createBagKey("a");
    const b = createBagKey("b");
    expect(a).not.toBe(b);
  });

  it("asserts symbol keys only", () => {
    expect(() => assertBagKey("not-symbol")).toThrow("Bag key must be a symbol");
  });
});

describe("index exports", () => {
  it("can import public surface", async () => {
    const mod = await import("../src/index.js");
    expect(mod.RequestClient).toBeDefined();
    expect(mod.Request).toBeDefined();
    expect(mod.Response).toBeDefined();
    expect(mod.createClient).toBeDefined();
  });
});

describe("RequestClient plugin registry", () => {
  it("allows plugins to set components and register middleware", async () => {
    let used = 0;
    const client = new RequestClient({
      transport: {
        async send(req) {
          return {
            status: 200,
            headers: new Headers(),
            url: req.url,
            raw: new Response("ok", { status: 200 }),
          };
        },
      },
    });

    client.apply({
      setup(registry) {
        registry.use({
          async handle(req, ctx, next) {
            used += 1;
            return next(req, ctx);
          },
        });
        registry.setUrlResolver({
          resolve(req) {
            return req.url + "?v=1";
          },
        });
        registry.setDecoder({
          async decode<T = unknown>() {
            return new CoreResponse<T>({
              status: 200,
              headers: new Headers(),
              url: "https://example.com",
              data: "ok" as T,
              raw: {},
            });
          },
        });
      },
    });

    const res = await client.fetch("https://example.com");
    expect(res.data).toBe("ok");
    expect(used).toBe(1);
  });

  it("allows plugins to replace transport and errorMapper", async () => {
    const client = new RequestClient();
    class CustomError extends Error {}

    client.apply({
      setup(registry) {
        registry.setBodySerializer({
          serialize() {
            return { body: "x" };
          },
        });
        registry.setTransport({
          async send() {
            throw new Error("fail");
          },
        });
        registry.setErrorMapper({
          map() {
            return new CustomError("mapped");
          },
        });
      },
    });

    await expect(client.fetch("https://example.com")).rejects.toBeInstanceOf(CustomError);
  });
});

describe("RequestClient events", () => {
  it("emits frozen payloads", async () => {
    const payloads: any[] = [];
    const client = new RequestClient({
      events: {
        on() {
          return () => {};
        },
        emit(_event, payload) {
          payloads.push(payload);
        },
      },
      transport: {
        async send(req) {
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

    await client.fetch("https://example.com");
    expect(payloads.length).toBeGreaterThan(0);
    expect(Object.isFrozen(payloads[0])).toBe(true);
  });
});

describe("Error types", () => {
  it("throws SerializeError on circular body", () => {
    const serializer = new DefaultBodySerializer();
    const body: any = {};
    body.self = body;
    const req = new Request({
      method: "POST",
      url: "https://example.com",
      body,
    });
    expect(() => serializer.serialize(req, {} as any)).toThrow(SerializeError);
  });

  it("throws ConfigError for relative URL without baseURL", () => {
    const resolver = new DefaultUrlResolver();
    const req = new Request({ method: "GET", url: "/path" });
    expect(() => resolver.resolve(req, {} as any)).toThrow(ConfigError);
  });
});

describe("FetchTransport", () => {
  it("sends request with serialized body and merged headers", async () => {
    const serializer = {
      serialize() {
        return { body: "payload", headers: { "content-type": "text/plain", "x-extra": "1" } };
      },
    };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("content-type")).toBe("text/plain");
      expect(headers.get("x-extra")).toBe("1");
      expect(headers.get("x-req")).toBe("1");
      expect(init?.body).toBe("payload");
      return new Response("ok", { status: 200 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const transport = new FetchTransport(serializer as any);
    const req = new Request({
      method: "POST",
      url: "https://example.com",
      headers: { "x-req": "1" },
      body: { a: 1 },
    });
    const res = await transport.send(req, new Context({ id: "1", signal: new AbortController().signal }));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("reports download progress when enabled", async () => {
    const serializer = {
      serialize() {
        return { body: undefined };
      },
    };
    const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(c);
        controller.close();
      },
    });
    const fetchMock = vi.fn(async () => {
      return new Response(stream, {
        status: 200,
        headers: { "content-length": "5" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const progress: number[] = [];
    const transport = new FetchTransport(serializer as any);
    const req = new Request({
      method: "GET",
      url: "https://example.com",
      meta: {
        onDownloadProgress: (info) => progress.push(info.loaded),
      },
    });
    const res = await transport.send(req, new Context({ id: "1", signal: new AbortController().signal }));
    const text = await (res.raw as Response).arrayBuffer();
    expect((text as ArrayBuffer).byteLength).toBe(5);
    expect(progress).toEqual([2, 5]);
    vi.unstubAllGlobals();
  });
});
