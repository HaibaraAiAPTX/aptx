import { UrlResolver, QueryInitLike, QuerySerializer } from "../types";
import { Request } from "../request";
import { Context } from "../context";
import { ConfigError } from "../errors";
import { createBagKey } from "../types";

export const URL_RESOLVER_BASE_URL_BAG_KEY = createBagKey("urlResolver.baseURL");

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

function joinUrl(baseURL: string, reqUrl: string): string {
  let url: string;
  const parsedBase = new URL(baseURL);
  const baseOrigin = parsedBase.origin;
  const basePath = parsedBase.pathname.replace(/\/+$/, "") || "";

  if (basePath && !isAbsoluteUrl(reqUrl)) {
    const reqPath = reqUrl.startsWith("/") ? reqUrl : "/" + reqUrl;
    url = baseOrigin + basePath + reqPath;
  } else {
    url = new URL(reqUrl, baseURL).toString();
  }

  return url;
}

function normalizePrefix(prefix: string): string {
  if (!prefix) return "/";
  return prefix.startsWith("/") ? prefix.replace(/\/+$/, "") || "/" : "/" + prefix.replace(/\/+$/, "");
}

function matchesPrefix(url: string, prefix: string): boolean {
  return url === prefix || url.startsWith(prefix + "/");
}

export function chainUrlResolvers(...resolvers: UrlResolver[]): UrlResolver {
  return {
    resolve(req: Request, ctx: Context): string {
      let currentReq = req;
      for (const resolver of resolvers) {
        const nextUrl = resolver.resolve(currentReq, ctx);
        if (nextUrl !== currentReq.url) {
          currentReq = currentReq.with({ url: nextUrl });
        }
      }
      return currentReq.url;
    },
  };
}

export function createGatewayUrlResolver(gateways: Record<string, string>): UrlResolver {
  const entries = Object.entries(gateways)
    .map(([prefix, baseURL]) => ({ prefix: normalizePrefix(prefix), baseURL }))
    .sort((a, b) => b.prefix.length - a.prefix.length);

  return {
    resolve(req: Request, ctx: Context): string {
      if (isAbsoluteUrl(req.url)) return req.url;

      const matched = entries.find(({ prefix }) => matchesPrefix(req.url, prefix));
      if (matched) {
        ctx.bag.set(URL_RESOLVER_BASE_URL_BAG_KEY, matched.baseURL);
      } else {
        ctx.bag.delete(URL_RESOLVER_BASE_URL_BAG_KEY);
      }

      return req.url;
    },
  };
}

export class DefaultUrlResolver implements UrlResolver {
  constructor(private readonly baseURL?: string, private readonly querySerializer?: QuerySerializer) {}

  resolve(req: Request, ctx: Context): string {
    const runtimeBaseURL = ctx?.bag instanceof Map ? ctx.bag.get(URL_RESOLVER_BASE_URL_BAG_KEY) : undefined;
    const effectiveBaseURL =
      typeof runtimeBaseURL === "string" && runtimeBaseURL.length > 0 ? runtimeBaseURL : this.baseURL;

    if (!effectiveBaseURL && !isAbsoluteUrl(req.url)) {
      throw new ConfigError("Relative URL is not allowed without baseURL");
    }

    const url = effectiveBaseURL ? joinUrl(effectiveBaseURL, req.url) : req.url;

    if (req.query && this.querySerializer) {
      return this.querySerializer(req.query, url);
    }
    return applyQuery(url, req.query);
  }
}
