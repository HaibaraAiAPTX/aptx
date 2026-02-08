import { describe, expect, it } from "vitest";
import { createCsrfMiddleware } from "../src/index.js";
import { Context } from "../../api-core/src/context";
import { Request } from "../../api-core/src/request";
import { Response } from "../../api-core/src/response";

describe("createCsrfMiddleware", () => {
  it("adds header from cookie getter", async () => {
    const mw = createCsrfMiddleware({
      getCookie: (name) => (name === "XSRF-TOKEN" ? "t1" : undefined),
    });
    const res = await mw.handle(
      new Request({ method: "GET", url: "https://example.com" }),
      new Context({ id: "1", signal: new AbortController().signal }),
      async (req) => {
        expect(req.headers.get("X-XSRF-TOKEN")).toBe("t1");
        return new Response({
          status: 200,
          headers: new Headers(),
          url: "https://example.com",
          raw: {},
        });
      },
    );
    expect(res.status).toBe(200);
  });

  it("skips when sameOriginOnly and cross-origin", async () => {
    const mw = createCsrfMiddleware({
      sameOriginOnly: true,
      getCookie: () => "t1",
    });
    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = {
      location: { origin: "https://example.com", href: "https://example.com" },
    };
    const res = await mw.handle(
      new Request({ method: "GET", url: "https://api.example.com" }),
      new Context({ id: "1", signal: new AbortController().signal }),
      async (req) => {
        expect(req.headers.get("X-XSRF-TOKEN")).toBeNull();
        return new Response({
          status: 200,
          headers: new Headers(),
          url: "https://example.com",
          raw: {},
        });
      },
    );
    expect(res.status).toBe(200);
    (globalThis as any).window = originalWindow;
  });
});
