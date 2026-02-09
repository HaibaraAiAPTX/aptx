import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { useMutation, useQuery } from "@tanstack/vue-query";

import { createVueMutationHooks, createVueQueryHooks } from "../src/index.js";

vi.mock("@tanstack/vue-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

describe("createVueQueryHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unwraps MaybeRef input and wires key/query function", async () => {
    const input = ref({ id: "42" });
    const keySpy = vi.fn().mockImplementation((v: { id: string }) => ["user", "getInfo", v.id]);
    const innerQueryFn = vi.fn().mockResolvedValue({ id: "42", name: "ops" });
    const queryFnSpy = vi.fn().mockReturnValue(innerQueryFn);

    const expectedResult = { data: ref(null) };
    vi.mocked(useQuery).mockReturnValue(expectedResult as any);

    const hooks = createVueQueryHooks({
      key: keySpy,
      queryFn: queryFnSpy,
    });

    const result = hooks.useAptxQuery(input, {
      query: {
        enabled: true,
      },
    });

    expect(result).toBe(expectedResult);
    expect(useQuery).toHaveBeenCalledTimes(1);

    const config = vi.mocked(useQuery).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(config.queryKey).toEqual(["user", "getInfo", "42"]);
    expect(config.enabled).toBe(true);

    type QueryCtx = {
      queryKey: unknown[];
      signal: AbortSignal;
      meta: { traceId: string };
    };
    const ctx: QueryCtx = {
      queryKey: ["user", "getInfo", "42"],
      signal: new AbortController().signal,
      meta: { traceId: "t-1" },
    };
    const queryFn = config.queryFn as (ctx: QueryCtx) => Promise<unknown>;
    await queryFn(ctx);

    expect(queryFnSpy).toHaveBeenCalledWith({ id: "42" });
    expect(innerQueryFn).toHaveBeenCalledWith(ctx);
  });
});

describe("createVueMutationHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wires mutation function and forwards mutation options", () => {
    const mutationFn = vi.fn().mockResolvedValue({ ok: true });
    const expectedResult = { mutate: vi.fn() };
    vi.mocked(useMutation).mockReturnValue(expectedResult as any);

    const hooks = createVueMutationHooks({
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
