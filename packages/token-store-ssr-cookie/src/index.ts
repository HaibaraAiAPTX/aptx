import type { TokenMeta, TokenRecord, TokenStore, TokenStoreFactory } from "@aptx/token-store";

export type SsrCookieAttributes = {
  path?: string;
  domain?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  httpOnly?: boolean;
};

export interface SsrCookieTokenStoreOptions {
  tokenKey?: string;
  metaKey?: string;
  cookie?: SsrCookieAttributes;
  syncExpiryFromMeta?: boolean;

  /** Reads the raw Cookie header for the current SSR request. */
  getCookieHeader: () => string | undefined;
  /** Appends a Set-Cookie header value to the current SSR response. */
  setCookie: (setCookieHeaderValue: string) => void;
}

const DEFAULT_TOKEN_KEY = "aptx_token";
const DEFAULT_META_KEY = "aptx_token_meta";

function parseCookieHeader(raw?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  const parts = raw.split(";");
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    const key = p.slice(0, eq).trim();
    const value = p.slice(eq + 1).trim();
    if (!key) continue;
    out[key] = value;
  }
  return out;
}

function serializeCookie(
  key: string,
  value: string,
  attrs: SsrCookieAttributes,
  expiresAt?: number,
): string {
  const segments: string[] = [`${key}=${value}`];
  if (attrs.path) segments.push(`Path=${attrs.path}`);
  if (attrs.domain) segments.push(`Domain=${attrs.domain}`);
  if (attrs.sameSite) {
    const sameSite = attrs.sameSite;
    segments.push(`SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`);
  }
  if (attrs.secure) segments.push("Secure");
  if (attrs.httpOnly) segments.push("HttpOnly");
  if (typeof expiresAt === "number" && Number.isFinite(expiresAt) && expiresAt > 0) {
    segments.push(`Expires=${new Date(expiresAt).toUTCString()}`);
  }
  return segments.join("; ");
}

function parseMeta(raw?: string): TokenMeta | undefined {
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw);
    if (value && typeof value === "object") return value as TokenMeta;
    return undefined;
  } catch {
    return undefined;
  }
}

export class SsrCookieTokenStore implements TokenStore {
  private readonly tokenKey: string;
  private readonly metaKey: string;
  private readonly cookie: SsrCookieAttributes;
  private readonly syncExpiryFromMeta: boolean;
  private readonly getCookieHeader: () => string | undefined;
  private readonly setCookie: (v: string) => void;

  constructor(options: SsrCookieTokenStoreOptions) {
    this.tokenKey = options.tokenKey ?? DEFAULT_TOKEN_KEY;
    this.metaKey = options.metaKey ?? DEFAULT_META_KEY;
    this.cookie = options.cookie ?? {};
    this.syncExpiryFromMeta = options.syncExpiryFromMeta ?? true;
    this.getCookieHeader = options.getCookieHeader;
    this.setCookie = options.setCookie;
  }

  private cookieExpires(meta?: TokenMeta): number | undefined {
    if (!this.syncExpiryFromMeta) return undefined;
    const expiresAt = meta?.expiresAt;
    if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt) || expiresAt <= 0) return undefined;
    return expiresAt;
  }

  private readJar(): Record<string, string> {
    return parseCookieHeader(this.getCookieHeader());
  }

  getToken(): string | undefined {
    return this.readJar()[this.tokenKey];
  }

  setToken(token: string, meta?: TokenMeta): void {
    const exp = this.cookieExpires(meta);
    this.setCookie(serializeCookie(this.tokenKey, token, this.cookie, exp));
    if (meta) this.setMeta(meta);
  }

  clearToken(): void {
    const expiredAt = 0;
    this.setCookie(serializeCookie(this.tokenKey, "", this.cookie, expiredAt));
    this.setCookie(serializeCookie(this.metaKey, "", this.cookie, expiredAt));
  }

  getMeta(): TokenMeta | undefined {
    const raw = this.readJar()[this.metaKey];
    return parseMeta(raw);
  }

  setMeta(meta: TokenMeta): void {
    const exp = this.cookieExpires(meta);
    this.setCookie(serializeCookie(this.metaKey, JSON.stringify(meta), this.cookie, exp));
  }

  getRecord(): TokenRecord {
    return {
      token: this.getToken(),
      meta: this.getMeta(),
    };
  }

  setRecord(record: TokenRecord): void {
    const exp = this.cookieExpires(record.meta);
    if (record.token) this.setCookie(serializeCookie(this.tokenKey, record.token, this.cookie, exp));
    else this.setCookie(serializeCookie(this.tokenKey, "", this.cookie, 0));

    if (record.meta) this.setCookie(serializeCookie(this.metaKey, JSON.stringify(record.meta), this.cookie, exp));
    else this.setCookie(serializeCookie(this.metaKey, "", this.cookie, 0));
  }
}

export const createSsrCookieTokenStore: TokenStoreFactory<SsrCookieTokenStoreOptions>["create"] = (
  options: SsrCookieTokenStoreOptions,
) => {
  return new SsrCookieTokenStore(options);
};
