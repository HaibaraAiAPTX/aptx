import {
  BodySerializer,
  ClientFetchInit,
  ErrorMapper,
  EventBus,
  HeadersInitLike,
  HeadersPatch,
  Middleware,
  Plugin,
  Registry,
  ResponseDecoder,
  ResponseType,
  TIMEOUT_BAG_KEY,
  Transport,
  UrlResolver,
  RequestMeta,
  QuerySerializer,
} from "./types";
import { Pipeline } from "./pipeline";
import { Request } from "./request";
import { Response } from "./response";
import { Context } from "./context";
import { SimpleEventBus } from "./defaults/eventBus";
import { DefaultUrlResolver } from "./defaults/urlResolver";
import { DefaultBodySerializer } from "./defaults/bodySerializer";
import { FetchTransport } from "./defaults/fetchTransport";
import { DefaultResponseDecoder } from "./defaults/responseDecoder";
import { DefaultErrorMapper } from "./defaults/errorMapper";

function createId(): string {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function toHeaders(h?: HeadersInitLike): Headers {
  if (!h) return new Headers();
  return h instanceof Headers ? new Headers(h) : new Headers(h as any);
}

function mergeHeaders(base: Headers, patch?: HeadersPatch): Headers {
  const out = new Headers(base);
  if (!patch) return out;
  if (patch instanceof Headers) {
    patch.forEach((v, k) => out.set(k, v));
    return out;
  }
  if (Array.isArray(patch)) {
    for (const [k, v] of patch) out.set(k, v);
    return out;
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) out.delete(k);
    else out.set(k, v);
  }
  return out;
}

function mergeSignals(user?: AbortSignal, timeoutMs?: number, ctxBag?: Map<symbol, unknown>) {
  const ac = new AbortController();
  const onAbort = () => ac.abort();

  if (user) {
    if (user.aborted) ac.abort();
    else user.addEventListener("abort", onAbort, { once: true });
  }

  let timer: any;
  if (timeoutMs && timeoutMs > 0) {
    timer = setTimeout(() => {
      ctxBag?.set(TIMEOUT_BAG_KEY, true);
      ac.abort();
    }, timeoutMs);
  }

  const cleanup = () => {
    if (user) user.removeEventListener("abort", onAbort);
    if (timer) clearTimeout(timer);
  };

  return { signal: ac.signal, cleanup };
}

function freezePayload<T extends object>(payload: T): T {
  return Object.freeze(payload);
}

export interface RequestClientOptions {
  transport?: Transport;
  urlResolver?: UrlResolver;
  bodySerializer?: BodySerializer;
  decoder?: ResponseDecoder;
  errorMapper?: ErrorMapper;
  middlewares?: Middleware[];
  events?: EventBus;
  baseURL?: string;
  headers?: HeadersInitLike;
  timeoutMs?: number;
  meta?: RequestMeta;
  defaultResponseType?: ResponseType;
  strictDecode?: boolean;
  querySerializer?: QuerySerializer;
}

export class RequestClient {
  private readonly pipeline = new Pipeline();
  private transport: Transport;
  private urlResolver: UrlResolver;
  private serializer: BodySerializer;
  private decoder: ResponseDecoder;
  private errorMapper: ErrorMapper;
  private defaultHeaders: Headers;
  private defaultTimeoutMs?: number;
  private defaultMeta?: RequestMeta;
  readonly events: EventBus;

  constructor(opts: RequestClientOptions = {}) {
    this.events = opts.events ?? new SimpleEventBus();

    this.serializer = opts.bodySerializer ?? new DefaultBodySerializer();
    this.transport = opts.transport ?? new FetchTransport(this.serializer);
    this.urlResolver = opts.urlResolver ?? new DefaultUrlResolver(opts.baseURL, opts.querySerializer);
    this.decoder =
      opts.decoder ??
      new DefaultResponseDecoder({
        defaultResponseType: opts.defaultResponseType,
        strictDecode: opts.strictDecode,
      });
    this.errorMapper = opts.errorMapper ?? new DefaultErrorMapper();
    this.defaultHeaders = toHeaders(opts.headers);
    this.defaultTimeoutMs = opts.timeoutMs;
    this.defaultMeta = opts.meta ? { ...opts.meta } : undefined;

    for (const mw of opts.middlewares ?? []) this.pipeline.use(mw);
  }

