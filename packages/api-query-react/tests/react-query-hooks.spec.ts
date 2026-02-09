import { describe, expect, it, vi, beforeEach } from "vitest";
import { useMutation, useQuery } from "@tanstack/react-query";

import { createReactMutationHooks, createReactQueryHooks } from "../src/index.js";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

describe("createReactQueryHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wires query key/query fn and forwards query options", async () => {
    const input = { id: "42" };
    const keySpy = vi.fn().mockReturnValue(["user", "getInfo", input]);
    const innerQueryFn = vi.fn().mockResolvedValue({ id: "42", name: "ops" });
    const queryFnSpy = vi.fn().mockReturnValue(innerQueryFn);

    const expectedResult = { data: { id: "42" } };
    vi.mocked(useQuery).mockReturnValue(expectedResult as any);

    const hooks = createReactQueryHooks({
      key: keySpy,
      queryFn: queryFnSpy,
    });

    const result = hooks.useAptxQuery(input, {
      query: {
        enabled: true,
        staleTime: 1000,
      },
    });

    expect(result).toBe(expectedResult);
    expect(useQuery).toHaveBeenCalledTimes(1);

    const config = vi.mocked(useQuery).mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(config.queryKey).toEqual(["user", "getInfo", input]);
    expect(config.enabled).toBe(true);
    expect(config.staleTime).toBe(1000);

    type QueryCtx = {
      queryKey: unknown[];
      signal: AbortSignal;
      meta: { traceId: string };
    };
    const ctx: QueryCtx = {
      queryKey: ["user", "getInfo", input],
      signal: new AbortController().signal,
      meta: { traceId: "t-1" },
    };
    const queryFn = config.queryFn as (ctx: QueryCtx) => Promise<unknown>;
    await queryFn(ctx);

    expect(queryFnSpy).toHaveBeenCalledWith(input);
    expect(innerQueryFn).toHaveBeenCalledWith(ctx);
  });
});

describe("createReactMutationHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wires mutation function and forwards mutation options", () => {
    const mutationFn = vi.fn().mockResolvedValue({ ok: true });
    const expectedResult = { mutate: vi.fn() };
    vi.mocked(useMutation).mockReturnValue(expectedResult as any);

    const hooks = createReactMutationHooks({
      mutationFn,
    });

    const result = hooks.useAptxMutation({
      mutation: {
        gcTime: 10_000,
      },
    });

    expect(result).toBe(expectedResult);
    expect(useMutation).toHaveBeenCalledTimes(1);

    const config = vi.mocked(useMutation).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(config.mutationFn).toBe(mutationFn);
    expect(config.gcTime).toBe(10_000);
  });
});
