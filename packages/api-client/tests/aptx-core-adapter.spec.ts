import { describe, expect, it } from "vitest";
import { RequestClient } from "@aptx/api-core";
import type { Context, Request, Transport, TransportResult } from "@aptx/api-core";

import { createAptxCoreApiClient } from "../src/index.js";

class MockTransport implements Transport {
  constructor(private readonly handler: (url: string, method: string, body: unknown) => unknown) {}

  async send(req: Request, _ctx: Context): Promise<TransportResult> {
    const value = this.handler(req.url, req.method, req.body);
    const body = JSON.stringify(value);
    const raw = new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    return {
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      url: req.url,
      raw,
    };
  }
}

describe("createAptxCoreApiClient", () => {
  it("maps RequestSpec to RequestClient.fetch and returns data", async () => {
    const client = new RequestClient({
      baseURL: "https://example.com",
      transport: new MockTransport((url, method) => ({ url, method })),
    });
    const apiClient = createAptxCoreApiClient(client);

    const data = await apiClient.execute<{ url: string; method: string }>({
      method: "GET",
      path: "/users",
    });

    expect(data.method).toBe("GET");
    expect(data.url).toContain("/users");
  });
});
