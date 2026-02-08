import { Middleware, Request, Context, Response } from "@aptx/api-core";

export interface CsrfOptions {
  cookieName?: string;
  headerName?: string;
  sameOriginOnly?: boolean;
  getCookie?: (name: string) => string | undefined;
}

const DEFAULT_COOKIE = "XSRF-TOKEN";
const DEFAULT_HEADER = "X-XSRF-TOKEN";

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const pattern = new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`);
  const match = document.cookie.match(pattern);
  const value = match?.[1];
  return value ? decodeURIComponent(value) : undefined;
}

function isSameOrigin(url: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const u = new URL(url, window.location.href);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function createCsrfMiddleware(options: CsrfOptions = {}): Middleware {
  const cookieName = options.cookieName ?? DEFAULT_COOKIE;
  const headerName = options.headerName ?? DEFAULT_HEADER;
  const sameOriginOnly = options.sameOriginOnly ?? true;
  const getCookie = options.getCookie ?? readCookie;

  return {
    async handle(req: Request, _ctx: Context, next: (req: Request, ctx: Context) => Promise<Response>) {
      if (!sameOriginOnly || isSameOrigin(req.url)) {
        const token = getCookie(cookieName);
        if (token) {
          req = req.with({ headers: { [headerName]: token } });
        }
      }
      return next(req, _ctx);
    },
  };
}
