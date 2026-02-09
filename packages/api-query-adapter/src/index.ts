import type {
  MutationFunction,
  QueryFunctionContext,
  QueryKey as TanstackQueryKey,
} from "@tanstack/query-core";
import type { PerCallOptions, RequestSpec } from "@aptx/api-client";

export type QueryKey = TanstackQueryKey;
export type QueryFunctionContextLike = Pick<QueryFunctionContext, "signal" | "meta">;

export type EndpointBuilder<TInput> = (input: TInput) => RequestSpec;

export type RequestExecutor<TOutput> = (
  spec: RequestSpec,
  options?: PerCallOptions
) => Promise<TOutput>;

export type QueryAdapterContext = {
  signal?: AbortSignal;
  meta?: Record<string, unknown>;
};

export type RequestOverrideFactory<TInput> = (
  input: TInput,
  ctx: QueryAdapterContext
) => PerCallOptions | undefined;

export interface CreateQueryOptions<TInput, TOutput> {
  keyPrefix: readonly unknown[];
  buildSpec: EndpointBuilder<TInput>;
  execute: RequestExecutor<TOutput>;
  getRequestOptions?: RequestOverrideFactory<TInput>;
  normalizeInput?: (input: TInput) => unknown;
}

export interface QueryDefinition<TInput, TOutput> {
  key: (input: TInput) => QueryKey;
  queryFn: (input: TInput) => (ctx: QueryFunctionContext<QueryKey>) => Promise<TOutput>;
}

export interface CreateMutationOptions<TInput, TOutput> {
  buildSpec: EndpointBuilder<TInput>;
  execute: RequestExecutor<TOutput>;
  getRequestOptions?: RequestOverrideFactory<TInput>;
}

export interface MutationDefinition<TInput, TOutput> {
  mutationFn: MutationFunction<TOutput, TInput>;
}

export interface RetryClassifierOptions {
  retryTimeout?: boolean;
  retryHttpStatuses?: readonly number[];
}

export type RetryClassifier = (error: unknown) => boolean;

type ErrorLike = {
  name?: string;
  status?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeForKey(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeForKey(item));

  const out: Record<string, unknown> = {};
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  for (const [k, v] of entries) {
    const normalized = normalizeForKey(v);
    if (normalized !== undefined) out[k] = normalized;
  }
  return out;
}

function toQueryContext(ctx?: QueryFunctionContextLike): QueryAdapterContext {
  return {
    signal: ctx?.signal,
    meta: isRecord(ctx?.meta) ? (ctx.meta as Record<string, unknown>) : undefined,
  };
}

function mergeMeta(
  requestMeta: PerCallOptions["meta"],
  queryMeta: QueryAdapterContext["meta"]
): PerCallOptions["meta"] {
  if (!requestMeta && !queryMeta) return undefined;
  if (!queryMeta) return requestMeta;

  const base = isRecord(requestMeta) ? requestMeta : {};
  return {
    ...base,
    __query: queryMeta,
  };
}

function mergePerCallOptions(
  options: PerCallOptions | undefined,
  queryCtx: QueryAdapterContext
): PerCallOptions | undefined {
  if (!options && !queryCtx.signal && !queryCtx.meta) return undefined;
  return {
    ...(options ?? {}),
    signal: queryCtx.signal ?? options?.signal,
    meta: mergeMeta(options?.meta, queryCtx.meta),
  };
}

export function createQueryDefinition<TInput, TOutput>(
  options: CreateQueryOptions<TInput, TOutput>
): QueryDefinition<TInput, TOutput> {
  const normalizeInput = options.normalizeInput ?? ((input: TInput) => input);

  return {
    key(input: TInput): QueryKey {
      return [...options.keyPrefix, normalizeForKey(normalizeInput(input))] as const;
    },

    queryFn(input: TInput) {
      return async (ctx: QueryFunctionContext<QueryKey>): Promise<TOutput> => {
        const queryCtx = toQueryContext(ctx);
        const spec = options.buildSpec(input);
        const requestOverrides = options.getRequestOptions?.(input, queryCtx);
        const perCall = mergePerCallOptions(requestOverrides, queryCtx);
        return options.execute(spec, perCall);
      };
    },
  };
}

export function createMutationDefinition<TInput, TOutput>(
  options: CreateMutationOptions<TInput, TOutput>
): MutationDefinition<TInput, TOutput> {
  return {
    async mutationFn(input: TInput): Promise<TOutput> {
      const spec = options.buildSpec(input);
      const requestOverrides = options.getRequestOptions?.(input, {});
      return options.execute(spec, requestOverrides);
    },
  };
}

export function createDefaultRetryClassifier(
  options: RetryClassifierOptions = {}
): RetryClassifier {
  const retryTimeout = options.retryTimeout ?? false;
  const retryHttpStatuses = new Set(options.retryHttpStatuses ?? [429, 502, 503, 504]);

  return (error: unknown): boolean => {
    const err = (error ?? {}) as ErrorLike;
    if (err.name === "CanceledError") return false;
    if (err.name === "NetworkError") return true;
    if (err.name === "TimeoutError") return retryTimeout;
    if (err.name === "HttpError" && typeof err.status === "number") {
      return retryHttpStatuses.has(err.status);
    }
    return false;
  };
}
