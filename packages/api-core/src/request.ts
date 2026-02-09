import { HeadersInitLike, HeadersPatch, HttpMethod, QueryInitLike, RequestMeta } from "./types";

function toHeaders(h?: HeadersInitLike): Headers {
  if (!h) return new Headers();
  return h instanceof Headers ? new Headers(h) : new Headers(h as any);
}

function mergeHeaders(a: Headers, b?: HeadersPatch): Headers {
  const out = new Headers(a);
  if (!b) return out;
  if (b instanceof Headers) {
    b.forEach((v, k) => out.set(k, v));
    return out;
  }
  if (Array.isArray(b)) {
    for (const [k, v] of b) out.set(k, v);
    return out;
  }
  for (const [k, v] of Object.entries(b)) {
    if (v === null || v === undefined) out.delete(k);
    else out.set(k, v);
  }
  return out;
}

export class Request {
  readonly method: HttpMethod;
  readonly url: string;
  private readonly _headers: Headers;
  readonly query?: QueryInitLike;
  readonly body?: unknown;
  readonly timeout?: number;
  readonly signal?: AbortSignal;
  readonly meta: RequestMeta;

  constructor(init: {
    method: HttpMethod;
    url: string;
    headers?: HeadersInitLike;
    query?: QueryInitLike;
    body?: unknown;
    timeout?: number;
    signal?: AbortSignal;
    meta?: RequestMeta;
  }) {
    this.method = init.method;
    this.url = init.url;
    this._headers = toHeaders(init.headers);
    this.query = init.query;
    this.body = init.body;
    this.timeout = init.timeout;
    this.signal = init.signal;
    this.meta = init.meta ?? {};
    Object.freeze(this.meta);
    Object.freeze(this);
  }

  get headers(): Headers {
    return new Headers(this._headers);
  }

  with(patch: Partial<{
    method: HttpMethod;
    url: string;
    headers: HeadersPatch;
    query: QueryInitLike;
    body: unknown;
    timeout: number;
    signal: AbortSignal;
    meta: RequestMeta;
  }>): Request {
    return new Request({
      method: patch.method ?? this.method,
      url: patch.url ?? this.url,
      headers: patch.headers ? mergeHeaders(this._headers, patch.headers) : this._headers,
      query: patch.query ?? this.query,
      body: patch.body ?? this.body,
      timeout: patch.timeout ?? this.timeout,
      signal: patch.signal ?? this.signal,
      meta: patch.meta ?? this.meta,
    });
  }
}
