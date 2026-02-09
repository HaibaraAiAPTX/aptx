import { Context } from "./context";
import { Request } from "./request";
import { Response } from "./response";
import { ConfigError } from "./errors";

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type HeadersInitLike =
  | Headers
  | Record<string, string>
  | Array<[string, string]>;

export type HeadersPatch = HeadersInitLike | Record<string, string | null | undefined>;

export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>;

export type QueryInitLike =
  | URLSearchParams
  | Record<string, QueryValue>
  | Array<[string, string]>;

export type QuerySerializer = (query: QueryInitLike, url: string) => string;

export type ResponseType = "json" | "text" | "blob" | "arrayBuffer" | "raw";

/** Strongly recommend symbol keys to avoid collisions */
export type BagKey = symbol;
export const TIMEOUT_BAG_KEY: BagKey = Symbol("timeout");

export interface RequestMeta {
  /** How to decode body (defaults to auto) */
  responseType?: ResponseType;
  /** arbitrary tags, trace hints, etc */
  tags?: string[];
  /** progress callbacks (best-effort in FetchTransport) */
  onUploadProgress?: ProgressCallback;
  onDownloadProgress?: ProgressCallback;
  /** extension point: plugin-specific hints */
  [k: string]: unknown;
}

export interface ResponseMeta {
  /** e.g. { fromCache: true } by cache middleware */
  [k: string]: unknown;
}

export interface ClientFetchInit {
  method?: HttpMethod;
  headers?: HeadersPatch;
  query?: QueryInitLike;
  body?: unknown;
  timeout?: number;
  signal?: AbortSignal;
  meta?: RequestMeta;
  onUploadProgress?: ProgressCallback;
  onDownloadProgress?: ProgressCallback;
}

export interface TransportResult {
  status: number;
  headers: Headers;
  url: string;
  /** Raw response body is kept in raw */
  raw: unknown; // default: Fetch Response
}

export interface Middleware {
  handle(req: Request, ctx: Context, next: Next): Promise<Response>;
}

export type Next = (req: Request, ctx: Context) => Promise<Response>;

export interface Transport {
  send(req: Request, ctx: Context): Promise<TransportResult>;
}

export interface UrlResolver {
  resolve(req: Request, ctx: Context): string;
}

export interface BodySerializer {
  serialize(req: Request, ctx: Context): { body: any; headers?: HeadersInitLike };
}

export interface ResponseDecoder {
  decode<T = unknown>(
    req: Request,
    transport: TransportResult,
    ctx: Context
  ): Promise<Response<T>>;
}

export interface ErrorMapper {
  map(err: unknown, req: Request, ctx: Context, transport?: TransportResult): Error;
}

export type EventName =
  | "request:start"
  | "request:end"
  | "request:error"
  | "request:abort";

export interface EventPayloadMap {
  "request:start": { req: Request; ctx: Context };
  "request:end": { req: Request; res: Response; ctx: Context; durationMs?: number; attempt?: number };
  "request:error": { req: Request; error: Error; ctx: Context; durationMs?: number; attempt?: number };
  "request:abort": { req: Request; ctx: Context; durationMs?: number; attempt?: number };
}

export interface EventBus {
  on<E extends EventName>(event: E, handler: (p: EventPayloadMap[E]) => void): () => void;
  emit<E extends EventName>(event: E, payload: EventPayloadMap[E]): void;
}

export interface Plugin {
  setup(registry: Registry): void;
}

export interface Registry {
  use(mw: Middleware): void;
  setTransport(t: Transport): void;
  setUrlResolver(r: UrlResolver): void;
  setBodySerializer(s: BodySerializer): void;
  setDecoder(d: ResponseDecoder): void;
  setErrorMapper(m: ErrorMapper): void;
  events: EventBus;
}

export function createBagKey(name: string): BagKey {
  return Symbol(name);
}

export function assertBagKey(key: unknown): asserts key is BagKey {
  if (typeof key !== "symbol") {
    throw new ConfigError("Bag key must be a symbol");
  }
}

export interface ProgressInfo {
  loaded: number;
  total?: number;
  progress?: number;
  type: "upload" | "download";
}

export type ProgressCallback = (info: ProgressInfo) => void;
