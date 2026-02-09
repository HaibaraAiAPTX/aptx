import { describe, expect, it } from "vitest";
import type { PerCallOptions, RequestSpec } from "@aptx/api-client";

import {
  createDefaultRetryClassifier,
  createMutationDefinition,
  createQueryDefinition,
} from "../src/index.js";

function makeError(name: string, status?: number): Error & { status?: number } {
  const error = new Error(name) as Error & { status?: number };
  error.name = name;
  if (status !== undefined) error.status = status;
  return error;
}

describe("createQueryDefinition", () => {
  it("creates stable query keys for objects with different property order", () => {
    const def = createQueryDefinition({
      keyPrefix: ["user", "list"] as const,
      buildSpec: (input: { a: number; b: number; optional?: string }): RequestSpec => ({
        method: "GET",
        path: "/users",
        query: input,
      }),
      execute: async () => [],
    });

    const keyA = def.key({ a: 1, b: 2, optional: undefined });
    const keyB = def.key({ b: 2, a: 1 });
    expect(keyA).toEqual(keyB);
  });

  it("passes built spec and merges signal/meta with request overrides", async () => {
    const signal = new AbortController().signal;
    let gotSpec: RequestSpec | undefined;
    let gotOptions: PerCallOptions | undefined;

    const def = createQueryDefinition({
      keyPrefix: ["category", "getInfo"] as const,
      buildSpec: (input: { id: string }): RequestSpec => ({
        method: "GET",
        path: "/AccountCategory/GetInfo",
        query: { id: input.id },
      }),
      getRequestOptions: (input) => ({
        headers: { "x-test": "1" },
        query: { verbose: true },
        meta: { source: "hook", id: input.id },
      }),
      execute: async (spec, options) => {
        gotSpec = spec;
        gotOptions = options;
        return { ok: true };
      },
    });

    await def.queryFn({ id: "abc" })({
      queryKey: def.key({ id: "abc" }),
      signal,
      meta: { traceId: "t-1" },
    });

    expect(gotSpec).toEqual({
      method: "GET",
      path: "/AccountCategory/GetInfo",
      query: { id: "abc" },
    });
    expect(gotOptions?.signal).toBe(signal);
    expect(gotOptions?.headers).toEqual({ "x-test": "1" });
    expect(gotOptions?.query).toEqual({ verbose: true });
    expect(gotOptions?.meta).toEqual({
      source: "hook",
      id: "abc",
      __query: { traceId: "t-1" },
    });
  });
});

describe("createMutationDefinition", () => {
  it("maps input to execute via buildSpec", async () => {
    let gotSpec: RequestSpec | undefined;
    let gotOptions: PerCallOptions | undefined;

    const def = createMutationDefinition({
      buildSpec: (input: { name: string }): RequestSpec => ({
        method: "PUT",
        path: "/AccountCategory/Edit",
        body: input,
      }),
      getRequestOptions: () => ({
        headers: { "x-op": "edit" },
      }),
      execute: async (spec, options) => {
        gotSpec = spec;
        gotOptions = options;
        return { success: true };
      },
    });

    const result = await def.mutationFn({ name: "Ops" });
    expect(result).toEqual({ success: true });
    expect(gotSpec).toEqual({
      method: "PUT",
      path: "/AccountCategory/Edit",
      body: { name: "Ops" },
    });
    expect(gotOptions?.headers).toEqual({ "x-op": "edit" });
  });
});

describe("createDefaultRetryClassifier", () => {
  it("classifies default retryable and non-retryable errors", () => {
    const shouldRetry = createDefaultRetryClassifier();

    expect(shouldRetry(makeError("NetworkError"))).toBe(true);
    expect(shouldRetry(makeError("TimeoutError"))).toBe(false);
    expect(shouldRetry(makeError("CanceledError"))).toBe(false);
    expect(shouldRetry(makeError("HttpError", 429))).toBe(true);
    expect(shouldRetry(makeError("HttpError", 400))).toBe(false);
  });

  it("supports retryTimeout and custom retry status list", () => {
    const shouldRetry = createDefaultRetryClassifier({
      retryTimeout: true,
      retryHttpStatuses: [500],
    });

    expect(shouldRetry(makeError("TimeoutError"))).toBe(true);
    expect(shouldRetry(makeError("HttpError", 500))).toBe(true);
    expect(shouldRetry(makeError("HttpError", 502))).toBe(false);
  });
});
