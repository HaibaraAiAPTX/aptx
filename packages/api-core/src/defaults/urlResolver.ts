import { UrlResolver, QueryInitLike, QuerySerializer } from "../types";
import { Request } from "../request";
import { Context } from "../context";
import { ConfigError } from "../errors";

function applyQuery(url: string, query?: QueryInitLike): string {
  if (!query) return url;
  const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (query instanceof URLSearchParams) {
    query.forEach((v, k) => u.searchParams.set(k, v));
  } else if (Array.isArray(query)) {
    for (const [k, v] of query) u.searchParams.set(k, v);
  } else {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const item of v) u.searchParams.append(k, String(item));
      } else {
        u.searchParams.set(k, String(v));
      }
    }
  }
  return u.toString();
}

function isAbsoluteUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export class DefaultUrlResolver implements UrlResolver {
  constructor(private readonly baseURL?: string, private readonly querySerializer?: QuerySerializer) {}

  resolve(req: Request, _ctx: Context): string {
    if (!this.baseURL && !isAbsoluteUrl(req.url)) {
      throw new ConfigError("Relative URL is not allowed without baseURL");
    }
    const url = this.baseURL ? new URL(req.url, this.baseURL).toString() : req.url;
    if (req.query && this.querySerializer) {
      return this.querySerializer(req.query, url);
    }
    return applyQuery(url, req.query);
  }
}
