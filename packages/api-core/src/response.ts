import { ResponseMeta } from "./types";

export class Response<T = unknown> {
  readonly status: number;
  private readonly _headers: Headers;
  readonly url: string;
  readonly data?: T;
  readonly raw: unknown;
  readonly meta: ResponseMeta;

  constructor(init: {
    status: number;
    headers: Headers;
    url: string;
    data?: T;
    raw: unknown;
    meta?: ResponseMeta;
  }) {
    this.status = init.status;
    this._headers = init.headers;
    this.url = init.url;
    this.data = init.data;
    this.raw = init.raw;
    this.meta = init.meta ?? {};
    Object.freeze(this.meta);
    Object.freeze(this);
  }

  get headers(): Headers {
    return new Headers(this._headers);
  }
}
