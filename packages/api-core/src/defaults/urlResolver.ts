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
  private readonly baseOrigin?: string;
  private readonly basePath?: string;

  constructor(private readonly baseURL?: string, private readonly querySerializer?: QuerySerializer) {
    // 预解析 baseURL，分离 origin 和 path
    if (baseURL) {
      try {
        const parsed = new URL(baseURL);
        this.baseOrigin = parsed.origin;
        // 保留路径部分，移除末尾斜杠（除非是根路径）
        this.basePath = parsed.pathname.replace(/\/+$/, "") || "";
      } catch {
        // 如果 baseURL 不是有效 URL，保持原行为
      }
    }
  }

  resolve(req: Request, _ctx: Context): string {
    if (!this.baseURL && !isAbsoluteUrl(req.url)) {
      throw new ConfigError("Relative URL is not allowed without baseURL");
    }

    let url: string;
    if (this.baseOrigin && this.basePath && !isAbsoluteUrl(req.url)) {
      // 正确合并 baseURL 路径和请求路径
      const reqPath = req.url.startsWith("/") ? req.url : "/" + req.url;
      url = this.baseOrigin + this.basePath + reqPath;
    } else {
      url = this.baseURL ? new URL(req.url, this.baseURL).toString() : req.url;
    }

    if (req.query && this.querySerializer) {
      return this.querySerializer(req.query, url);
    }
    return applyQuery(url, req.query);
  }
}
