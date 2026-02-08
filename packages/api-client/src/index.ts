import type { RequestClient } from "@aptx/api-core";
import type { HttpMethod, QueryInitLike, RequestMeta } from "@aptx/api-core";

export type RequestSpec = {
  method: HttpMethod;
  path: string;
  query?: QueryInitLike;
  headers?: Record<string, string>;
  body?: unknown;
  meta?: RequestMeta;
};

export type PerCallOptions = {
  headers?: Record<string, string>;
  query?: QueryInitLike;
  timeoutMs?: number;
  signal?: AbortSignal;
  meta?: RequestMeta;
};

export type ApiClient = {
  execute<T>(spec: RequestSpec, options?: PerCallOptions): Promise<T>;
};

function mergeRecords<T extends Record<string, unknown>>(a?: T, b?: T): T | undefined {
  if (!a && !b) return undefined;
  return { ...(a ?? {}), ...(b ?? {}) } as T;
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof URLSearchParams);
}

function mergeQuery(a?: QueryInitLike, b?: QueryInitLike): QueryInitLike | undefined {
  if (b === undefined) return a;
  if (a === undefined) return b;
  if (isPlainRecord(a) && isPlainRecord(b)) return mergeRecords(a, b) as QueryInitLike;
  // Non-record query shapes (URLSearchParams / tuple arrays) can't be safely merged.
  return b;
}

export function createAptxCoreApiClient(client: RequestClient): ApiClient {
  return {
    async execute<T>(spec: RequestSpec, options: PerCallOptions = {}): Promise<T> {
      const res = await client.fetch<T>(spec.path, {
        method: spec.method,
        headers: mergeRecords(spec.headers, options.headers),
        query: mergeQuery(spec.query, options.query),
        body: spec.body,
        timeoutMs: options.timeoutMs,
        signal: options.signal,
        meta: mergeRecords(spec.meta, options.meta),
      });

      return res.data as T;
    },
  };
}

let _globalClient: ApiClient | null = null;

export function setApiClient(client: ApiClient): void {
  _globalClient = client;
}

export function getApiClient(): ApiClient {
  if (!_globalClient) {
    throw new Error("ApiClient is not registered. Call setApiClient() first.");
  }
  return _globalClient;
}

export function clearApiClient(): void {
  _globalClient = null;
}
