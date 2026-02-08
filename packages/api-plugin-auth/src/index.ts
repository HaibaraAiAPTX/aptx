import { Context, HttpError, Middleware, Request, Response, createBagKey } from "@aptx/api-core";
import type { TokenStore } from "@aptx/token-store";

export interface AuthPluginOptions {
  store: TokenStore;
  refreshLeewayMs?: number;

  shouldRefresh?: (error: Error, req: Request, ctx: Context) => boolean;
  refreshToken: () => Promise<{ token: string; expiresAt?: number } | string>;

  headerName?: string;
  tokenPrefix?: string;

  onRefreshFailed?: (error: Error) => void;
  maxRetry?: number;
}

export interface AuthController {
  refresh: () => Promise<string>;
  ensureValidToken: () => Promise<string>;
}

const AUTH_RETRY_KEY = createBagKey("auth_retry");

export function createAuthController(options: AuthPluginOptions): AuthController {
  let refreshPromise: Promise<string> | null = null;

  const refresh = async (): Promise<string> => {
    if (!refreshPromise) {
      refreshPromise = Promise.resolve()
        .then(async () => {
          const res = await options.refreshToken();
          const token = typeof res === "string" ? res : res.token;
          const expiresAt = typeof res === "string" ? undefined : res.expiresAt;
          await options.store.setToken(token, { expiresAt });
          return token;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  };

  const ensureValidToken = async (): Promise<string> => {
    const token = (await options.store.getToken()) ?? "";
    let expiresAt: number | undefined;
    if (options.store.getMeta) {
      expiresAt = (await options.store.getMeta())?.expiresAt;
    } else if (options.store.getRecord) {
      expiresAt = (await options.store.getRecord())?.meta?.expiresAt;
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
        const shouldRefresh = options.shouldRefresh
          ? options.shouldRefresh(error, authedReq, ctx)
          : defaultShouldRefresh(error);

        if (!shouldRefresh) throw error;

        const currentRetry = (ctx.bag.get(AUTH_RETRY_KEY) as number | undefined) ?? 0;
        if (currentRetry >= maxRetry) throw error;
        ctx.bag.set(AUTH_RETRY_KEY, currentRetry + 1);

        try {
          const newToken = await controller.refresh();
          const retryReq = authedReq.with({
            headers: { [headerName]: `${tokenPrefix}${newToken}` },
          });
          return await next(retryReq, ctx);
        } catch (refreshErr) {
          await options.store.clearToken();
          options.onRefreshFailed?.(refreshErr as Error);
          throw refreshErr;
        }
      }
    },
  };
}
