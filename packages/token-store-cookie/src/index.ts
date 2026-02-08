import Cookies, { CookieAttributes } from "js-cookie";
import type { TokenMeta, TokenRecord, TokenStore, TokenStoreFactory } from "@aptx/token-store";

export interface CookieTokenStoreOptions {
  tokenKey?: string;
  metaKey?: string;
  cookie?: CookieAttributes;
  syncExpiryFromMeta?: boolean;
}

const DEFAULT_TOKEN_KEY = "aptx_token";
const DEFAULT_META_KEY = "aptx_token_meta";

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

export class CookieTokenStore implements TokenStore {
  private readonly tokenKey: string;
  private readonly metaKey: string;
  private readonly cookie: CookieAttributes;
  private readonly syncExpiryFromMeta: boolean;

  constructor(options: CookieTokenStoreOptions = {}) {
    this.tokenKey = options.tokenKey ?? DEFAULT_TOKEN_KEY;
    this.metaKey = options.metaKey ?? DEFAULT_META_KEY;
    this.cookie = options.cookie ?? {};
    this.syncExpiryFromMeta = options.syncExpiryFromMeta ?? true;
  }

  private cookieOptions(meta?: TokenMeta): CookieAttributes {
    if (!this.syncExpiryFromMeta) return this.cookie;
    const expiresAt = meta?.expiresAt;
    if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt) || expiresAt <= 0) {
      return this.cookie;
    }
    return {
      ...this.cookie,
      expires: new Date(expiresAt),
    };
  }

  getToken(): string | undefined {
    return Cookies.get(this.tokenKey);
  }

  setToken(token: string, meta?: TokenMeta): void {
    const cookie = this.cookieOptions(meta);
    Cookies.set(this.tokenKey, token, cookie);
    if (meta) this.setMeta(meta);
  }

  clearToken(): void {
    Cookies.remove(this.tokenKey, this.cookie);
    Cookies.remove(this.metaKey, this.cookie);
  }

  getMeta(): TokenMeta | undefined {
    return parseMeta(Cookies.get(this.metaKey));
  }

  setMeta(meta: TokenMeta): void {
    const cookie = this.cookieOptions(meta);
    Cookies.set(this.metaKey, JSON.stringify(meta), cookie);
  }

  getRecord(): TokenRecord {
    return {
      token: this.getToken(),
      meta: this.getMeta(),
    };
  }

  setRecord(record: TokenRecord): void {
    const cookie = this.cookieOptions(record.meta);
    if (record.token) Cookies.set(this.tokenKey, record.token, cookie);
    else Cookies.remove(this.tokenKey, this.cookie);

    if (record.meta) Cookies.set(this.metaKey, JSON.stringify(record.meta), cookie);
    else Cookies.remove(this.metaKey, this.cookie);
  }
}

export const createCookieTokenStore: TokenStoreFactory<CookieTokenStoreOptions>["create"] = (
  options: CookieTokenStoreOptions,
) => {
  return new CookieTokenStore(options);
};