  /** fetch-like entry (A: decode by default) */
  async fetch<T = unknown>(input: string, init: ClientFetchInit = {}): Promise<Response<T>> {
    const headers = mergeHeaders(this.defaultHeaders, init.headers);
    const timeoutMs = init.timeoutMs ?? this.defaultTimeoutMs;
    const meta = this.defaultMeta ? { ...this.defaultMeta, ...(init.meta ?? {}) } : init.meta ?? {};
    if (init.onUploadProgress) meta.onUploadProgress = init.onUploadProgress;
    if (init.onDownloadProgress) meta.onDownloadProgress = init.onDownloadProgress;
    const req = new Request({
      method: init.method ?? "GET",
      url: input,
      headers,
      query: init.query,
      body: init.body,
      timeoutMs,
      signal: init.signal,
      meta,
    });
    return this.request<T>(req);
  }

  /** advanced entry */
  async request<T = unknown>(req: Request): Promise<Response<T>> {
    const ctxBag = new Map<symbol, unknown>();
    const { signal, cleanup } = mergeSignals(req.signal, req.timeoutMs, ctxBag);
    const ctx = new Context({ id: createId(), signal, bag: ctxBag });

    // resolve URL before pipeline
    const resolvedUrl = this.urlResolver.resolve(req, ctx);
    let resolvedReq = req.url === resolvedUrl ? req : req.with({ url: resolvedUrl });

    const finalHandler = async (r: Request, c: Context): Promise<Response> => {
      // transport expects already-resolved url in r.url
      const transport = await this.transport.send(r, c);
      return this.decoder.decode(r, transport, c);
    };

    const handler = this.pipeline.compose(finalHandler);

    try {
      ctx.attempt = 0;
      this.events.emit("request:start", freezePayload({ req: resolvedReq, ctx }));
      const res = await handler(resolvedReq, ctx);
      const durationMs = Date.now() - ctx.startTime;
      this.events.emit(
        "request:end",
        freezePayload({ req: resolvedReq, res, ctx, durationMs, attempt: ctx.attempt })
      );
      return res as Response<T>;
    } catch (e) {
      const durationMs = Date.now() - ctx.startTime;
      const mapped = this.errorMapper.map(e, resolvedReq, ctx);

      if (ctx.signal.aborted) {
        this.events.emit(
          "request:abort",
          freezePayload({ req: resolvedReq, ctx, durationMs, attempt: ctx.attempt })
        );
        throw mapped;
      }

      this.events.emit(
        "request:error",
        freezePayload({ req: resolvedReq, error: mapped, ctx, durationMs, attempt: ctx.attempt })
      );
      throw mapped;
    } finally {
      cleanup();
    }
  }

  /** OO friendly progressive enhancement */
  use(mw: Middleware): this {
    this.pipeline.use(mw);
    return this;
  }

  /** Plugin registry (minimal) */
  apply(plugin: Plugin): this {
    plugin.setup(this.registry());
    return this;
  }

  private registry(): Registry {
    return {
      use: (mw) => this.use(mw),
      setTransport: (t) => (this.transport = t),
      setUrlResolver: (r) => (this.urlResolver = r),
      setBodySerializer: (s) => {
        this.serializer = s;
        // if current transport is FetchTransport-like and depends on serializer, user may re-set transport
      },
      setDecoder: (d) => (this.decoder = d),
      setErrorMapper: (m) => (this.errorMapper = m),
      events: this.events,
    };
  }
}

export function createClient(opts: RequestClientOptions = {}): RequestClient {
  return new RequestClient(opts);
}
