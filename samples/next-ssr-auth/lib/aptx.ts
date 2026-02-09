import { cookies } from "next/headers";
import { createAptxCoreApiClient } from "@aptx/api-client";
import { RequestClient } from "@aptx/api-core";
import { createAuthMiddleware } from "@aptx/api-plugin-auth";
import { createSsrCookieTokenStore } from "@aptx/token-store-ssr-cookie";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3100";
const TOKEN_COOKIE_KEY = "aptx_access_token";
const TOKEN_META_COOKIE_KEY = "aptx_access_meta";

export type MeResponse = {
  id: number;
  username: string;
  displayName: string;
  role: string;
};

export type LoginResponse = {
  token: string;
  expiresAt?: number;
  user: MeResponse;
};

type CookieStoreLike = Awaited<ReturnType<typeof cookies>>;

export type ServerApiContext = {
  api: ReturnType<typeof createAptxCoreApiClient>;
  store: {
    setToken(token: string, meta?: { expiresAt?: number }): void | Promise<void>;
    clearToken(): void | Promise<void>;
  };
  cookieStore: CookieStoreLike;
};

function parseSetCookie(raw: string): {
  key: string;
  value: string;
  options: {
    path?: string;
    domain?: string;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
    httpOnly?: boolean;
    expires?: Date;
  };
  } | null {
  const parts = raw.split(";").map((part) => part.trim());
  const [cookiePair, ...attrs] = parts;
  if (!cookiePair) return null;
  const eq = cookiePair.indexOf("=");
  if (eq <= 0) return null;

  const key = cookiePair.slice(0, eq);
  const value = cookiePair.slice(eq + 1);
  const options: {
    path?: string;
    domain?: string;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
    httpOnly?: boolean;
    expires?: Date;
  } = {};

  for (const attr of attrs) {
    const attrEq = attr.indexOf("=");
    const name = (attrEq >= 0 ? attr.slice(0, attrEq) : attr).toLowerCase();
    const attrValue = attrEq >= 0 ? attr.slice(attrEq + 1) : "";
    if (name === "path") options.path = attrValue;
    if (name === "domain") options.domain = attrValue;
    if (name === "samesite") options.sameSite = attrValue.toLowerCase() as "lax" | "strict" | "none";
    if (name === "secure") options.secure = true;
    if (name === "httponly") options.httpOnly = true;
    if (name === "expires") options.expires = new Date(attrValue);
  }

  return { key, value, options };
}

export async function createServerApiContext(options: { writableCookies: boolean }): Promise<ServerApiContext> {
  const cookieStore = await cookies();
  const readCookieHeader = () => cookieStore.getAll().map((item) => `${item.name}=${item.value}`).join("; ");

  const store = createSsrCookieTokenStore({
    tokenKey: TOKEN_COOKIE_KEY,
    metaKey: TOKEN_META_COOKIE_KEY,
    cookie: {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: false
    },
    getCookieHeader: readCookieHeader,
    setCookie: (setCookieValue) => {
      if (!options.writableCookies) return;
      const parsed = parseSetCookie(setCookieValue);
      if (!parsed) return;
      cookieStore.set(parsed.key, parsed.value, parsed.options);
    }
  });

  const core = new RequestClient({
    baseURL: API_BASE_URL,
    timeout: 5000
  });

  core.use(
    createAuthMiddleware({
      store,
      shouldRefresh: () => false,
      refreshToken: async () => {
        throw new Error("refresh is not implemented in this sample");
      }
    })
  );

  return {
    api: createAptxCoreApiClient(core),
    store,
    cookieStore
  };
}

export const SSR_TOKEN_COOKIE = TOKEN_COOKIE_KEY;
