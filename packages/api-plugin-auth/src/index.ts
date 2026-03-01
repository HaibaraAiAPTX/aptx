import { Context, HttpError, Middleware, Request, Response, createBagKey } from "@aptx/api-core";
import { resolveTokenStore, type TokenStoreResolver } from "@aptx/token-store";

export interface AuthPluginOptions {
  store: TokenStoreResolver;
  refreshLeewayMs?: number;

  shouldRefresh?: (error: Error, req: Request, ctx: Context) => boolean;
  refreshToken: () => Promise<{ token: string; expiresAt?: number } | string>;

  headerName?: string;
  tokenPrefix?: string;

  onRefreshFailed?: (error: Error) => void;
  maxRetry?: number;
}

/**
 * Meta key for skipping auth refresh.
 * When a request has this meta key set to true, the auth middleware will not
 * attempt to refresh the token on 401 errors. This is useful for refresh token
 * requests themselves to avoid infinite loops.
 */
export const SKIP_AUTH_REFRESH_META_KEY = "skipAuthRefresh";

export interface AuthController {
  refresh: () => Promise<string>;
  ensureValidToken: () => Promise<string>;
}

const AUTH_RETRY_KEY = createBagKey("auth_retry");

// 检查是否在服务端环境
function isServerSide(): boolean {
  return typeof window === "undefined";
}

export function createAuthController(options: AuthPluginOptions): AuthController {
  let refreshPromise: Promise<string> | null = null;

  const refresh = async (): Promise<string> => {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const store = await resolveTokenStore(options.store);
          const res = await options.refreshToken();
          const token = typeof res === "string" ? res : res.token;
          const expiresAt = typeof res === "string" ? undefined : res.expiresAt;
          await store.setToken(token, { expiresAt });
          return token;
        } finally {
          refreshPromise = null;
        }
      })();
    }
    return refreshPromise;
  };

  const ensureValidToken = async (): Promise<string> => {
    const store = await resolveTokenStore(options.store);
    const token = (await store.getToken()) ?? "";

    if (!token) return token;

    // 在服务端不自动刷新 token，直接返回
    if (isServerSide()) {
      return token;
    }

    let expiresAt: number | undefined;
    if (store.getMeta) {
      expiresAt = (await store.getMeta())?.expiresAt;
    } else if (store.getRecord) {
      expiresAt = (await store.getRecord())?.meta?.expiresAt;
    }
    if (!expiresAt) return token;

    const leeway = options.refreshLeewayMs ?? 60_000;
    if (Date.now() + leeway >= expiresAt) {
      return refresh();
    }
    return token;
  };

  return { refresh, ensureValidToken };
}

function defaultShouldRefresh(error: Error): boolean {
  return error instanceof HttpError && error.status === 401;
}

export function createAuthMiddleware(options: AuthPluginOptions): Middleware {
  const headerName = options.headerName ?? "Authorization";
  const tokenPrefix = options.tokenPrefix ?? "Bearer ";
  const maxRetry = options.maxRetry ?? 1;

  const controller = createAuthController(options);

  return {
    async handle(req: Request, ctx: Context, next: (req: Request, ctx: Context) => Promise<Response>) {
      const token = await controller.ensureValidToken();
      const authedReq = token
        ? req.with({ headers: { [headerName]: `${tokenPrefix}${token}` } })
        : req;

      try {
        return await next(authedReq, ctx);
      } catch (err) {
        const error = err as Error;

        // 在服务端不处理 token 刷新，直接抛出错误
        // 刷新 token 应该由客户端处理
        if (isServerSide()) {
          throw error;
        }

        // 检查请求是否标记为跳过 auth 刷新（如 refreshToken 请求本身）
        // 避免 refreshToken 请求 401 时触发无限循环
        if (req.meta[SKIP_AUTH_REFRESH_META_KEY] === true) {
          throw error;
        }

        const shouldRefresh = options.shouldRefresh
          ? options.shouldRefresh(error, authedReq, ctx)
          : defaultShouldRefresh(error);

        if (!shouldRefresh) {
          throw error;
        }

        const currentRetry = (ctx.bag.get(AUTH_RETRY_KEY) as number | undefined) ?? 0;

        if (currentRetry >= maxRetry) {
          throw error;
        }
        ctx.bag.set(AUTH_RETRY_KEY, currentRetry + 1);

        try {
          const newToken = await controller.refresh();

          const retryReq = authedReq.with({
            headers: { [headerName]: `${tokenPrefix}${newToken}` },
          });
          return await next(retryReq, ctx);
        } catch (refreshErr) {
          const store = await resolveTokenStore(options.store);
          await store.clearToken();
          options.onRefreshFailed?.(refreshErr as Error);
          throw refreshErr;
        }
      }
    },
  };
}
